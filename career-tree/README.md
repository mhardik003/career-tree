# Career Tree — Web App

The Next.js 16 App Router frontend renders the canonical V2 career graph and stores
community submissions in Supabase for private review.

## Run it

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

Browsing uses the committed `data/v2/graph.json` snapshot and needs no runtime graph
database. The homepage counters and stable-ID suggestion/edit APIs require:

```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret key>
```

Use `supabase/schema.sql` for a clean V2 installation. The destructive production
cutover is in `supabase/migrations/20260719_v2_reset.sql` and must be run only through
the release procedure.

## Production surfaces

- `/` — Class 10 entry action and searchable canonical directory.
- `/careers/<type>/<slug>` — indexable, source-backed canonical guides.
- `/explore/<type>/<slug>?from=<stable-id>` — contextual, noindex exploration.
- `/map` — one visual node per canonical ID and all registry relationships.
- `/api/suggest` and `/api/edit` — strict stable-ID submission endpoints.

The public JSONL registry under `../pipeline/registry/` is canonical. The frontend
snapshot is generated with `python pipeline/export_frontend.py`; it is never edited by
hand or copied from a legacy tree. The root pipeline uses OpenAI for depth-bounded
expansion, conservative entity resolution, and cited enrichment; the snapshot is
released only after its source audit and release lint pass. No provider credentials
are shipped to the browser.
