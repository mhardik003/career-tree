# Career Tree V2

Career Tree V2 is the production architecture for an open, source-backed map of
education and career routes in India. It replaces path identity with a canonical,
typed directed graph: an entity exists once, receives an immutable stable ID, and
can participate in multiple routes without being duplicated.

This is the standalone technical, operational, moderation, verification, and
production-release guide. For the shorter project introduction, see
[`README.md`](README.md).

> **Release state:** this guide describes the committed V2 implementation and the
> release procedure. It does not mean that the destructive live Supabase migration
> has been applied or that `data_v2` has been pushed. Both require the production
> gates below.

## Canonical dataset status

At the current `data_v2` commit, the canonical export contains exactly:

- **677 nodes**
- **1,505 directed edges**
- **677 source-enriched guides** (every node has validated facts)
- Expansion complete through depth four from `school_stage:class-10`; the committed
  frontier has no queued item below depth four

The source of these metrics is the committed
[`career-tree/data/v2/graph.json`](career-tree/data/v2/graph.json) snapshot. The
JSONL registries remain authoritative; the snapshot is a deterministic export.

## V1 and V2

| Area | V1 | V2 |
| --- | --- | --- |
| Identity | A title's position in a nested path acted as identity. The same entity could appear at several paths. | An immutable `<type>:<slug>` ID is identity. Titles and aliases are display/search data, not identity. |
| Graph model | A rooted, nested tree duplicated shared destinations and encoded context in their paths. | A typed directed graph stores each entity once and connects it to every valid parent. Progression, exam-gate, and lateral relationships are explicit. |
| Source of truth | The web-serving tree JSON and separate metadata JSON were edited/generated directly. | [`pipeline/registry/nodes.jsonl`](pipeline/registry/nodes.jsonl) and [`pipeline/registry/edges.jsonl`](pipeline/registry/edges.jsonl) are canonical; the frontend snapshot is generated. |
| Generation | Top-level crawler/enrichment scripts wrote served data in place. | A staged OpenAI pipeline expands, resolves, enriches, audits, lints, and exports canonical records. |
| Entity resolution | Path position and local slug checks could not resolve duplicates across the whole dataset. | Exact normalized identity is followed by an embedding shortlist and a rubric-constrained judge. The standing preference is to under-merge. |
| Facts and citations | Metadata coverage was separate and incomplete; release did not require cited sections for every node. | Every production node has type-specific facts, and every quick fact and article section has public citations. |
| Production routes | One catch-all path combined identity and navigation context. | Canonical guides use `/careers/<type>/<slug>`; contextual exploration uses `/explore/<type>/<slug>?from=<stable-id>`. |
| Stable-ID submissions | Suggestion and edit payloads referred to path-derived keys and could supply edit originals. | Suggestions use `parentNodeId`; edits use `targetNodeId`, and the server derives original node data from the graph snapshot. |
| Map and SEO | A path-expanded map could show duplicate visual entities, while SEO needed a primary-path workaround. | `/map` renders one visual node per stable ID. Every guide is canonical, indexable, cited, and structured; explorers are `noindex` and canonicalize to guides. |

The V1 routes, data files, and generation scripts are intentionally absent from the
production branch, as is the former `/v2` preview surface. Do not restore them as
compatibility layers or copy their path-based contracts into V2.

## Architecture and data flow

The public data release path is:

```text
OpenAI expansion, entity resolution, and enrichment
    -> pipeline/registry/nodes.jsonl + pipeline/registry/edges.jsonl
    -> release lint + source audit + deterministic export
    -> career-tree/data/v2/graph.json
    -> Next.js production pages, search, explorers, and global map
```

Community changes enter through a separate, review-controlled path:

```text
Website suggestion/edit forms
    -> stable-ID pending moderation rows in Supabase
    -> private reviewed moderation in the companion repository
    -> canonical resolver + human confirmation
    -> atomic JSONL registry write + lint
    -> Supabase approval state
    -> normal public data release path above
```

Supabase is **not graph storage**. It stores homepage submission counters,
suggestions, edits, and their review state. Public browsing reads only the committed
graph snapshot; Supabase is never a second source of career facts.

## Repository layout

