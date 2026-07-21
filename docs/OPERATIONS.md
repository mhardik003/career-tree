# Career Tree — Operations Manual

The operational deep-dive for Career Tree V2: the V1→V2 contract changes, the
stable-ID API contracts, the destructive Supabase cutover, the private moderation
lifecycle, and the production release checklist. For the project introduction,
architecture, data pipeline, and local setup, see the root
[`README.md`](../README.md).

> **Release state:** this manual describes the committed V2 implementation and the
> release procedure. It does not by itself mean that the destructive live Supabase
> migration has been applied or that the release branch has been pushed. Both
> require the production gates below.

## V1 and V2

| Area | V1 | V2 |
| --- | --- | --- |
| Identity | A title's position in a nested path acted as identity. The same entity could appear at several paths. | An immutable `<type>:<slug>` ID is identity. Titles and aliases are display/search data, not identity. |
| Graph model | A rooted, nested tree duplicated shared destinations and encoded context in their paths. | A typed directed graph stores each entity once and connects it to every valid parent. Progression, exam-gate, and lateral relationships are explicit. |
| Source of truth | The web-serving tree JSON and separate metadata JSON were edited/generated directly. | [`pipeline/registry/nodes.jsonl`](../pipeline/registry/nodes.jsonl) and [`pipeline/registry/edges.jsonl`](../pipeline/registry/edges.jsonl) are canonical; the frontend snapshot is generated. |
| Generation | Top-level crawler/enrichment scripts wrote served data in place. | A staged OpenAI pipeline expands, resolves, enriches, audits, lints, and exports canonical records. |
| Entity resolution | Path position and local slug checks could not resolve duplicates across the whole dataset. | Exact normalized identity is followed by an embedding shortlist and a rubric-constrained judge. The standing preference is to under-merge. |
| Facts and citations | Metadata coverage was separate and incomplete; release did not require cited sections for every node. | Every production node has type-specific facts, and every quick fact and article section has public citations. |
| Production routes | One catch-all path combined identity and navigation context. | Canonical guides use `/careers/<type>/<slug>`; contextual exploration uses `/explore/<type>/<slug>?from=<stable-id>`. |
| Stable-ID submissions | Suggestion and edit payloads referred to path-derived keys and could supply edit originals. | Suggestions use `parentNodeId`; edits use `targetNodeId`, and the server derives original node data from the graph snapshot. |
| Map and SEO | A path-expanded map could show duplicate visual entities, while SEO needed a primary-path workaround. | `/map` renders one visual node per stable ID. Every guide is canonical, indexable, cited, and structured; explorers are `noindex` and canonicalize to guides. |

The V1 routes, data files, and generation scripts are intentionally absent from the
production branch, as is the former `/v2` preview surface. Do not restore them as
compatibility layers or copy their path-based contracts into V2.

## Canonical graph contract — details beyond the README

Every node ID has the stable form `<type>:<slug>`, for example `degree:bca`. The
prefix must equal the node's `type`; the slug is lowercase ASCII words joined by
hyphens. IDs are minted once and preserved. Renaming a title or adding an alias does
not change identity.

An edge ID is `<from_id>-><to_id>`, for example `degree:bca->degree:mba`, and both
endpoints must resolve to canonical nodes. Any edge that touches an exam must be
`exam_gate`, and `exam_gate` must touch an exam. Exam-to-exam edges are invalid.
The `progression` subgraph must be acyclic. The complete graph may contain a cycle
through `lateral` or `exam_gate` relationships because retraining and career changes
can legitimately lead back to an earlier kind of opportunity. Route rendering never
repeats a node within one displayed route.

Each node and edge carries creation provenance: model, prompt version, generation
date, optional verification date, and source URLs. Each node's `facts` object carries
separate enrichment provenance, `last_reviewed`, cited quick facts, cited article
sections, and useful links. Creation provenance answers how the graph record arose;
fact provenance answers how its public guide was researched.

## Stable-ID API contracts

Suggestion requests contain exactly:

```json
{
  "parentNodeId": "degree:bca",
  "title": "Example successor",
  "description": "A concise explanation of the proposed route."
}
```

Edit requests contain exactly:

```json
{
  "targetNodeId": "degree:bca",
  "proposedData": {
    "title": "Bachelor of Computer Applications",
    "description": "A revised, source-ready description of the degree.",
    "aliases": ["BCA"]
  }
}
```

