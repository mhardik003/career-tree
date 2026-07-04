"""Career Tree v2 pipeline core: data model, registry I/O, normalization, Gemini wrapper.

Everything committable is sorted JSONL (diffable); ledger/ holds gitignored caches
(LLM call cache, embeddings) plus the committed ER decision ledger.
"""
import os
import re
import json
import time
import hashlib
import tempfile
from enum import Enum
from typing import List, Optional, Dict, Iterable

import yaml
from pydantic import BaseModel, Field
from dotenv import load_dotenv

PIPE_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(PIPE_DIR)
# override=True: the repo .env is authoritative — a stale GEMINI_API_KEY exported in
# the user's shell profile must not shadow it.
load_dotenv(os.path.join(REPO_ROOT, ".env"), override=True)

NODES_FILE = os.path.join(PIPE_DIR, "registry", "nodes.jsonl")
EDGES_FILE = os.path.join(PIPE_DIR, "registry", "edges.jsonl")
FRONTIER_FILE = os.path.join(PIPE_DIR, "state", "frontier.json")
CALL_CACHE_FILE = os.path.join(PIPE_DIR, "ledger", "call_cache.jsonl")      # gitignored
EMBED_CACHE_FILE = os.path.join(PIPE_DIR, "ledger", "embeddings.jsonl")     # gitignored
ER_LEDGER_FILE = os.path.join(PIPE_DIR, "ledger", "er_decisions.jsonl")     # committed
VOCAB_FILE = os.path.join(PIPE_DIR, "vocab.yaml")

PROMPT_VERSION = "v2.0"


# --- data model -------------------------------------------------------------

class NodeType(str, Enum):
    school_stage = "school_stage"
    stream = "stream"
    exam = "exam"
    degree = "degree"
    diploma = "diploma"
    certification = "certification"
    training = "training"
    job_role = "job_role"
    government_service = "government_service"
    entrepreneurship = "entrepreneurship"


class EdgeType(str, Enum):
    progression = "progression"    # normal next-step
    exam_gate = "exam_gate"        # one endpoint is an exam
    lateral = "lateral"            # sideways move between tracks


class Provenance(BaseModel):
    model: str
    prompt_version: str = PROMPT_VERSION
    generated_at: str                      # ISO date
    verified_at: Optional[str] = None
    source_urls: List[str] = []


class Node(BaseModel):
    id: str                                # "{type}:{slug}", minted once, immutable
    type: NodeType
    title: str                             # display only, never identity
    aliases: List[str] = []
    description: str = ""
    is_terminal: bool = False
    needs_review: bool = False
    facts: Optional[dict] = None           # NodeFacts, filled in Stage 2
    prov: Provenance


class Edge(BaseModel):
    id: str                                # "{from_id}->{to_id}"
    from_id: str
    to_id: str
    edge_type: EdgeType = EdgeType.progression
    is_common_route: bool = True
    facts: Optional[dict] = None           # EdgeFacts, filled in Stage 2
    prov: Provenance


# --- normalization ----------------------------------------------------------

