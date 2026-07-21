"""Stage 1 expansion: BFS over registry NODES (never paths). Each node is expanded
exactly once; successors must reference existing registry IDs whenever one exists
(a bounded, relevant registry slice rides along in the prompt — see
Registry.registry_block_for), and every new title passes entity resolution before
an ID is minted.

Run:  python pipeline/expand.py --max-depth 4 --limit 20
Resumable: frontier + expanded set live in state/frontier.json; registry + frontier
checkpoint together every SAVE_EVERY nodes and on exit/interrupt; unchanged prompts
replay from the call cache for free.
"""
import argparse
import json
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from lib import Registry, NodeType, EdgeType, atomic_write, call_json, FRONTIER_FILE
from resolve import Resolver

EXPAND_MODEL = "gpt-5.6-terra"

# Checkpoint cadence: Registry.save()/save_frontier() rewrite whole files (O(N)),
# so saving per node makes a run O(N^2) in disk I/O. Batch instead; an interrupted
# run loses at most SAVE_EVERY-1 nodes of work (the finally block flushes the rest).
SAVE_EVERY = 25

WORKING_TYPES = {NodeType.job_role, NodeType.government_service, NodeType.entrepreneurship}
EDUCATION_TYPES = {NodeType.degree, NodeType.diploma, NodeType.certification, NodeType.training}


def should_expand(depth: int, max_depth: int) -> bool:
    return depth < max_depth


def _would_create_progression_cycle(reg: Registry, from_id: str, to_id: str) -> bool:
    """Return whether adding from_id -> to_id would close a progression cycle."""
    stack = [to_id]
    seen: set[str] = set()
    while stack:
        current = stack.pop()
        if current == from_id:
            return True
        if current in seen:
            continue
        seen.add(current)
        stack.extend(
            edge.to_id
            for edge in reg.outgoing(current)
            if edge.edge_type == EdgeType.progression
        )
    return False


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
    successors: List[ChildRef] = Field(description="4-10 immediate next options; empty if terminal.")

    @field_validator("successors")
    @classmethod
    def _cap(cls, v):
        # lenient: slice instead of rejecting an 11-item response
        return v[:12]


def expansion_prompt(node, trails: List[str], registry_slice: str) -> str:
    # registry_slice is the bounded duplicate-avoidance excerpt from
    # Registry.registry_block_for — the ER resolver downstream remains the real
    # dedup gate and still sees the full registry.
    trail_block = "\n".join(f"- {t}" for t in trails) or "- (root)"
    return f"""You are an expert career counsellor for the INDIAN education system, extending a
career graph. Nodes are stages/qualifications/exams/roles; edges mean "a realistic
immediate next step".

CURRENT NODE ({node.type.value}): "{node.title}"
Definition: {node.description}
Typical routes to it:
{trail_block}

REGISTRY EXCERPT (id | title) — the existing entries most relevant to this node
(its type cohort, its routes, and the nearest entries by meaning):
{registry_slice}

Task: list the IMMEDIATE next options after the current node in India (4-10; fewer if
the node is genuinely terminal).
Rules:
1. NEVER skip steps (Class 10 -> stream -> degree -> role, not Class 10 -> role).
2. If a successor already exists in the excerpt above, return its EXACT id in
   existing_id. Only use new_title when nothing shown means the same thing.
3. Concrete options only — never aggregate buckets ("Government Jobs (PSU|UPSC)"),
   never bare generics ("Ph.D.", "Higher Studies"); qualify by domain instead.
4. Entrance/qualifying exams are their own nodes (edge_type=exam_gate); prefer the
   registry's existing exam entries. If the CURRENT node is an exam, successors are
   what QUALIFYING admits you to (degrees, posts) — NEVER another exam someone could
   take instead.
4b. A move from a working role back into education (a degree/certification while
   working) is edge_type=lateral (upskilling), not progression.
5. Include the mainstream paths (confidence=core/common) and at most 2 niche ones.
6. is_terminal=true only for true endpoints (e.g. a senior-most role)."""


