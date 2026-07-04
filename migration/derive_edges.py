"""v2 Stage 2 (mechanical part): derive edges.draft.json from tree adjacency + frozen map.

Per DATA_ARCHITECTURE_V2.md §7.3: the edge narrative ('how') is SEEDED from the child
origin-copy's v1 description — the one v1 artifact that WAS path-conditioned — with
content_status 'seeded' and full origin provenance. v1 metadata is never attributed to
edges (it was route-blind). Typed factual fields (exam IDs, numeric cost/duration) are
filled by the Stage-2 LLM pass, which upgrades content_status to 'generated'.

Runs on the FROZEN map by default; --draft to preview against the draft artifacts.
"""
import argparse
import json
import os
from collections import defaultdict

from registry_lib import HERE, canonical_primary, load_meta, load_tree

EDGE_TYPE_BY_TARGET = {
    "degree_or_stage": "degree_entry",
    "job": "job_entry",
    "exam_gateway": "exam",
    "category": "nav",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--draft", action="store_true",
                    help="use registry_map.draft.json / roles.draft.json")
    args = ap.parse_args()
    suffix = ".draft.json" if args.draft else ".json"
    rmap = json.load(open(os.path.join(HERE, "registry_map" + suffix)))
    roles = json.load(open(os.path.join(HERE, "roles" + suffix)))
    tree, meta = load_tree(), load_meta()

    origins = defaultdict(list)      # (from_role, to_role) -> [(parent_key, child_key)]
    dropped_self = 0
    for k, v in sorted(tree.items()):
        frm = rmap[k]
        for c in v.get("children", []):
            ck = f"{k}/{c}"
            to = rmap.get(ck)
            if to is None:
                continue
            if frm == to:
                dropped_self += 1
                continue
            origins[(frm, to)].append((k, ck))

    edges = {}
    for (frm, to), pairs in sorted(origins.items()):
        child_keys = [ck for _, ck in pairs if ck in tree]
        if child_keys:
            best = canonical_primary(child_keys, tree, meta)
            node = tree[best]
            how, seed_from = node.get("description"), best
            difficulty = node.get("difficulty_rating")
            duration = node.get("avg_duration_years")
            status = "seeded"
        else:  # ghost target: no crawled copy to seed from
            how, seed_from, difficulty, duration = None, None, None, None
            status = "stub"
        edges[f"{frm}->{to}"] = {
            "from": frm,
            "to": to,
            "edge_type": EDGE_TYPE_BY_TARGET[roles[to]["node_type"]],
            "how": how,
            "exams": None,
            "cost_inr": None,
            "duration_years": None,
            "seed_duration_years": duration,
            "difficulty_rating": difficulty,
            "content_status": status,
            "provenance": {
                "source": "migration",
                "seeded_from": seed_from,
                "origin_pairs": [list(p) for p in pairs],
            },
        }

    out = os.path.join(HERE, "edges" + suffix)
    json.dump(edges, open(out, "w"), indent=1, ensure_ascii=False)
    from collections import Counter
    print(f"edges: {len(edges)} (self-edges dropped after merge: {dropped_self})")
    print("by edge_type:", dict(Counter(e["edge_type"] for e in edges.values())))
    print("by content_status:", dict(Counter(e["content_status"] for e in edges.values())))
    multi = sum(1 for e in edges.values() if len(e["provenance"]["origin_pairs"]) > 1)
    print(f"edges with multiple v1 origins: {multi}")


if __name__ == "__main__":
    main()
