# Career Tree

Career Tree is an open-source map of education and career routes in India. The
production site publishes source-backed guides from one canonical, stable-ID graph
and lets visitors explore prerequisites and alternatives without duplicating roles
across URL paths.

## Architecture

- `pipeline/registry/nodes.jsonl` and `pipeline/registry/edges.jsonl` are the
  canonical dataset. Generated frontend JSON is never edited by hand.
- The Next.js app reads the committed `career-tree/data/v2/graph.json` snapshot.
- Supabase stores community suggestions, edits, and review state only. It is not a
  graph database or a second source of career facts.
- Stable node IDs have the form `<type>:<slug>`, such as `degree:bca`.

The OpenAI pipeline uses `gpt-5.6-terra` for expansion and cited enrichment,
`gpt-5.6-luna` for entity-resolution judgments, and
`text-embedding-3-large` at 1,024 dimensions for retrieval. Cosine similarity may
shortlist candidates but can never auto-merge nodes: exact identity rules or a
rubric-constrained judgment are required.

## Generate and release V2 data

Use Python 3.11+ and put `OPENAI_API_KEY` in a root `.env` file. Never commit that
file.

```bash
python -m pip install -r pipeline/requirements.txt
python pipeline/calibrate_er.py --write
python pipeline/expand.py --max-depth 4
python pipeline/enrich.py --retry-failures --workers 8
python pipeline/audit_sources.py
python pipeline/lint.py --release
python pipeline/export_frontend.py
python pipeline/export_frontend.py --check
python -m unittest discover -s pipeline/tests -v
```

Every production node must have validated facts. Every quick fact and article
section must cite at least one source, and every cited URL must pass the source
audit. Export is blocked while depth-below-four frontier work, missing facts,
source failures, or graph errors remain.

## Run the web app

Use Node.js 20+:

```bash
cd career-tree
npm install
npm run dev
```

Before release, run:

```bash
npm test
npm run lint
npm run build
```

Browsing uses only the committed graph snapshot. Community counts and contribution
forms additionally require server-side Supabase credentials in
`career-tree/.env.local`:

```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-side-secret>
```

Use `career-tree/supabase/schema.sql` for a clean V2 database. The destructive
production migration is `career-tree/supabase/migrations/20260719_v2_reset.sql` and
must be applied through the production release procedure.

## Production routes

- `/` — Class 10 entry point and searchable canonical directory
- `/careers/<type>/<slug>` — indexable source-backed guide
- `/explore/<type>/<slug>?from=<stable-id>` — contextual, noindex explorer
- `/map` — global graph with one visual node per stable ID
- `/api/suggest` and `/api/edit` — stable-ID community submissions

There are no V1 data routes or `/v2` preview routes in production.

## Repository layout

```text
pipeline/                       canonical graph pipeline and tests
  registry/                     canonical nodes and edges
  eval/                         entity-resolution evaluation data
career-tree/                    Next.js production app
  app/                          pages and server route handlers
  data/v2/graph.json            deterministic exported snapshot
  supabase/                     clean schema and production migration
```

## Contributing

Use the website forms to suggest a missing route or improve a guide. Code changes
are welcome through pull requests; data changes must preserve stable IDs,
provenance, source coverage, and all release gates.

Career Tree is licensed under the [MIT License](LICENSE).