def slugify(text: str) -> str:
    """Mirror of career-tree/lib/slugify.ts."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return re.sub(r"(^-|-$)+", "", text)


def load_vocab() -> dict:
    with open(VOCAB_FILE) as f:
        return yaml.safe_load(f)


_ABBREV: Dict[str, str] = {}

def _abbrev_table() -> Dict[str, str]:
    global _ABBREV
    if not _ABBREV:
        _ABBREV = {k.lower(): v.lower() for k, v in load_vocab()["abbreviations"].items()}
    return _ABBREV


def normalize_title(title: str) -> str:
    """Canonical token form used for the exact-match ER gate.

    Lowercase, punctuation -> space, then token-sequence abbreviation expansion.
    Parenthetical content is KEPT as tokens (qualifiers are identity-bearing;
    see RUBRIC.md rows 4-5)."""
    t = title.lower().replace("&", " and ")
    t = re.sub(r"[^a-z0-9]+", " ", t).strip()
    t = f" {t} "
    for short, full in _abbrev_table().items():
        t = t.replace(f" {short} ", f" {full} ")
    return re.sub(r"\s+", " ", t).strip()


LEVEL_TOKENS = {
    "junior", "senior", "lead", "principal", "chief", "head", "deputy", "vice",
    "assistant", "associate", "trainee", "intern",
    "bachelor", "master", "doctoral", "phd", "postdoctoral",
    "b", "m", "ug", "pg", "dm", "mch", "md", "ms",
}

def level_tokens(title: str) -> frozenset:
    """Identity-bearing level/seniority tokens (RUBRIC row 7). Two titles whose
    level-token sets differ must never auto-merge on embedding similarity alone."""
    return frozenset(t for t in normalize_title(title).split() if t in LEVEL_TOKENS)


BARE_GENERICS = {
    "phd", "ph d", "doctor of philosophy", "masters", "master s", "higher studies",
    "specialization", "specialisation", "postdoc", "research", "further studies",
    "m tech", "m sc", "m a", "mba abroad",
}

def is_bare_generic(title: str) -> bool:
    """Context-inheriting generic (RUBRIC row 6): must be domain-qualified, never
    minted bare."""
    return normalize_title(title) in BARE_GENERICS


AGGREGATE_RE = re.compile(r"\||/| or |, | & ")

def looks_aggregate(title: str) -> bool:
    """Disjunction/aggregate titles (RUBRIC row 10) are banned in v2 — the graph
    expresses alternatives as separate edges. Heuristic: separator + both halves long."""
    parts = [p.strip() for p in AGGREGATE_RE.split(title) if p.strip()]
    return len(parts) >= 2 and all(len(p) >= 8 for p in parts) and "(" not in title[: title.find("|") + 1 or 0]


def mint_id(node_type: NodeType, title: str, taken: Iterable[str]) -> str:
    base = f"{node_type.value}:{slugify(title)}"
    if base not in taken:
        return base
    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return f"{base}-{n}"


# --- file I/O ---------------------------------------------------------------

def atomic_write(path: str, content: str):
    d = os.path.dirname(path)
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(content)
    os.replace(tmp, path)


def read_jsonl(path: str) -> List[dict]:
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def append_jsonl(path: str, record: dict):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def today() -> str:
    return time.strftime("%Y-%m-%d")


# --- registry ---------------------------------------------------------------

class Registry:
    def __init__(self):
        self.nodes: Dict[str, Node] = {}
        self.edges: Dict[str, Edge] = {}
        for rec in read_jsonl(NODES_FILE):
            n = Node(**rec)
            self.nodes[n.id] = n
        for rec in read_jsonl(EDGES_FILE):
            e = Edge(**rec)
            self.edges[e.id] = e
        self._alias_index: Dict[tuple, str] = {}
        for n in self.nodes.values():
            self._index_node(n)

    def _index_node(self, n: Node):
        for surface in [n.title] + n.aliases:
            self._alias_index[(n.type.value, normalize_title(surface))] = n.id

    def lookup_exact(self, node_type: NodeType, title: str) -> Optional[str]:
        return self._alias_index.get((node_type.value, normalize_title(title)))

    def add_node(self, n: Node):
        assert n.id not in self.nodes, f"duplicate id {n.id}"
        self.nodes[n.id] = n
        self._index_node(n)

    def add_alias(self, node_id: str, surface: str):
        n = self.nodes[node_id]
        if surface not in n.aliases and normalize_title(surface) != normalize_title(n.title):
            n.aliases.append(surface)
            self._index_node(n)

    def add_edge(self, from_id: str, to_id: str, edge_type: EdgeType, model: str,
                 is_common_route: bool = True) -> Optional[Edge]:
        eid = f"{from_id}->{to_id}"
        if eid in self.edges or from_id == to_id:
            return None
        e = Edge(id=eid, from_id=from_id, to_id=to_id, edge_type=edge_type,
                 is_common_route=is_common_route,
                 prov=Provenance(model=model, generated_at=today()))
        self.edges[eid] = e
        return e

    def outgoing(self, node_id: str) -> List[Edge]:
        return [e for e in self.edges.values() if e.from_id == node_id]

    def incoming(self, node_id: str) -> List[Edge]:
        return [e for e in self.edges.values() if e.to_id == node_id]

    def shortest_trail(self, node_id: str, root: str = "school_stage:class-10") -> List[str]:
        """BFS shortest path root->node as a list of ids ([] if unreachable)."""
        from collections import deque
        if node_id == root:
            return [root]
        parents: Dict[str, str] = {root: ""}
        q = deque([root])
        while q:
            cur = q.popleft()
            for e in self.outgoing(cur):
                if e.to_id not in parents:
                    parents[e.to_id] = cur
                    if e.to_id == node_id:
                        trail = [node_id]
                        while parents[trail[-1]]:
                            trail.append(parents[trail[-1]])
                        return list(reversed(trail))
                    q.append(e.to_id)
        return []

    def save(self):
        nodes = sorted(self.nodes.values(), key=lambda n: n.id)
        edges = sorted(self.edges.values(), key=lambda e: e.id)
        atomic_write(NODES_FILE, "".join(
            json.dumps(n.model_dump(exclude_none=True), ensure_ascii=False) + "\n" for n in nodes))
        atomic_write(EDGES_FILE, "".join(
            json.dumps(e.model_dump(exclude_none=True), ensure_ascii=False) + "\n" for e in edges))

    def registry_block(self) -> str:
        """Compact `id | title | type` block that rides along in expansion prompts."""
        lines = [f"{n.id} | {n.title}" for n in sorted(self.nodes.values(), key=lambda n: n.id)]
        return "\n".join(lines)


# --- Gemini wrapper with prompt-hash call cache ------------------------------

_client = None

def gemini():
    global _client
    if _client is None:
        from google import genai
        key = os.getenv("GEMINI_API_KEY")
        if not key:
            raise ValueError("GEMINI_API_KEY missing")
        _client = genai.Client(api_key=key)
    return _client


_call_cache: Optional[Dict[str, str]] = None

def _load_call_cache() -> Dict[str, str]:
    global _call_cache
    if _call_cache is None:
        _call_cache = {r["key"]: r["response"] for r in read_jsonl(CALL_CACHE_FILE)}
    return _call_cache


def call_json(model: str, prompt: str, schema: type[BaseModel], retries: int = 3):
    """Structured-output call with prompt-hash cache replay: rerunning the pipeline
    with unchanged prompts costs nothing."""
    key = hashlib.sha256(
        f"{model}|{PROMPT_VERSION}|{schema.__name__}|{prompt}".encode()).hexdigest()
    cache = _load_call_cache()
    if key in cache:
        return schema.model_validate_json(cache[key])
    last_err = None
    for attempt in range(retries):
        try:
            resp = gemini().models.generate_content(
                model=model,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_json_schema": schema.model_json_schema(),
                },
            )
            out = schema.model_validate_json(resp.text)
            append_jsonl(CALL_CACHE_FILE, {"key": key, "model": model,
                                           "schema": schema.__name__, "response": resp.text})
            cache[key] = resp.text
            return out
        except Exception as e:  # noqa: BLE001 — retry then surface
            last_err = e
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Gemini call failed after {retries} tries: {last_err}")


# --- embeddings with cache ----------------------------------------------------

_embed_cache: Optional[Dict[str, List[float]]] = None

def _load_embed_cache() -> Dict[str, List[float]]:
    global _embed_cache
    if _embed_cache is None:
        _embed_cache = {r["key"]: r["vec"] for r in read_jsonl(EMBED_CACHE_FILE)}
    return _embed_cache


def embed_texts(texts: List[str]) -> List[List[float]]:
    cache = _load_embed_cache()
    keys = [hashlib.sha256(t.encode()).hexdigest() for t in texts]
    missing = [(i, t) for i, (k, t) in enumerate(zip(keys, texts)) if k not in cache]
    for start in range(0, len(missing), 100):
        chunk = missing[start:start + 100]
        resp = gemini().models.embed_content(
            model="gemini-embedding-001",
            contents=[t for _, t in chunk],
            config={"task_type": "SEMANTIC_SIMILARITY", "output_dimensionality": 768},
        )
        for (i, t), emb in zip(chunk, resp.embeddings):
            k = keys[i]
            cache[k] = list(emb.values)
            append_jsonl(EMBED_CACHE_FILE, {"key": k, "text": t[:120], "vec": cache[k]})
        time.sleep(0.3)
    return [cache[k] for k in keys]


def cosine(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(y * y for y in b) ** 0.5
    return dot / (na * nb) if na and nb else 0.0
