"""Entity resolution: decide whether a proposed new title IS an existing registry
node (link + alias) or genuinely new (mint). Ladder per the approved plan, with the
committed RUBRIC.md decision table embedded in the judge prompt.

Bands — CALIBRATED 2026-07-04 against pipeline/eval/er_labels.json (655 pairs):
  exact normalized match  -> link, no LLM      (65/65 correct on the labeled set)
  cosine >= JUDGE_BAND    -> flash judge       (NO auto-link band: even at cosine
                             0.95 auto-merge precision is only 0.70 — distinct
                             qualifier siblings reach 0.993. Judge everything.)
  < JUDGE_BAND (0.80)     -> mint              (no true duplicate scored < 0.881)
Standing preference: under-merge (a missed merge is an additive fix later; a wrong
merge is not).
"""
import os
import re
from typing import List, Optional, Tuple

from pydantic import BaseModel, Field, field_validator

from lib import (Registry, Node, NodeType, Provenance, is_bare_generic,
                 looks_aggregate, mint_id, embed_texts, cosine,
                 call_json, append_jsonl, today, ER_LEDGER_FILE, PIPE_DIR)

JUDGE_BAND = 0.80
JUDGE_MODEL = "gemini-2.5-flash"

_RUBRIC_TABLE: Optional[str] = None

def rubric_table() -> str:
    """The decision table from RUBRIC.md, embedded verbatim in judge prompts."""
    global _RUBRIC_TABLE
    if _RUBRIC_TABLE is None:
        text = open(os.path.join(PIPE_DIR, "RUBRIC.md")).read()
        m = re.search(r"## Decision table.*?(?=## )", text, re.S)
        _RUBRIC_TABLE = m.group(0) if m else text
    return _RUBRIC_TABLE


class JudgeVerdict(BaseModel):
    decision: str = Field(description="one of: same_role | distinct | unsure")
    matched_id: Optional[str] = Field(None, description="the registry id judged same, if same_role")
    rule: int = Field(description="rubric row number applied (1-12)")
    rationale: str = Field(description="one short sentence")

    # Gemini doesn't reliably honor string maxLength in response schemas — truncate
    # instead of failing validation (a 210-char rationale must not kill the run).
    @field_validator("rationale")
    @classmethod
    def _trim(cls, v: str) -> str:
        return v[:300]


class Resolution(BaseModel):
    action: str            # linked | minted | rejected
    node_id: Optional[str] = None
    reason: str = ""


def _er_text(node_type: NodeType, title: str, definition: str) -> str:
    return f"{node_type.value}: {title} — {definition[:160]}"