```text
pipeline/
  registry/
    nodes.jsonl                 canonical node registry
    edges.jsonl                 canonical directed-edge registry
  state/frontier.json           resumable depth-bounded expansion state
  eval/                         frozen ER labels and calibration report
  ledger/                       committed ER decisions; ignored runtime ledgers
  tests/                        pipeline, ER, facts, audit, lint, and export tests
  calibrate_er.py               embedding-shortlist calibration
  expand.py                     graph expansion
  enrich.py                     cited fact and article enrichment
  audit_sources.py              public-source URL audit
  lint.py                       structural and release invariants
  export_frontend.py            deterministic frontend snapshot export

career-tree/
  app/                          Next.js pages, metadata, and API handlers
  components/v2/                guide, explorer, map, and contribution UI
  data/v2/graph.json            committed generated snapshot
  lib/v2/                       graph, routing, map, URL, and search logic
  lib/schemas.ts                stable-ID request schemas
  lib/supabase.ts               server-only moderation client
  supabase/schema.sql           clean V2 schema
  supabase/migrations/          production cutover migration
```

## Canonical graph contract

### Nodes and identity

Supported node types are:

- `school_stage`
- `stream`
- `exam`
- `degree`
- `diploma`
- `certification`
- `training`
- `job_role`
- `government_service`
- `entrepreneurship`

Every node ID has the stable form `<type>:<slug>`, for example `degree:bca`.
The prefix must equal the node's `type`; the slug is lowercase ASCII words joined by
hyphens. IDs are minted once and preserved. Renaming a title or adding an alias does
not change identity.

### Edges and graph integrity

Supported edge types are `progression`, `exam_gate`, and `lateral`. An edge ID is
`<from_id>-><to_id>`, for example `degree:bca->degree:mba`, and both endpoints must
resolve to canonical nodes. Any edge that touches an exam must be `exam_gate`, and
`exam_gate` must touch an exam. Exam-to-exam edges are invalid.

The `progression` subgraph must be acyclic. The complete graph may contain a cycle
through `lateral` or `exam_gate` relationships because retraining and career changes
can legitimately lead back to an earlier kind of opportunity. Route rendering never
repeats a node within one displayed route.

### Provenance

Each node and edge carries creation provenance: model, prompt version, generation
date, optional verification date, and source URLs. Each node's `facts` object carries
separate enrichment provenance, `last_reviewed`, cited quick facts, cited article
sections, and useful links. Creation provenance answers how the graph record arose;
fact provenance answers how its public guide was researched.

## OpenAI data pipeline

### Models and entity resolution

- `gpt-5.6-terra` performs expansion and source-backed enrichment.
- `gpt-5.6-luna` is the entity-resolution judge.
- `text-embedding-3-large`, requested at **1,024 dimensions**, retrieves entity
  candidates.

Embeddings only shortlist same-type candidates. Cosine similarity never auto-merges
nodes: an exact normalized match can link directly, while a shortlisted non-exact
candidate requires the rubric-constrained judge. A `distinct` or `unsure` judgment
mints a separate node, with uncertain cases flagged for review. This deliberate
under-merging preference makes a missed merge repairable without corrupting multiple
routes.

### Setup and commands

Use Python 3.11+ and install the pinned runtime dependencies:

```bash
python -m pip install -r pipeline/requirements.txt
```

Put the active API credential in the ignored root `.env` file:

```env
OPENAI_API_KEY=<your-openai-api-key>
```

Never commit `.env`. From the repository root, run the release pipeline in order:

```bash
python pipeline/calibrate_er.py --write
python pipeline/expand.py --max-depth 4
python pipeline/enrich.py --retry-failures --workers 8
python pipeline/audit_sources.py
python pipeline/lint.py --release
python pipeline/export_frontend.py
python pipeline/export_frontend.py --check
```

`calibrate_er.py --write` evaluates the frozen labels and atomically updates the
committed shortlist report. Expansion is resumable through
[`pipeline/state/frontier.json`](pipeline/state/frontier.json); it saves sorted JSONL
records and frontier progress after each expanded node. Enrichment skips completed
nodes, retries recorded failures when requested, researches in bounded parallel
workers, serializes registry saves, and clears a failure row only after success.

These OpenAI operations are paid and should be run deliberately. Exact cache keys
include provider, model, prompt version, schema, prompt, and tools, so unchanged calls
and embeddings can resume from local caches without being reissued. Registry and
report replacements use atomic writes. Expansion requeues an isolated failed node;
expansion and enrichment abort after five consecutive failures that suggest service
unavailability. Unresolved enrichment failures remain release-blocking.

Runtime call, embedding, usage, enrichment-failure, and source-audit ledgers under
`pipeline/ledger/` are ignored. The exception is
[`pipeline/ledger/er_decisions.jsonl`](pipeline/ledger/er_decisions.jsonl), the
committed entity-resolution decision ledger. Do not commit caches or usage records.

## Release invariants and source audit

A releasable registry must satisfy all of the following:

- No frontier entry below depth four remains incomplete.
- Every node has facts, at least one type-appropriate article section, and only
  section keys allowed for its node type.
