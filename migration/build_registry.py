"""v2 Stage 1: build the draft role registry from the frozen v1 tree.

Pipeline (DATA_ARCHITECTURE_V2.md §6, §8 Stage 1):
  1. mechanical clustering  — tight-slug + token-multiset union (rubric rules 1-2)
  2. classify               — node_type + context_inheriting per cluster rep (Gemini Flash, batched)
  3. qualifier families     — per paren-family synonym grouping (Gemini Pro; rules 3-5)
  4. residual fuzzy judge   — cross-family pairs, token_set_ratio >= 85 (Gemini Pro; batched)
  5. generic splits         — context-inheriting stages split by parent role (rule 6)
  6. mint                   — frozen slugs (canonical-primary segment), draft artifacts

Every LLM decision goes through DecisionLog (replay-not-redecide): re-runs are free and
deterministic. Outputs are DRAFTS until human sign-off freezes them:
  roles.draft.json, registry_map.draft.json, relations.draft.json, review_queue.md

Usage: python3 build_registry.py [--steps classify,family,fuzzy,mint] [--dry-run]
"""
import argparse
import json
import os
import time
from collections import Counter, defaultdict

import numpy as np
from rapidfuzz import process, fuzz

from registry_lib import (
    HERE, DecisionLog, canonical_primary, gemini_client, generate_json,
    load_meta, load_tree, slug, strip_parens, tight, toks,
)

FLASH, PRO = "gemini-2.5-flash", "gemini-2.5-pro"
FUZZY_THRESHOLD = 85          # tuned on er_labels.json (same_role recall .96; misses are
                              # acceptable under-merges, fixable later as alias+redirect)
CLASSIFY_BATCH, FUZZY_BATCH = 20, 10

CLASSIFY_SCHEMA = {
    "type": "object",
    "properties": {"items": {"type": "array", "items": {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "node_type": {"type": "string", "enum": ["job", "degree_or_stage", "exam_gateway", "category"]},
            "context_inheriting": {"type": "boolean"},
        },
        "required": ["title", "node_type", "context_inheriting"],
    }}},
    "required": ["items"],
}

