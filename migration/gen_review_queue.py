"""v2 Stage 1: generate migration/review_queue.md from the draft registry artifacts.

The design's human sign-off gates (§6.3, §8 Stage 1): all clusters >= 6 members, 100% of
judge-band merges, the terminal/children contradictions, the slug-spelling variant groups,
every 'unsure' verdict, and junk/artifact titles. The map stays a DRAFT until every section
here is reviewed; freezing = renaming registry_map.draft.json -> registry_map.json.
"""
import json
import os
from collections import defaultdict

from registry_lib import HERE, DecisionLog, load_tree, slug, tight

roles = json.load(open(os.path.join(HERE, "roles.draft.json")))
registry_map = json.load(open(os.path.join(HERE, "registry_map.draft.json")))
tree = load_tree()
log = DecisionLog()

lines = ["# Stage-1 review queue — sign off every section, then freeze the map",
         "",
         "Freezing = `mv registry_map.draft.json registry_map.json` (and same for roles/relations)",
         "after correcting anything below. Corrections: edit the draft JSONs directly, or fix",
         "`decisions.jsonl` (delete the bad line) and re-run `build_registry.py` (replays are free).",
         ""]

# 1. big clusters
big = {rid: r for rid, r in roles.items() if r["member_count"] >= 6}
lines += [f"## 1. Clusters with ≥6 merged paths — {len(big)} roles (sign off each)", ""]
for rid, r in sorted(big.items(), key=lambda kv: -kv[1]["member_count"]):
    lines.append(f"- [ ] **{r['title']}** (`{rid}`, {r['member_count']} paths, {r['node_type']})")
    if r["aliases"]:
        lines.append(f"      aliases: {', '.join(r['aliases'][:8])}{' …' if len(r['aliases']) > 8 else ''}")

# 2. judge-band merges (every same_role verdict from the fuzzy judge)
merges = [(rec["payload"], rec["value"]) for rec in map(json.loads, open(log.path))
          if rec["kind"] == "judge" and rec["value"].get("decision") == "same_role"]
lines += ["", f"## 2. Judge-approved cross-cluster merges — {len(merges)} (sign off each)", ""]
for (a, b), v in sorted(merges):
    lines.append(f"- [ ] `{a}`  ==  `{b}`  (rule {v.get('rule')})")

# 3. unsure verdicts
unsure = [(rec["payload"], rec["value"]) for rec in map(json.loads, open(log.path))
          if rec["kind"] == "judge" and rec["value"].get("decision") == "unsure"]
lines += ["", f"## 3. Judge 'unsure' → defaulted to distinct — {len(unsure)} (confirm or merge)", ""]
for (a, b), _v in sorted(unsure):
    lines.append(f"- [ ] `{a}`  vs  `{b}`")

# 4. terminal/children contradictions
lines += ["", "## 4. Terminal ↔ has-children contradictions (leafness is now derived — confirm)", ""]
n = 0
for rid, r in sorted(roles.items()):
    keys = r["origin_paths"]
    if any(tree[k].get("is_terminal") and not tree[k].get("children") for k in keys) and \
       any(tree[k].get("children") for k in keys):
        n += 1
        lines.append(f"- [ ] **{r['title']}** (`{rid}`): "
                     f"{sum(1 for k in keys if tree[k].get('is_terminal'))} terminal copies, "
                     f"{sum(1 for k in keys if tree[k].get('children'))} with children")
lines.insert(-n if n else len(lines), "")

# 5. slug-spelling variant groups (frozen-slug winner)
lines += ["", "## 5. Slug-spelling variants — frozen slug = canonical-primary segment (confirm winner)", ""]
for rid, r in sorted(roles.items()):
    seg_slugs = sorted({slug(k.split("/")[-1]) for k in r["origin_paths"]})
    if len(seg_slugs) > 1:
        lines.append(f"- [ ] `{rid}` wins; losing spellings: {[s for s in seg_slugs if s != rid]} "
                     f"(→ redirect entries)")

# 6. junk/artifact titles
lines += ["", "## 6. Junk / artifact titles (recommend: exclude or repair)", ""]
for rid, r in sorted(roles.items()):
    t = r["title"]
    if len(t) > 80 or t.count("|") >= 3:
        lines.append(f"- [ ] `{rid}`: {t!r} ({r['member_count']} paths)")

# 7. generic splits summary
splits = {rid: r for rid, r in roles.items() if r.get("split_from_generic")}
lines += ["", f"## 7. Context-inheriting splits — {len(splits)} roles minted from generic stages "
          "(spot-check a sample)", ""]
for rid, r in sorted(splits.items())[:40]:
    lines.append(f"- `{rid}` ({r['member_count']} paths)")
if len(splits) > 40:
    lines.append(f"- … and {len(splits) - 40} more")

with open(os.path.join(HERE, "review_queue.md"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")
print(f"review_queue.md written: {len(big)} big clusters, {len(merges)} judge merges, "
      f"{len(unsure)} unsure, {len(splits)} generic splits")
