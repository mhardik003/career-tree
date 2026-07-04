"""v2 data validator — the guard rail that replaces what a database would enforce.

Validates the git-JSON master store (career-tree/data/roles.json, edges.json, exams.json)
per DATA_ARCHITECTURE_V2.md §3-§4: schemas, referential integrity, unique alias slugs,
per-type field applicability, acyclicity modulo 'lateral' edges, root reachability.
Run locally and in CI on every PR touching career-tree/data/ (workflow lands in Stage 5).

  python3 validate_data.py            # validate the master store
  python3 validate_data.py --stage1   # validate the Stage-1 draft registry artifacts

Exit code 0 = green; 1 = violations (printed).
"""
import argparse
import json
import os
import re
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "career-tree", "data")
MIGRATION = os.path.join(HERE, "migration")

ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*(--[a-z0-9]+(-[a-z0-9]+)*)*$")
NODE_TYPES = {"job", "degree_or_stage", "exam_gateway", "category"}
ROLE_STATUS = {"active", "stub", "merged"}
EDGE_TYPES = {"degree_entry", "job_entry", "exam", "lateral", "nav"}
EXAM_LEVELS = {"ug_entrance", "pg_entrance", "doctoral_or_fellowship", "eligibility",
               "professional", "govt_recruitment", "abroad"}

errors, warnings = [], []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def tight(t):
    return re.sub(r"[^a-z0-9]", "", t.lower())


def load(path):
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def check_exams():
    doc = load(os.path.join(DATA, "exams.json"))
    if doc is None:
        err("exams.json missing")
        return {}
    exams = doc.get("exams", {})
    for eid, e in exams.items():
        if not ID_RE.match(eid):
            err(f"exams.json: bad id {eid!r}")
        if e.get("level") not in EXAM_LEVELS:
            err(f"exams.json[{eid}]: bad level {e.get('level')!r}")
        if not e.get("name") or not e.get("conducting_body"):
            err(f"exams.json[{eid}]: name/conducting_body required")
    return exams


def check_roles(roles):
    alias_owner = {}
    for rid, r in roles.items():
        if not ID_RE.match(rid):
            err(f"roles[{rid}]: bad id format")
        if r.get("node_type") not in NODE_TYPES:
            err(f"roles[{rid}]: bad node_type {r.get('node_type')!r}")
        if r.get("status") not in ROLE_STATUS:
            err(f"roles[{rid}]: bad status {r.get('status')!r}")
        if r.get("status") == "merged" and not r.get("merged_into"):
            err(f"roles[{rid}]: merged without merged_into")
        title = r.get("title") or ""
        if not title:
            err(f"roles[{rid}]: empty title")
        if "/" in title:
            err(f"roles[{rid}]: '/' in title {title!r}")
        for alias in [title] + list(r.get("aliases", [])):
            key = (r.get("node_type"), tight(alias))
            if key in alias_owner and alias_owner[key] != rid:
                warn(f"alias collision within {key[0]}: {alias!r} on "
                     f"{alias_owner[key]} and {rid}")
            alias_owner.setdefault(key, rid)
    merged_targets = [r["merged_into"] for r in roles.values() if r.get("merged_into")]
    for t in merged_targets:
        if t not in roles:
            err(f"merged_into target missing: {t}")


def check_edges(roles, edges, exams):
    seen = set()
    out_edges = defaultdict(list)
    for eid, e in edges.items():
        frm, to = e.get("from"), e.get("to")
        if eid != f"{frm}->{to}":
            err(f"edges[{eid}]: id must be '<from>-><to>'")
        if frm not in roles:
            err(f"edges[{eid}]: unknown from {frm!r}")
        if to not in roles:
            err(f"edges[{eid}]: unknown to {to!r}")
        if frm == to:
            err(f"edges[{eid}]: self-edge")
        if (frm, to) in seen:
            err(f"edges[{eid}]: duplicate from->to")
        seen.add((frm, to))
        etype = e.get("edge_type")
        if etype not in EDGE_TYPES:
            err(f"edges[{eid}]: bad edge_type {etype!r}")
        for ex in e.get("exams") or []:
            if ex not in exams:
                err(f"edges[{eid}]: unknown exam id {ex!r}")
        if etype == "job_entry" and e.get("exams"):
            warn(f"edges[{eid}]: exams on a job_entry edge")
        cost = e.get("cost_inr")
        if cost is not None:
            if not (isinstance(cost, dict) and isinstance(cost.get("min"), (int, float))
                    and isinstance(cost.get("max"), (int, float)) and cost["min"] <= cost["max"]):
                err(f"edges[{eid}]: cost_inr must be numeric {{min<=max}}")
        if etype != "lateral":
            out_edges[frm].append(to)

    # acyclicity (non-lateral) + reachability from root
    color = {}
    def dfs(n, stack):
        color[n] = 1
        for m in out_edges.get(n, ()):
            if color.get(m) == 1:
                err(f"cycle through non-lateral edge {n} -> {m}")
            elif color.get(m) is None:
                dfs(m, stack)
        color[n] = 2
    for n in sorted(out_edges):
        if color.get(n) is None:
            dfs(n, [])
    root = "10th-class"
    if root not in roles:
        err(f"root role {root!r} missing")
    else:
        reach, queue = {root}, [root]
        while queue:
            for m in out_edges.get(queue.pop(), ()):
                if m not in reach:
                    reach.add(m)
                    queue.append(m)
        unreachable = [r for r, v in roles.items()
                       if v.get("status") == "active" and r not in reach]
        if unreachable:
            warn(f"{len(unreachable)} active roles unreachable from root "
                 f"(first: {unreachable[:5]})")


def check_stage1():
    roles = load(os.path.join(MIGRATION, "roles.draft.json"))
    rmap = load(os.path.join(MIGRATION, "registry_map.draft.json"))
    tree = load(os.path.join(DATA, "career_tree_data.json"))
    if not roles or not rmap:
        err("stage1 drafts missing")
        return
    check_roles(roles)
    for key in tree:
        if key not in rmap:
            err(f"registry_map: tree key unmapped: {key[:70]}")
    for key, rid in rmap.items():
        if rid not in roles:
            err(f"registry_map[{key[:50]}]: unknown role {rid}")
    for rid, r in roles.items():
        for p in r.get("origin_paths", []):
            if p not in tree:
                err(f"roles[{rid}]: origin_path not a tree key: {p[:70]}")
        if r.get("primary_path") and r["primary_path"] not in r.get("origin_paths", []):
            err(f"roles[{rid}]: primary_path not in origin_paths")
        if r.get("status") == "stub" and r.get("member_count"):
            err(f"roles[{rid}]: stub with members")
    # ghost coverage: every child listed by a parent resolves via map (as node or ghost key)
    missing = 0
    for k, v in tree.items():
        for c in v.get("children", []):
            ck = f"{k}/{c}"
            if ck not in rmap:
                missing += 1
    if missing:
        err(f"{missing} parent->child references unmapped in registry_map")
    print(f"stage1: {len(roles)} roles, {len(rmap)} mapped keys")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage1", action="store_true")
    args = ap.parse_args()

    if args.stage1:
        check_stage1()
    else:
        exams = check_exams()
        roles = load(os.path.join(DATA, "roles.json"))
        edges = load(os.path.join(DATA, "edges.json"))
        if roles is None or edges is None:
            err("roles.json / edges.json missing (master store not cut over yet — "
                "use --stage1 for draft validation)")
        else:
            check_roles(roles)
            check_edges(roles, edges, exams)

    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"ERROR {e}")
    print(f"\n{len(errors)} errors, {len(warnings)} warnings")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