Both schemas reject unknown fields and malformed stable IDs. The server checks that
the parent or target exists in the committed graph. Suggestions also reject an
already-existing child title. For edits, the client cannot choose the stored
original: the route handler derives `original_data` from the snapshot, compares it
with `proposedData`, and rejects a no-op.

## Supabase cutover migration

Use [`career-tree/supabase/schema.sql`](../career-tree/supabase/schema.sql) for a
clean V2 database. Existing production data requires the destructive
[`career-tree/supabase/migrations/20260719_v2_reset.sql`](../career-tree/supabase/migrations/20260719_v2_reset.sql)
cutover instead. That migration:

- deletes existing suggestion/edit rows whose path identities cannot be trusted;
- removes `parent_path` and `target_node_key`;
- adds stable V2 IDs plus resolution, model-review, approval, and rejection columns;
- normalizes review-status defaults, `NOT NULL` rules, and status constraints;
- creates status/stable-ID indexes and enables RLS; and
- runs final assertions inside one transaction, so an assertion failure aborts and
  rolls back instead of committing a partial cutover.

This repository does **not** assert that the migration has run. Before any live SQL,
an operator must confirm the exact Supabase project and database target. With `psql`,
review `TARGET_DATABASE_URL` without printing it and require `ON_ERROR_STOP`; in the
Supabase SQL Editor, visually confirm the project and paste the complete transaction.
An uncertain target is a hard stop.

## Private moderation lifecycle

Moderation runs in a separate private companion repository. Its operator:

1. Fetches a pending row by stable parent/target ID.
2. Treats all submitted text as untrusted data, never as instructions.
3. Uses strict OpenAI response schemas to refine or check a proposal.
4. Requires explicit human confirmation.
5. Resolves the result through the canonical entity resolver.
6. Atomically writes the public JSONL registry and runs lint before marking the
   Supabase row approved.
7. Appends decisions to private, append-only audit logs.

From the companion repository, verify it and dry-run a specific row with:

```bash
python -m unittest discover -s tests -v
python fetch_check_edits.py --row-id <uuid> --dry-run --yes
```

`--dry-run` must not update Supabase or public registries. Companion source,
credentials, local review material, and private audit logs are not part of this
public release and must never be staged here.

## Public verification matrix

Run the complete matrix from a clean public worktree after any data or release
change.

| Scope | Command | Required result |
| --- | --- | --- |
| Pipeline unit tests | `python -m unittest discover -s pipeline/tests -v` | All tests pass. |
| Release graph lint | `python pipeline/lint.py --release` | Zero errors; current counts are 677 nodes and 1,505 edges. |
| Default source audit | `python pipeline/audit_sources.py` | Zero definitive failures. Do not substitute a date-filtered audit for release. |
| Snapshot freshness | `python pipeline/export_frontend.py --check` | Reports that the frontend V2 snapshot is current. |
| Frontend tests | `cd career-tree && npm test` | All Vitest suites pass. |
| Frontend lint | `cd career-tree && npm run lint` | ESLint exits successfully. |
| Production build | `cd career-tree && npm run build` | Next.js production build succeeds. |

With the verified build running, smoke-test representative routes. Required outcomes
are:

| Request | Expected outcome |
| --- | --- |
| `GET /` | `200` |
| `GET /careers/degree/bca` | `200`; canonical guide metadata, rendered citations, and Article JSON-LD are present |
| `GET /explore/degree/bca?from=school_stage%3Aclass-10` | `200`; `noindex,follow` and canonical `/careers/degree/bca` are present |
| `GET /map` | `200` |
| `GET /v2` | `404` |
| `GET /explore/10th-class` | `404` |

The API handlers are POST-only; validate them with the exact request contracts above,
not with a GET status probe.

## Production release checklist

The following gates are sequential. Stop on any unexpected output.

1. **Review the branch and complete diff.** Confirm the release branch, record the
   local SHA, review `git log --oneline main..<branch>`, and inspect `git diff --stat
   main...<branch>` plus the full diff. Resolve unexpected files before continuing.

2. **Run the entire public verification matrix.** A filtered test run is not a
   substitute.