class Resolver:
    def __init__(self, reg: Registry):
        self.reg = reg
        self._reg_vecs: dict[str, List[float]] = {}
        self._refresh_embeddings()

    def _refresh_embeddings(self):
        nodes = list(self.reg.nodes.values())
        texts = [_er_text(n.type, n.title, n.description) for n in nodes]
        vecs = embed_texts(texts)
        self._reg_vecs = {n.id: v for n, v in zip(nodes, vecs)}

    def _neighbors(self, node_type: NodeType, vec: List[float], k: int = 5) -> List[Tuple[str, float]]:
        scored = [(nid, cosine(vec, v)) for nid, v in self._reg_vecs.items()
                  if self.reg.nodes[nid].type == node_type]
        return sorted(scored, key=lambda x: -x[1])[:k]

    def resolve(self, node_type: NodeType, title: str, definition: str,
                parent: Optional[Node], model_for_mint: str) -> Resolution:
        title = re.sub(r"\s+", " ", title).strip()

        # RUBRIC row 10: aggregates are banned outright in v2.
        if looks_aggregate(title):
            self._ledger("rejected_aggregate", title, node_type, None, None, "rubric row 10")
            return Resolution(action="rejected", reason=f"aggregate/disjunction title: {title!r}")

        # Titles are display-only in v2: '/' is fine ("UI/UX Designer"), '|' is a
        # v1 artifact — normalize survivors of the aggregate check, flag for review.
        pipe_flag = "|" in title
        if pipe_flag:
            title = re.sub(r"\s*\|\s*", "/", title)

        # RUBRIC row 6: bare generics inherit domain from the parent.
        if is_bare_generic(title) and parent is not None:
            domain = re.sub(r"\s*\([^)]*\)", "", parent.title).strip()
            title = f"{title.rstrip('.')} in {domain}"

        # Gate 1: exact normalized/alias match within type.
        hit = self.reg.lookup_exact(node_type, title)
        if hit:
            self.reg.add_alias(hit, title)
            self._ledger("linked_exact", title, node_type, hit, 1.0, "normalized exact")
            return Resolution(action="linked", node_id=hit)

        # Gate 2: embedding shortlist -> judge. Calibration showed cosine alone can
        # NEVER auto-merge here (distinct qualifier siblings reach 0.993), so every
        # shortlisted pair goes to the rubric judge.
        vec = embed_texts([_er_text(node_type, title, definition)])[0]
        neighbors = self._neighbors(node_type, vec)
        if neighbors:
            top_id, top_sim = neighbors[0]
            if top_sim >= JUDGE_BAND:
                verdict = self._judge(node_type, title, definition, parent,
                                      [nid for nid, _ in neighbors[:3]])
                if verdict.decision == "same_role" and verdict.matched_id in self.reg.nodes:
                    self.reg.add_alias(verdict.matched_id, title)
                    self._ledger("linked_judge", title, node_type, verdict.matched_id,
                                 top_sim, f"rule {verdict.rule}: {verdict.rationale}")
                    return Resolution(action="linked", node_id=verdict.matched_id)
                # distinct or unsure -> mint; unsure additionally flags review (under-merge default)
                return self._mint(node_type, title, definition, model_for_mint, vec,
                                  needs_review=(verdict.decision == "unsure") or pipe_flag,
                                  reason=f"judge {verdict.decision} (rule {verdict.rule})")

        return self._mint(node_type, title, definition, model_for_mint, vec,
                          needs_review=pipe_flag, reason=f"no neighbor >= {JUDGE_BAND}")

    def _judge(self, node_type: NodeType, title: str, definition: str,
               parent: Optional[Node], candidate_ids: List[str]) -> JudgeVerdict:
        cands = "\n".join(
            f"- id: {nid}\n  title: {self.reg.nodes[nid].title}\n  definition: {self.reg.nodes[nid].description[:200]}"
            for nid in candidate_ids)
        parent_line = f'It was proposed as a successor of "{parent.title}".' if parent else ""
        prompt = f"""You are the entity-resolution judge for an Indian career-graph registry.
Decide whether the CANDIDATE is the same career entity as one of the EXISTING registry
entries, applying the rubric decision table below IN ORDER (first matching row wins).
Standing preference: under-merge — when in doubt, answer "distinct".

{rubric_table()}

CANDIDATE ({node_type.value}): "{title}"
Definition: {definition}
{parent_line}

EXISTING candidates:
{cands}

Answer with decision (same_role | distinct | unsure), matched_id (only if same_role),
the rubric rule number you applied, and a one-sentence rationale."""
        return call_json(JUDGE_MODEL, prompt, JudgeVerdict)

    def _mint(self, node_type: NodeType, title: str, definition: str, model: str,
              vec: List[float], needs_review: bool, reason: str) -> Resolution:
        nid = mint_id(node_type, title, self.reg.nodes.keys())
        node = Node(id=nid, type=node_type, title=title, description=definition,
                    needs_review=needs_review,
                    prov=Provenance(model=model, generated_at=today()))
        self.reg.add_node(node)
        self._reg_vecs[nid] = vec
        self._ledger("minted", title, node_type, nid, None, reason)
        return Resolution(action="minted", node_id=nid, reason=reason)

    def _ledger(self, action: str, title: str, node_type: NodeType,
                node_id: Optional[str], score: Optional[float], reason: str):
        append_jsonl(ER_LEDGER_FILE, {
            "date": today(), "action": action, "title": title,
            "type": node_type.value, "node_id": node_id,
            "score": round(score, 4) if score is not None else None, "reason": reason,
        })