def load_frontier() -> dict:
    with open(FRONTIER_FILE, encoding="utf-8") as frontier_file:
        return json.load(frontier_file)


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
    queue = [
        q
        for q in fr["queue"]
        if q["id"] not in expanded and q["id"] in reg.nodes
    ]

    done = 0
    consecutive_failures = 0

    def checkpoint():
        # Registry and frontier must land together: resume drops queue ids missing
        # from the registry, so the frontier on disk must never be ahead of the
        # saved registry (an "expanded" node whose minted children were never
        # written would lose its whole subtree).
        reg.save()
        fr["queue"] = queue
        fr["expanded"] = sorted(expanded)
        save_frontier(fr)

    try:
        while True:
            next_index = next(
                (
                    index
                    for index, queued in enumerate(queue)
                    if should_expand(queued["depth"], args.max_depth)
                ),
                None,
            )
            if next_index is None:
                break
            item = queue.pop(next_index)
            nid, depth = item["id"], item["depth"]
            if nid in expanded or not should_expand(depth, args.max_depth) or nid not in reg.nodes:
                continue
            node = reg.nodes[nid]
            trail_ids = reg.shortest_trail(nid)
            trails = [" → ".join(reg.nodes[i].title for i in trail_ids)] if trail_ids else []
            registry_slice = reg.registry_block_for(
                nid, trail_ids=trail_ids, reg_vecs=resolver.reg_vecs)

            print(f"[depth {depth}] expanding {nid} ({node.title})")
            try:
                result = call_json(EXPAND_MODEL, expansion_prompt(node, trails, registry_slice), ExpansionResult)
                _process_successors(reg, resolver, node, nid, depth, result, queue, expanded, args)
            except RuntimeError as e:
                # isolate the failure: requeue this node at the back and move on, but
                # abort if the API looks down (several failures in a row). Re-expanding
                # a partially processed node is idempotent (cached call, deduped edges).
                consecutive_failures += 1
                print(f"   ! node failed ({e}); requeued")
                queue.append(item)
                if consecutive_failures >= 5:
                    print("aborting: 5 consecutive failures — API likely unavailable")
                    break
                continue
            consecutive_failures = 0

            expanded.add(nid)
            done += 1
            if done % SAVE_EVERY == 0:
                checkpoint()
            if args.limit and done >= args.limit:
                print(f"limit {args.limit} reached")
                break
    finally:
        # Flush the tail (and requeue churn) on every exit path, including
        # KeyboardInterrupt and crashes: at most SAVE_EVERY-1 nodes are re-done
        # on resume, and re-expansion is idempotent (see except branch above).
        checkpoint()

    pending_expandable = sum(
        should_expand(item["depth"], args.max_depth) for item in queue
    )
    retained_boundary = sum(item["depth"] == args.max_depth for item in queue)
    print(
        f"expanded {done} nodes; registry now {len(reg.nodes)} nodes / "
        f"{len(reg.edges)} edges; frontier {pending_expandable} pending expandable / "
        f"{retained_boundary} retained at depth {args.max_depth}"
    )


def _process_successors(reg, resolver, node, nid, depth, result, queue, expanded, args):
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

        target_type = reg.nodes[target_id].type
        # exam -> exam is never a successor relation ("you could also take RRB JE"
        # is an alternative, not a next step) — drop it.
        if node.type == NodeType.exam and target_type == NodeType.exam:
            print(f"   ! dropped exam->exam edge to {target_id}")
            continue

        etype = ref.edge_type
        # edge grammar: exam_gate iff one endpoint is an exam
        endpoint_is_exam = NodeType.exam in (target_type, node.type)
        if endpoint_is_exam:
            etype = EdgeType.exam_gate
        elif etype == EdgeType.exam_gate:
            etype = EdgeType.progression
        # working role -> education is upskilling, i.e. lateral: career graphs are
        # NOT DAGs (Web Developer -> MCA -> Web Developer is real); only the
        # progression subgraph stays acyclic, so back-to-education edges must not
        # carry the progression type.
        if (node.type in WORKING_TYPES and target_type in EDUCATION_TYPES
                and etype == EdgeType.progression):
            etype = EdgeType.lateral
        if (
            etype == EdgeType.progression
            and _would_create_progression_cycle(reg, nid, target_id)
        ):
            etype = EdgeType.lateral
        reg.add_edge(nid, target_id, etype, EXPAND_MODEL,
                     is_common_route=(ref.confidence != "niche"))

        if target_id not in expanded and all(q["id"] != target_id for q in queue):
            queue.append({"id": target_id, "depth": depth + 1})


if __name__ == "__main__":
    main()
