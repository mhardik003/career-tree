"""One-off repair after the first core build (2026-07-04). Applies retroactively the
rules now enforced at generation time:
  1. collapse doubled whitespace in titles
  2. '|' in titles -> '/' (v1 artifact), old spelling kept as alias, needs_review=True
  3. drop exam->exam edges (alternatives masquerading as successors)
  4. retype working-role -> education 'progression' edges as 'lateral' (upskilling) —
     career graphs are legitimately cyclic through these; only the progression
     subgraph must stay acyclic
Idempotent. Run:  python pipeline/repair_20260704.py
"""
import re

from lib import Registry, NodeType, EdgeType

WORKING = {NodeType.job_role, NodeType.government_service, NodeType.entrepreneurship}
EDUCATION = {NodeType.degree, NodeType.diploma, NodeType.certification, NodeType.training}


def main():
    reg = Registry()
    fixed_titles = pipes = dropped = retyped = 0

    for n in reg.nodes.values():
        t = re.sub(r"\s+", " ", n.title).strip()
        if "|" in t:
            old = n.title
            t = re.sub(r"\s*\|\s*", "/", t)
            if old not in n.aliases:
                n.aliases.append(old)
            n.needs_review = True
            pipes += 1
        if t != n.title:
            n.title = t
            fixed_titles += 1

    for eid in list(reg.edges):
        e = reg.edges[eid]
        ft = reg.nodes[e.from_id].type if e.from_id in reg.nodes else None
        tt = reg.nodes[e.to_id].type if e.to_id in reg.nodes else None
        if ft == NodeType.exam and tt == NodeType.exam:
            reg.remove_edge(eid)
            dropped += 1
        elif ft in WORKING and tt in EDUCATION and e.edge_type == EdgeType.progression:
            # in-place retype is index-safe: _out/_in hold this same Edge object
            # and its endpoints don't change
            e.edge_type = EdgeType.lateral
            retyped += 1

    reg.save()
    print(f"titles fixed: {fixed_titles} (pipes: {pipes}); "
          f"exam->exam edges dropped: {dropped}; progression->lateral retyped: {retyped}")


if __name__ == "__main__":
    main()
