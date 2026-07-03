"""v2 Stage 0: generate the ER evaluation candidate set from the frozen v1 tree.

Pairs where migration/RUBRIC.md is mechanically decisive get auto-labels; the judgment
band is emitted as needs_label for labeling (agent panel + human spot-check). Output:
migration/er_candidates.json. The merged, labeled artifact is migration/er_labels.json.

Read-only over the frozen snapshot; deterministic (sorted iteration, no RNG).
"""
import json
import os
import re
import difflib
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
TREE = os.path.join(HERE, "..", "career-tree", "data", "career_tree_data.json")
OUT = os.path.join(HERE, "er_candidates.json")

LEVEL_TOKENS = {
    "assistant", "associate", "senior", "junior", "lead", "chief", "principal",
    "deputy", "vice", "head", "b", "m", "ug", "pg", "dm", "md", "phd", "post",
}
AGGREGATE_HINTS = (
    "further studies", "higher studies", "job roles", "jobs after", "entry-level",
    "government jobs", "career options", "other ", "various ",
)


def slug(t: str) -> str:
    t = re.sub(r"[^a-z0-9]+", "-", t.lower())
    return re.sub(r"(^-|-$)+", "", t)


def tight(t: str) -> str:
    return slug(t).replace("-", "")


def toks(t: str) -> frozenset:
    return frozenset(slug(t).split("-"))


def strip_parens(t: str) -> str:
    return re.sub(r"\s*\([^)]*\)", "", t).strip()


def is_aggregate(title: str) -> bool:
    low = title.lower()
    return "|" in strip_parens(title) or any(h in low for h in AGGREGATE_HINTS)


def main():
    tree = json.load(open(TREE))

    # every distinct raw title with one example parent path for context
    context = {}
    for key, node in sorted(tree.items()):
        title = node["node_title"]
        parent = key.rsplit("/", 1)[0] if "/" in key else "(root)"
        context.setdefault(title, parent)
        for child in node.get("children", []):
            context.setdefault(child, key)

    titles = sorted(context)
    auto, needs = [], []
    seen = set()

    def emit(a, b, label, rule, note=""):
        pk = tuple(sorted((a, b)))
        if pk in seen or a == b:
            return
        seen.add(pk)
        rec = {
            "a": a, "b": b,
            "a_context": context[a], "b_context": context[b],
            "rule": rule, "note": note,
        }
        if label:
            rec["label"] = label
            auto.append(rec)
        else:
            needs.append(rec)

    # Rule 1: same tight slug, different raw string -> same_role
    by_tight = defaultdict(list)
    for t in titles:
        by_tight[tight(t)].append(t)
    for group in by_tight.values():
        for i, a in enumerate(group):
            for b in group[i + 1:]:
                emit(a, b, "same_role", 1)

    # Rule 2: same token multiset, different tight slug -> same_role
    by_toks = defaultdict(list)
    for t in titles:
        by_toks[toks(t)].append(t)
    for group in by_toks.values():
        reps = sorted({tight(t): t for t in group}.values())
        for i, a in enumerate(reps):
            for b in reps[i + 1:]:
                emit(a, b, "same_role", 2)

    # Rule 10 controls: aggregates never merge with their components
    aggregates = [t for t in titles if is_aggregate(t)]
    for agg in aggregates[:20]:
        inner = strip_parens(agg)
        parts = [p.strip() for p in re.split(r"[|,]", agg.replace(inner, "", 1)) if p.strip(" ()")]
        for part in parts[:1]:
            match = next((t for t in titles if tight(t) == tight(part)), None)
            if match:
                emit(agg, match, "distinct", 10, "aggregate vs component")

    # Rule 7: token sets differing only by level tokens -> distinct
    by_core = defaultdict(list)
    for t in titles:
        core = toks(t) - LEVEL_TOKENS
        if core:
            by_core[core].append(t)
    for group in by_core.values():
        reps = sorted({tight(t): t for t in group}.values())
        for i, a in enumerate(reps):
            for b in reps[i + 1:]:
                if toks(a) != toks(b):
                    emit(a, b, "distinct", 7, "level-token difference")

    # Rule 5/3/4 band: parenthetical families
    by_base = defaultdict(list)
    for t in titles:
        base = strip_parens(t)
        if base and base != t:
            by_base[tight(base)].append(t)
    for base_t, group in sorted(by_base.items(), key=lambda kv: -len(kv[1])):
        group = sorted(set(group))
        bare = next((t for t in titles if tight(t) == base_t), None)
        if bare and not is_aggregate(bare):
            for q in group[:4]:
                if not is_aggregate(q):
                    emit(bare, q, "specializes", 5, "bare vs qualified")
        # qualified-vs-qualified: judgment band (rule 3 merge vs rule 4 distinct)
        # round-robin: adjacent pairs only, so sampling spreads across families
        clean = [t for t in group if not is_aggregate(t)]
        for a, b in zip(clean, clean[1:]):
            emit(a, b, None, "3-or-4", "qualifier synonym vs different domain")

    # Fuzzy band: high-similarity pairs not caught above -> judgment
    uniq = sorted({tight(t): t for t in titles}.values())
    slugs = {t: slug(t) for t in uniq}
    for i, a in enumerate(uniq):
        sa = slugs[a]
        for b in uniq[i + 1:]:
            sb = slugs[b]
            if abs(len(sa) - len(sb)) > 8:
                continue
            if difflib.SequenceMatcher(None, sa, sb).ratio() >= 0.90:
                emit(a, b, None, "fuzzy", "high string similarity")

    # keep the needs_label band bounded, deterministic, and mixed across bands
    qual = [r for r in needs if r["rule"] == "3-or-4"][:180]
    fuzz = [r for r in needs if r["rule"] == "fuzzy"][:120]
    needs = qual + fuzz

    json.dump(
        {"generated_from": "v1-data-freeze snapshot", "auto": auto, "needs_label": needs},
        open(OUT, "w"), indent=1, ensure_ascii=False,
    )
    print(f"auto-labeled: {len(auto)}  needs_label: {len(needs)}")
    from collections import Counter
    print("auto by rule:", dict(Counter(r['rule'] for r in auto)))
    print("needs by band:", dict(Counter(r['rule'] for r in needs)))


if __name__ == "__main__":
    main()
