"""Stage 1 expansion: BFS over registry NODES (never paths). Each node is expanded
exactly once; successors must reference existing registry IDs whenever one exists
(the whole registry rides along in the prompt), and every new title passes entity
resolution before an ID is minted.

Run:  python pipeline/expand.py --max-depth 4 --limit 20
Resumable: frontier + expanded set live in state/frontier.json; registry saves after
every node; unchanged prompts replay from the call cache for free.
"""
import argparse
import json
import re
from typing import List, Optional

from pydantic import BaseModel, Field

from lib import (Registry, NodeType, EdgeType, atomic_write, read_jsonl,  # noqa: F401
                 call_json, FRONTIER_FILE)
from resolve import Resolver

EXPAND_MODEL = "gemini-2.5-pro"


class ChildRef(BaseModel):
    existing_id: Optional[str] = Field(
        None, description="EXACT id from the registry block, if this successor already exists there. Strongly preferred over new_title.")
    new_title: Optional[str] = Field(
        None, description="Title for a genuinely new entry (only when no registry id means the same thing). Concrete and specific — never a bucket like 'Government Jobs (PSU|UPSC)'. No '/' or '|'. Never a bare generic like 'Ph.D.' — say 'Ph.D. in Economics'.")
    new_type: Optional[NodeType] = Field(None, description="Node type, required with new_title.")
    one_line_definition: Optional[str] = Field(
        None, description="One sentence defining the new entry (used for dedup embedding). Required with new_title.")
    edge_type: EdgeType = Field(
        EdgeType.progression, description="progression = normal next step; exam_gate = the successor is an entrance/qualifying exam; lateral = sideways switch between tracks.")
    confidence: str = Field(description="core | common | niche — how mainstream this successor is for the given node in India.")


class ExpansionResult(BaseModel):
    is_terminal: bool = Field(description="True only if this node is a final career endpoint with no meaningful next options.")
    successors: List[ChildRef] = Field(max_length=10)


def expansion_prompt(reg: Registry, node, trails: List[str]) -> str:
    trail_block = "\n".join(f"- {t}" for t in trails) or "- (root)"
    return f"""You are an expert career counsellor for the INDIAN education system, extending a
career graph. Nodes are stages/qualifications/exams/roles; edges mean "a realistic
immediate next step".

CURRENT NODE ({node.type.value}): "{node.title}"
Definition: {node.description}
Typical routes to it:
{trail_block}

REGISTRY (id | title) — the graph so far:
{reg.registry_block()}

Task: list the IMMEDIATE next options after the current node in India (4-10; fewer if
the node is genuinely terminal).
Rules:
1. NEVER skip steps (Class 10 -> stream -> degree -> role, not Class 10 -> role).
2. If a successor already exists in the registry, return its EXACT id in existing_id.
   Only use new_title when nothing in the registry means the same thing.
3. Concrete options only — never aggregate buckets ("Government Jobs (PSU|UPSC)"),
   never bare generics ("Ph.D.", "Higher Studies"); qualify by domain instead.
4. Entrance/qualifying exams are their own nodes (edge_type=exam_gate); prefer the
   registry's existing exam entries.
5. Include the mainstream paths (confidence=core/common) and at most 2 niche ones.
6. is_terminal=true only for true endpoints (e.g. a senior-most role)."""


def load_frontier() -> dict:
    return json.load(open(FRONTIER_FILE))


def save_frontier(fr: dict):
    atomic_write(FRONTIER_FILE, json.dumps(fr, indent=1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-depth", type=int, default=4, help="expand nodes at depth < max-depth")
    ap.add_argument("--limit", type=int, default=0, help="max nodes to expand this run (0 = no cap)")
    args = ap.parse_args()

    reg = Registry()
    resolver = Resolver(reg)
    fr = load_frontier()
    expanded = set(fr["expanded"])
    queue = [q for q in fr["queue"] if q["id"] not in expanded]

    done = 0
    while queue:
        item = queue.pop(0)
        nid, depth = item["id"], item["depth"]
        if nid in expanded or depth >= args.max_depth or nid not in reg.nodes:
            continue
        node = reg.nodes[nid]
        trail_ids = reg.shortest_trail(nid)
        trails = [" → ".join(reg.nodes[i].title for i in trail_ids)] if trail_ids else []

        print(f"[depth {depth}] expanding {nid} ({node.title})")
        result = call_json(EXPAND_MODEL, expansion_prompt(reg, node, trails), ExpansionResult)

        node.is_terminal = result.is_terminal
        for ref in result.successors:
            target_id = None
            if ref.existing_id:
                if ref.existing_id in reg.nodes:
                    target_id = ref.existing_id
                elif ref.new_title is None:
                    # hallucinated id with no fallback title: recover via title-ish part
                    guess = ref.existing_id.split(":", 1)[-1].replace("-", " ")
                    res = resolver.resolve(ref.new_type or node.type, guess,
                                           ref.one_line_definition or "", node, EXPAND_MODEL)
                    if res.action != "rejected":
                        target_id = res.node_id
            if target_id is None and ref.new_title:
                if not ref.new_type or not ref.one_line_definition:
                    print(f"   ! skipping incomplete new_title {ref.new_title!r}")
                    continue
                res = resolver.resolve(ref.new_type, ref.new_title,
                                       ref.one_line_definition, node, EXPAND_MODEL)
                if res.action == "rejected":
                    print(f"   ! rejected: {res.reason}")
                    continue
                target_id = res.node_id
                if res.action == "minted":
                    print(f"   + minted {target_id}")
            if target_id is None:
                continue

            etype = ref.edge_type
            # edge grammar: exam_gate iff one endpoint is an exam
            endpoint_is_exam = (reg.nodes[target_id].type == NodeType.exam
                                or node.type == NodeType.exam)
            if endpoint_is_exam:
                etype = EdgeType.exam_gate
            elif etype == EdgeType.exam_gate:
                etype = EdgeType.progression
            reg.add_edge(nid, target_id, etype, EXPAND_MODEL,
                         is_common_route=(ref.confidence != "niche"))

            if target_id not in expanded and all(q["id"] != target_id for q in queue):
                queue.append({"id": target_id, "depth": depth + 1})

        expanded.add(nid)
        reg.save()
        fr["queue"] = queue
        fr["expanded"] = sorted(expanded)
        save_frontier(fr)

        done += 1
        if args.limit and done >= args.limit:
            print(f"limit {args.limit} reached")
            break

    print(f"expanded {done} nodes; registry now {len(reg.nodes)} nodes / {len(reg.edges)} edges; "
          f"frontier {len([q for q in queue if q['depth'] < args.max_depth])} pending")


if __name__ == "__main__":
    main()