FAMILY_SCHEMA = {
    "type": "object",
    "properties": {"groups": {"type": "array", "items": {
        "type": "object",
        "properties": {
            "normalized_qualifier": {"type": "string"},
            "members": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["normalized_qualifier", "members"],
    }}},
    "required": ["groups"],
}

JUDGE_SCHEMA = {
    "type": "object",
    "properties": {"verdicts": {"type": "array", "items": {
        "type": "object",
        "properties": {
            "pair_id": {"type": "integer"},
            "decision": {"type": "string", "enum": ["same_role", "distinct", "specializes", "unsure"]},
            "rule": {"type": "integer"},
        },
        "required": ["pair_id", "decision", "rule"],
    }}},
    "required": ["verdicts"],
}

RUBRIC_SHORT = """Decide if two career-tree titles denote the SAME role (Indian education context).
Rules, first match wins; when unsure prefer distinct (under-merge policy):
1-2. formatting/punctuation/word-order variants of the same words -> same_role
3. same base, SYNONYM qualifiers ((Govt.)/(Government)/(e.g., CSIR, DRDO)) -> same_role
4. same base, DIFFERENT domains ((Government) vs (Pharma)) -> distinct
5. bare generic vs domain-qualified ("Assistant Professor" vs "Assistant Professor (Law)") -> specializes
6. bare academic stages under different parent domains -> distinct
7. different level (Assistant/Associate/Full, B.Sc/M.Sc, Junior/Senior, DM/MD) -> distinct
8. plural/spelling/dot variants -> same_role
9. unambiguous abbreviation-expansion or industry synonyms (Software Developer ~ Software Development Engineer) -> same_role
10. aggregates ("Further Studies (MBA|LLB)") -> distinct from everything
11. a JOB vs a FIELD/DEGREE sharing words (Aerospace Engineer vs Aerospace Engineering) -> distinct
12. ambiguous -> unsure"""


class UnionFind:
    def __init__(self):
        self.parent = {}

    def find(self, x):
        p = self.parent
        while p.get(x, x) != x:
            p[x] = p.get(p[x], p[x])
            x = p[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[max(ra, rb)] = min(ra, rb)


def words_of(t):
    return " ".join(slug(t).split("-"))


def collect(tree):
    """title -> sorted list of instances; instance = real path key or ghost pseudo-key."""
    instances = defaultdict(list)
    for k, v in sorted(tree.items()):
        instances[v["node_title"]].append(("node", k))
        for c in v.get("children", []):
            child_key = f"{k}/{c}"
            if child_key not in tree:
                instances[c].append(("ghost", child_key))
    return instances


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--steps", default="classify,family,fuzzy,mint")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    steps = set(args.steps.split(","))

    tree, meta = load_tree(), load_meta()
    log = DecisionLog()
    client = None if args.dry_run else gemini_client()

    instances = collect(tree)
    names = sorted(instances)
    uf = UnionFind()
    by_tight, by_toks = defaultdict(list), defaultdict(list)
    for t in names:
        by_tight[tight(t)].append(t)
        by_toks[toks(t)].append(t)
    for grp in list(by_tight.values()) + list(by_toks.values()):
        for other in grp[1:]:
            uf.union(grp[0], other)

    def reps():
        return sorted({uf.find(t) for t in names})

    context_of = {t: instances[t][0][1] for t in names}

    # ---- classify --------------------------------------------------------
    classification = {}
    if "classify" in steps:
        todo = [r for r in reps() if log.get("classify", r) is None]
        print(f"[classify] {len(reps())} cluster reps, {len(todo)} to classify")
        for i in range(0, len(todo), CLASSIFY_BATCH):
            batch = todo[i:i + CLASSIFY_BATCH]
            if args.dry_run:
                continue
            payload = [{"title": t, "example_path": " / ".join(context_of[t].split("/")[-3:])}
                       for t in batch]
            prompt = f"""Classify each career-tree node title (Indian education system).
node_type: job (an occupation/role someone holds) | degree_or_stage (degree, stream, study stage)
| exam_gateway (the node IS an exam/selection stage, e.g. "UPSC Civil Services", "CA Foundation")
| category (aggregate/disjunction navigation node, e.g. "Further Studies (MBA|LLB)", "Government Jobs (PSU|UPSC|State)").
context_inheriting: true ONLY for degree_or_stage titles that do NOT name their field and inherit
it from the path (bare "Ph.D.", "PhD Abroad", "Master's Degree", "Higher Studies") — their onward
options depend on the unnamed field. Titles that name the field ("Ph.D. in Law") are false. Jobs are always false.
Return one item per input title, exact same title strings.
INPUT: {json.dumps(payload, ensure_ascii=False)}"""
            out = generate_json(client, FLASH, prompt, CLASSIFY_SCHEMA)
            got = {it["title"]: it for it in out.get("items", [])}
            for t in batch:
                it = got.get(t)
                if it:
                    log.put("classify", t, {"node_type": it["node_type"],
                                            "context_inheriting": it["context_inheriting"]})
            print(f"  classified {min(i + CLASSIFY_BATCH, len(todo))}/{len(todo)}")
            time.sleep(0.4)
    for r in reps():
        classification[r] = log.get("classify", r) or {"node_type": "job", "context_inheriting": False}

    # ---- qualifier families (rules 3-5) ---------------------------------
    relations = []
    if "family" in steps:
        fams = defaultdict(set)
        for r in reps():
            base = strip_parens(r)
            if base and base != r:
                fams[tight(base)].add(r)
        multi = {b: sorted(v) for b, v in fams.items() if len(v) > 1}
        print(f"[family] {len(multi)} qualifier families")
        for base_t, variants in sorted(multi.items()):
            cached = log.get("family", variants)
            if cached is None and not args.dry_run:
                bare = next((t for t in names if tight(t) == base_t), strip_parens(variants[0]))
                prompt = f"""Career-tree qualifier normalization (Indian education context).
Base role/stage: "{bare}". Below are title variants of the form base + parenthetical qualifier.
Group them into synonym sets: variants whose qualifiers MEAN THE SAME THING (formatting,
abbreviation, example-lists of the same sector: "(Govt.)" = "(Government)" = "(e.g., CSIR, DRDO)")
go in one group with a clean normalized_qualifier (controlled vocabulary: Government, Industry,
Academia, Abroad, or the field name e.g. Pharma, Biotech, Law). Variants with genuinely different
domains go in DIFFERENT groups. Never merge different domains; when unsure keep separate.
VARIANTS: {json.dumps(variants, ensure_ascii=False)}
Every variant must appear in exactly one group."""
                out = generate_json(client, PRO, prompt, FAMILY_SCHEMA)
                cached = out.get("groups", [])
                log.put("family", variants, cached)
                time.sleep(0.4)
            for grp in cached or []:
                members = [m for m in grp.get("members", []) if m in instances]
                for other in members[1:]:
                    uf.union(members[0], other)
        # rule 5: bare base specializes relations (no LLM needed)
        for base_t, variants in sorted(fams.items()):
            bare = next((t for t in names if tight(t) == base_t), None)
            if bare:
                for v in sorted(variants):
                    relations.append({"generic": uf.find(bare), "specialized": uf.find(v)})

    # ---- residual fuzzy judge -------------------------------------------
    if "fuzzy" in steps:
        rep_list = reps()
        base_of = {r: tight(strip_parens(r)) or tight(r) for r in rep_list}
        tok_of = {r: toks(r) for r in rep_list}
        word_list = [words_of(r) for r in rep_list]
        M = process.cdist(word_list, word_list, scorer=fuzz.token_set_ratio,
                          dtype=np.uint8, workers=-1)
        iu = np.triu_indices(len(rep_list), 1)
        pairs = []
        for idx in np.where(M[iu] >= FUZZY_THRESHOLD)[0]:
            a, b = rep_list[iu[0][idx]], rep_list[iu[1][idx]]
            if base_of[a] == base_of[b]:
                continue
            ta, tb = tok_of[a], tok_of[b]
            if ta <= tb or tb <= ta:
                continue
            if classification[a]["node_type"] == "category" or classification[b]["node_type"] == "category":
                continue
            pairs.append((a, b))
        pairs.sort()
        todo = [p for p in pairs if log.get("judge", list(p)) is None]
        print(f"[fuzzy] {len(pairs)} candidate pairs >= {FUZZY_THRESHOLD}, {len(todo)} to judge")
        for i in range(0, len(todo), FUZZY_BATCH):
            batch = todo[i:i + FUZZY_BATCH]
            if args.dry_run:
                continue
            payload = [{"pair_id": j,
                        "a": a, "a_type": classification[a]["node_type"],
                        "a_path": " / ".join(context_of[a].split("/")[-3:]),
                        "b": b, "b_type": classification[b]["node_type"],
                        "b_path": " / ".join(context_of[b].split("/")[-3:])}
                       for j, (a, b) in enumerate(batch)]
            prompt = f"{RUBRIC_SHORT}\n\nJudge every pair. PAIRS: {json.dumps(payload, ensure_ascii=False)}"
            out = generate_json(client, PRO, prompt, JUDGE_SCHEMA)
            got = {v["pair_id"]: v for v in out.get("verdicts", [])}
            for j, (a, b) in enumerate(batch):
                v = got.get(j)
                if v:
                    log.put("judge", [a, b], {"decision": v["decision"], "rule": v["rule"]})
            print(f"  judged {min(i + FUZZY_BATCH, len(todo))}/{len(todo)}")
            time.sleep(0.4)
        for a, b in pairs:
            v = log.get("judge", [a, b])
            if v and v["decision"] == "same_role":
                if classification[uf.find(a)]["node_type"] == classification[uf.find(b)]["node_type"]:
                    uf.union(a, b)
            elif v and v["decision"] == "specializes":
                relations.append({"generic": uf.find(a), "specialized": uf.find(b), "judge": True})

    if "mint" not in steps:
        print("stopping before mint (per --steps)")
        return

    # ---- generic splits + role_of for every instance ---------------------
    cluster_of = {t: uf.find(t) for t in names}
    members_by_cluster = defaultdict(list)
    for t in names:
        for kind, key in instances[t]:
            members_by_cluster[cluster_of[t]].append((kind, key))

    role_of = {}     # instance key -> role token (cluster rep or (rep, parent_role))
    def resolve(key, kind, title):
        cl = cluster_of[title]
        cls = classification[cl]
        if cls["context_inheriting"] and cls["node_type"] == "degree_or_stage" and "/" in key:
            parent_key = key.rsplit("/", 1)[0]
            parent_role = role_of.get(parent_key)
            if parent_role is not None:
                return (cl, parent_role)
        return cl

    all_instances = sorted(
        ((kind, key, t) for t in names for kind, key in instances[t]),
        key=lambda x: (x[1].count("/"), x[1]),
    )
    for kind, key, title in all_instances:
        role_of[key] = resolve(key, kind, title)

    # ---- mint frozen slugs & emit ----------------------------------------
    by_role = defaultdict(lambda: {"node": [], "ghost": []})
    title_of_key = {}
    for kind, key, title in all_instances:
        by_role[role_of[key]][kind].append(key)
        title_of_key[key] = title

    parent_slug_cache = {}
    roles, role_ids = {}, {}

    def mint(role_token):
        if role_token in role_ids:
            return role_ids[role_token]
        info = by_role[role_token]
        node_keys = info["node"]
        if node_keys:
            primary = canonical_primary(node_keys, tree, meta)
            base_slug = slug(primary.split("/")[-1])
        else:
            primary = None
            base_slug = slug(title_of_key[sorted(info["ghost"])[0]].split("/")[-1])
        if isinstance(role_token, tuple):
            parent_role = role_token[1]
            pslug = parent_slug_cache.get(parent_role) or mint(parent_role)
            rid = f"{base_slug}--{pslug}"
        else:
            rid = base_slug
        # deterministic collision suffix
        final = rid
        n = 2
        while final in roles and roles[final]["_token"] != role_token:
            final = f"{rid}-{n}"
            n += 1
        role_ids[role_token] = final
        parent_slug_cache[role_token] = final
        cl = role_token[0] if isinstance(role_token, tuple) else role_token
        titles_here = sorted({title_of_key[k] for ks in info.values() for k in ks})
        primary_title = tree[primary]["node_title"] if primary else titles_here[0]
        roles[final] = {
            "_token": role_token,
            "title": primary_title,
            "aliases": [t for t in titles_here if t != primary_title],
            "node_type": classification[cl]["node_type"],
            "context_inheriting": classification[cl]["context_inheriting"],
            "split_from_generic": isinstance(role_token, tuple),
            "status": "active" if info["node"] else "stub",
            "member_count": len(info["node"]),
            "primary_path": primary,
            "origin_paths": sorted(info["node"]),
            "ghost_refs": sorted(info["ghost"]),
        }
        return final

    for token in sorted(by_role, key=lambda t: (isinstance(t, tuple), str(t))):
        mint(token)
    for r in roles.values():
        r.pop("_token")

    registry_map = {key: role_ids[role_of[key]] for key in sorted(role_of)}
    rel_out = sorted({(role_ids.get(uf.find(x["generic"])), role_ids.get(uf.find(x["specialized"])))
                      for x in relations if uf.find(x["generic"]) != uf.find(x["specialized"])})
    rel_out = [{"generic": g, "specialized": s, "rel": "specializes"}
               for g, s in rel_out if g and s and g != s]

    json.dump(roles, open(os.path.join(HERE, "roles.draft.json"), "w"),
              indent=1, ensure_ascii=False)
    json.dump(registry_map, open(os.path.join(HERE, "registry_map.draft.json"), "w"),
              indent=1, ensure_ascii=False)
    json.dump(rel_out, open(os.path.join(HERE, "relations.draft.json"), "w"),
              indent=1, ensure_ascii=False)

    active = [r for r in roles.values() if r["status"] == "active"]
    stubs = [r for r in roles.values() if r["status"] == "stub"]
    print(f"\nroles: {len(roles)} ({len(active)} active, {len(stubs)} stubs)")
    print("node_type:", dict(Counter(r["node_type"] for r in roles.values())))
    print(f"splits from generics: {sum(r['split_from_generic'] for r in roles.values())}")
    print(f"registry_map entries: {len(registry_map)} "
          f"({sum(1 for k in registry_map if k in tree)} tree keys + ghosts)")
    print(f"specializes relations: {len(rel_out)}")
    big = sorted((r for r in active), key=lambda r: -r["member_count"])[:10]
    for r in big:
        print(f"   {r['member_count']:3d} paths -> {r['title']!r}")


if __name__ == "__main__":
    main()