- Every quick fact and article section has at least one public HTTP(S) source.
- Every edge endpoint exists, every ID and type prefix is valid, exam edges obey the
  edge grammar, and non-exam nodes are reachable from `school_stage:class-10`.
- The `progression` subgraph has no cycle.
- The enrichment failure ledger has no rows.
- `career-tree/data/v2/graph.json` structurally matches the registries and their
  source digest.

The URL audit is designed not to persist page bodies. It validates schemes and
hosts before requesting, rejects credentials and local/private hosts, uses bounded
timeouts, streams responses, closes them, follows at most five validated redirects,
and stores only URL/status/error metadata. Malformed or unsafe URLs, invalid redirect
targets, and HTTP `404`/`410` are definitive failures and make the command fail.
Authentication or method responses (`401`, `403`, `405`) still prove an endpoint
exists. Network errors, excessive redirects, and other ambiguous responses are
reported but are not mislabeled as definitive disappearance; operators must still
review them.

## Web application

Use Node.js 20+:

```bash
cd career-tree
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Browsing, search, guides,
exploration, and the map use only `data/v2/graph.json`. Supabase is consulted only
for homepage submission counters and suggestion/edit submissions.

Production routes are:

- `/` — Class 10 entry point and searchable canonical directory
- `/careers/<type>/<slug>` — indexable canonical guide
- `/explore/<type>/<slug>?from=<stable-id>` — contextual route explorer
- `/map` — one visual node per canonical stable ID and all graph relationships
- `/api/suggest` — stable-parent suggestion submission
- `/api/edit` — stable-target guide edit submission

Guide pages render their citations, canonical metadata, and Article JSON-LD.
Explorer pages are `noindex,follow` and set their canonical URL to the corresponding
guide without query context. Explorers do not appear in the sitemap.

## Supabase moderation storage

Create `career-tree/.env.local` only when counters or forms need a Supabase target:

```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-side-secret>
```

Both variables are server-only. The service-role key bypasses RLS and must never be
imported into a client component, logged, or committed. The moderation tables have
RLS enabled and intentionally define no anonymous read/write policies; browser code
talks to the Next.js route handlers, not directly to the tables.

Use [`career-tree/supabase/schema.sql`](career-tree/supabase/schema.sql) for a clean
V2 database. Existing production data requires the destructive
[`career-tree/supabase/migrations/20260719_v2_reset.sql`](career-tree/supabase/migrations/20260719_v2_reset.sql)
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

1. **Review the branch and complete diff.** Confirm `data_v2`, record the local SHA,
   review `git log --oneline main..data_v2`, and inspect `git diff --stat
   main...data_v2` plus the full diff. Resolve unexpected files before continuing.

2. **Run the entire public verification matrix.** A filtered test run is not a
   substitute.

3. **Scan for the active pipeline and removed V1 surfaces.** Confirm the active model
   and key references are limited to the intended OpenAI pipeline:

   ```bash
   git grep -n -E 'OPENAI_API_KEY|gpt-5\.6-terra|gpt-5\.6-luna|text-embedding-3-large' -- pipeline README.md README_v2.md
   git grep -n -E 'parentNodeId|targetNodeId|proposedData' -- career-tree/lib/schemas.ts career-tree/app/api
   git ls-files | rg '(^|/)(career_tree_data\.json|metadata\.json|visualise_tree\.py)$|(^|/)app/explore/\[\.\.\.slug\]/'
   ```

   The third command must return no V1 production artifact. Also review
   `git diff --name-status main...data_v2` to confirm the old routes/scripts are
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
    git push -u origin data_v2
    test "$(git rev-parse HEAD)" = "$(git ls-remote origin refs/heads/data_v2 | awk '{print $1}')"
    ```

    The equality check must succeed and the recorded remote SHA must match the
    reviewed local SHA.

**Local tests alone do not authorize a push.** Live target review, destructive
migration verification, the disposable moderation dry run, staged-file review, and
remote SHA confirmation are separate release gates.

## Contribution safety

- Preserve stable IDs; title changes and aliases do not justify ID churn.
- Edit canonical JSONL registries, run lint, and export. Never hand-edit
  `career-tree/data/v2/graph.json`.
- Prefer under-merging. A false duplicate merge can silently corrupt every route that
  shares the entity.
- Supply public sources for every quick fact and article section, and rerun the
  default URL audit.
- Reject stale, unknown, or path-derived submission targets; only current stable IDs
  enter moderation.
- Keep credentials, OpenAI caches, usage files, ignored runtime ledgers, companion
  source, and private review logs out of Git.
- Add regression tests for every graph, API, routing, moderation, or release-gate bug.

Career Tree is released under the [MIT License](LICENSE).
