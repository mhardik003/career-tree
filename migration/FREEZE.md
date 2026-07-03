# v1 DATA FREEZE — in effect since 2026-07-04

The v2 data-architecture migration (roles + edges + stable IDs) is underway.
Full design: `../../DATA_ARCHITECTURE_V2.md` (in `All Career Tree/`, outside both repos).

**While this file exists:**

- `generate_tree_gemini.py` and `generate_metadata_gemini.py` refuse to write —
  `career-tree/data/career_tree_data.json` and `metadata.json` are the frozen v1 snapshot
  that every migration artifact (registry map, redirects, parity expectations) is derived
  from. Writing to them mid-migration diverges the world from the snapshot.
- The private repo's review tool and `update_tree.sh` are likewise disabled/retired
  (see `../../career_tree_private/FREEZE.md`).
- The public suggest/edit APIs stay up; Supabase rows queue and are resolved by the
  delta pass at cutover (Stage 4).

**Snapshot (verified byte-identical across both repos at freeze time):**

| | |
|---|---|
| Date | 2026-07-04 |
| Public tag | `v1-data-freeze` = `8fc64ec` (work continues on branch `data_v2`) |
| Private tag | `v1-data-freeze` = `222e34e` |
| `career_tree_data.json` md5 | `1fc181645a14eab1cacee9067f399801` (2,703 nodes) |
| `metadata.json` md5 | `4dddde1dbb3a4dc035a671e274ac8bc1` (2,185 records) |

**Verify at any time:**

```bash
md5sum career-tree/data/career_tree_data.json career-tree/data/metadata.json
```

**Manual steps pending (user):**
1. Run `career_tree_private/supabase_schema_v2.sql` in the Supabase dashboard SQL editor.
2. Buy the custom domain and set it as primary on Vercel (SEO track, §5.3 step 1 —
   independent of the data work; the settle clock starts when it's done).

Stage tracker lives in `DATA_ARCHITECTURE_V2.md`. The v1 site remains buildable from the
`v1-data-freeze` tag until the migration closes. Delete this file only if the migration is
deliberately abandoned.