3. **Scan for the active pipeline and removed V1 surfaces.** Confirm the active model
   and key references are limited to the intended OpenAI pipeline:

   ```bash
   git grep -n -E 'OPENAI_API_KEY|gpt-5\.6-terra|gpt-5\.6-luna|text-embedding-3-large' -- pipeline README.md docs/OPERATIONS.md
   git grep -n -E 'parentNodeId|targetNodeId|proposedData' -- career-tree/lib/schemas.ts career-tree/app/api
   git ls-files | rg '(^|/)(career_tree_data\.json|metadata\.json|visualise_tree\.py)$|(^|/)app/explore/\[\.\.\.slug\]/'
   ```

   The third command must return no V1 production artifact. Also review
   `git diff --name-status main...<branch>` to confirm the old routes/scripts are
   deletions, not alternate active paths.

4. **Inspect the live schema and row counts read-only.** Confirm the database target
   first, then inspect without exposing its URL:

   ```bash
   psql "$TARGET_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "select 'suggestions' as table_name, count(*) from public.suggestions union all select 'edits', count(*) from public.edits;"
   psql "$TARGET_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "select table_name, column_name, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name in ('suggestions','edits') order by table_name, ordinal_position;"
   psql "$TARGET_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) from pg_constraint where conrelid in ('public.suggestions'::regclass,'public.edits'::regclass) order by table_name, conname;"
   psql "$TARGET_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "select schemaname, tablename, indexname from pg_indexes where schemaname='public' and tablename in ('suggestions','edits') order by tablename, indexname;"
   psql "$TARGET_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('suggestions','edits') order by c.relname;"
   psql "$TARGET_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "select schemaname, tablename, policyname from pg_policies where schemaname='public' and tablename in ('suggestions','edits');"
   ```

   Record the pre-cutover counts. Unexpected tables, policies, columns, or a target
   mismatch require review before destructive SQL.

5. **Apply the destructive V2 migration once, to the confirmed target.** Prefer:

   ```bash
   psql "$TARGET_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f career-tree/supabase/migrations/20260719_v2_reset.sql
   ```

   An assertion error must leave the transaction uncommitted; investigate it rather
   than bypassing the assertion.

6. **Verify the cutover.** Rerun the read-only queries. Both tables must have zero
   rows; `parent_node_id` and `target_node_id` must exist and be `NOT NULL`; the
   removed path columns must be absent; V2 review columns, status constraints, and
   all four status/stable-ID indexes must exist; RLS must be true on both tables; and
   no anonymous policies may appear. Compare the result directly with
   `career-tree/supabase/schema.sql` and the migration.

7. **Exercise one disposable V2 moderation row.** Against the confirmed V2 app and
   database target, create a uniquely named edit probe:

   ```bash
   curl --fail-with-body -X POST "$V2_APP_BASE_URL/api/edit" \
     -H 'content-type: application/json' \
     --data '{"targetNodeId":"school_stage:class-10","proposedData":{"title":"Class 10 release probe","description":"Disposable V2 moderation release probe; delete this row after the dry run.","aliases":[]}}'
   ```

   Query the row read-only, copy its UUID, and run the companion repository's exact
   dry run:

   ```bash
   python fetch_check_edits.py --row-id <uuid> --dry-run --yes
   ```

   Confirm the dry run changed neither the public registry nor the probe row/status,
   then delete only that UUID:

   ```bash
   psql "$TARGET_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "delete from public.edits where id='<uuid>' and status='pending_review' and proposed_data->>'title'='Class 10 release probe';"
   ```

   Rerun the count query and require zero rows in both moderation tables. Never use a
   broad delete for probe cleanup.

8. **Rerun the final public verification matrix.** This is the release evidence after
   database validation, not a cached recollection of an earlier run.

9. **Audit staged scope and exclusions.** Run `git status --short`, `git diff
   --cached --name-only`, and `git diff --cached --check`. Confirm no credentials,
   `.env` files, runtime ledgers/caches, private companion files, audit logs, or local
   notes are staged.

10. **Only after every gate passes, push the reviewed branch:**

    ```bash
    git push -u origin <branch>
    test "$(git rev-parse HEAD)" = "$(git ls-remote origin refs/heads/<branch> | awk '{print $1}')"
    ```

    The equality check must succeed and the recorded remote SHA must match the
    reviewed local SHA.

**Local tests alone do not authorize a push.** Live target review, destructive
migration verification, the disposable moderation dry run, staged-file review, and
remote SHA confirmation are separate release gates.
