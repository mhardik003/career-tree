"""Structural lint — free, deterministic, build-blocking. Run after any registry write.

Checks: id format/uniqueness handled by Registry load; edge endpoints resolve; DAG is
acyclic; edge grammar (exam_gate iff an endpoint is an exam); titles clean; no two
distinct same-type nodes share a slug-identical title; every node reachable from root.
Exit code 1 on any failure.
"""
import argparse
import json
import os
import re
import sys
from collections import defaultdict

from lib import (
    FRONTIER_FILE,
    PIPE_DIR,
    EdgeType,
    NodeType,
    Registry,
    read_jsonl,
    slugify,
)

ROOT = "school_stage:class-10"
ENRICHMENT_FAILURE_FILE = os.path.join(
    PIPE_DIR, "ledger", "enrichment_failures.jsonl"
)


def _reachable_ids(reg: Registry) -> set[str]:
    outgoing = defaultdict(list)
    for edge in reg.edges.values():
        outgoing[edge.from_id].append(edge.to_id)
    seen = {ROOT} if ROOT in reg.nodes else set()
    stack = list(seen)
    while stack:
        current = stack.pop()
        for next_id in outgoing[current]:
            if next_id not in seen:
                seen.add(next_id)
                stack.append(next_id)
    return seen


def release_errors(
    reg: Registry,
    frontier: dict,
    failure_rows: list[dict],
) -> list[str]:
    errors: list[str] = []
    if ROOT not in reg.nodes:
        errors.append(f"configured root absent: {ROOT}")
    for node in reg.nodes.values():
        if node.facts is None:
            errors.append(f"{node.id}: missing facts")
            continue
        for fact in node.facts.quick_facts:
            if not fact.source_urls:
                errors.append(f"{node.id}: quick fact missing sources")
        for section in node.facts.sections:
            if not section.source_urls:
                errors.append(f"{node.id}: section {section.key} missing sources")

    pending = [
        item for item in frontier.get("queue", []) if item.get("depth", 0) < 4
    ]
    if pending:
        errors.append(f"frontier has {len(pending)} item(s) below depth 4")
    if failure_rows:
        errors.append(
            f"enrichment failure ledger has {len(failure_rows)} unresolved record(s)"
        )

    reachable = _reachable_ids(reg)
    orphans = [
        node_id
        for node_id in reg.nodes
        if node_id not in reachable and not node_id.startswith("exam:")
    ]
    if orphans:
        errors.append(
            f"{len(orphans)} non-exam nodes unreachable from root: {orphans[:8]}"
        )
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--release", action="store_true")
    args = parser.parse_args(argv)
    reg = Registry()
    errors: list[str] = []
    warns: list[str] = []

    for e in reg.edges.values():
        if e.from_id not in reg.nodes:
            errors.append(f"edge {e.id}: unknown from_id")
        if e.to_id not in reg.nodes:
            errors.append(f"edge {e.id}: unknown to_id")
        if e.from_id in reg.nodes and e.to_id in reg.nodes:
            is_exam = NodeType.exam in (reg.nodes[e.from_id].type, reg.nodes[e.to_id].type)
            if is_exam and e.edge_type != EdgeType.exam_gate:
                errors.append(f"edge {e.id}: touches an exam but type={e.edge_type.value}")
            if not is_exam and e.edge_type == EdgeType.exam_gate:
                errors.append(f"edge {e.id}: exam_gate without an exam endpoint")

    # exam -> exam successors are meaningless (alternatives, not next steps)
    for e in reg.edges.values():
        if (e.from_id in reg.nodes and e.to_id in reg.nodes
                and reg.nodes[e.from_id].type == NodeType.exam
                and reg.nodes[e.to_id].type == NodeType.exam):
            errors.append(f"edge {e.id}: exam->exam")

    # Cycle check on the PROGRESSION subgraph only. The full graph is legitimately
    # cyclic (upskilling: Web Developer -> MCA -> Web Developer); those edges are
    # typed lateral/exam_gate and exempt. The education ladder itself must not loop.
    color = {nid: 0 for nid in reg.nodes}
    out = defaultdict(list)
    for e in reg.edges.values():
        if e.edge_type == EdgeType.progression:
            out[e.from_id].append(e.to_id)
    for start in reg.nodes:
        if color[start]:
            continue
        stack = [(start, iter(out[start]))]
        color[start] = 1
        while stack:
            nid, it = stack[-1]
            for nxt in it:
                if color.get(nxt, 0) == 1:
                    errors.append(f"cycle involving {nid} -> {nxt}")
                elif color.get(nxt, 0) == 0:
                    color[nxt] = 1
                    stack.append((nxt, iter(out[nxt])))
                    break
            else:
                color[nid] = 2
                stack.pop()

    for n in reg.nodes.values():
        # v2 titles are display-only (IDs are the identity); '/' is legitimate
        # ("UI/UX Designer"), '|' is a v1 aggregate artifact and banned.
        if "|" in n.title:
            errors.append(f"{n.id}: '|' in title {n.title!r} (aggregates are banned in v2)")
        if re.search(r"\s{2,}", n.title):
            warns.append(f"{n.id}: doubled spaces in title")

    by_slug = defaultdict(list)
    for n in reg.nodes.values():
        by_slug[(n.type.value, slugify(n.title))].append(n.id)
    for (t, s), ids in by_slug.items():
        if len(ids) > 1:
            errors.append(f"same-type slug collision {t}:{s} -> {ids}")

    # reachability from root (over ALL edge types)
    seen = _reachable_ids(reg)
    orphans = [nid for nid in reg.nodes if nid not in seen]
    # unexpanded exam-table entries are expected orphans until something links them
    real_orphans = [o for o in orphans if not o.startswith("exam:")]
    if real_orphans and not args.release:
        warns.append(f"{len(real_orphans)} non-exam nodes unreachable from root: {real_orphans[:8]}")

    if args.release:
        try:
            with open(FRONTIER_FILE, encoding="utf-8") as frontier_file:
                frontier = json.load(frontier_file)
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"cannot read frontier: {exc}")
            frontier = {}
        errors.extend(
            release_errors(
                reg,
                frontier,
                read_jsonl(ENRICHMENT_FAILURE_FILE),
            )
        )

    for w in warns:
        print(f"WARN  {w}")
    for e in errors:
        print(f"ERROR {e}")
    print(f"lint: {len(reg.nodes)} nodes, {len(reg.edges)} edges, "
          f"{len(errors)} errors, {len(warns)} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
