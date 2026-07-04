"""Stage 1 bootstrap: seed the registry from vocab.yaml + the curated exam table,
then embed every node for entity resolution. No generative LLM calls.

Run:  python pipeline/bootstrap.py
Idempotent — existing registry entries are kept.
"""
import json
import os

from lib import (Registry, Node, NodeType, EdgeType, Provenance, load_vocab,
                 embed_texts, today, atomic_write, FRONTIER_FILE, PIPE_DIR)

EXAMS_FILE = os.path.join(PIPE_DIR, "ground", "exams.json")


def er_text(n: Node) -> str:
    """Text embedded for ER: type + title + short definition (not the bare title —
    definitions disambiguate what names cannot)."""
    return f"{n.type.value}: {n.title} — {n.description[:160]}"


def main():
    reg = Registry()
    vocab = load_vocab()
    added = 0

    for seed in vocab["seeds"]:
        if seed["id"] in reg.nodes:
            continue
        reg.add_node(Node(
            id=seed["id"], type=NodeType(seed["type"]), title=seed["title"],
            aliases=seed.get("aliases", []),
            description=seed.get("description", "").strip(),
            prov=Provenance(model="human-seed", generated_at=today()),
        ))
        added += 1

    exams = json.load(open(EXAMS_FILE))["exams"]
    for key, ex in exams.items():
        nid = f"exam:{key}"
        if nid in reg.nodes:
            continue
        desc = f"{ex['name']} — {ex['level'].replace('_', ' ')} exam ({ex['field']}), conducted by {ex['conducting_body']}."
        if ex.get("notes"):
            desc += f" {ex['notes']}."
        reg.add_node(Node(
            id=nid, type=NodeType.exam, title=ex["name"], description=desc,
            prov=Provenance(model="curated-exam-table", generated_at=today()),
        ))
        added += 1

    for frm, to, etype in vocab.get("seed_edges", []):
        reg.add_edge(frm, to, EdgeType(etype), model="human-seed")

    reg.save()
    print(f"registry: {len(reg.nodes)} nodes (+{added}), {len(reg.edges)} edges")

    print("embedding registry for ER ...")
    embed_texts([er_text(n) for n in reg.nodes.values()])

    if not os.path.exists(FRONTIER_FILE):
        frontier = {"queue": [{"id": "school_stage:class-10", "depth": 0}], "expanded": []}
        atomic_write(FRONTIER_FILE, json.dumps(frontier, indent=1))
        print("frontier initialized at school_stage:class-10")


if __name__ == "__main__":
    main()
