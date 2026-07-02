# Career Tree — Web App

The Next.js 16 (App Router) frontend for [Career Tree](../README.md). It renders the
career graph from static JSON and stores community submissions in Supabase.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint
```

## Configuration

Browsing works with zero config — the tree (`data/career_tree_data.json` +
`data/metadata.json`) ships with the repo.

The suggest/edit forms and the homepage counters need Supabase. Create `.env.local`:

```env
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret key — never expose to the client>
```

Run `supabase/schema.sql` once in your Supabase project's SQL editor to create the
`suggestions` and `edits` tables (RLS enabled, no policies — only the service-role
key can access them, from server code via `lib/supabase.ts`).

## Key places

- `lib/treeUtils.ts` — loads the JSON, slug/URL resolution, React Flow graph building.
- `app/explore/[...slug]` — Focus View; `app/map` — global graph.
- `app/api/suggest`, `app/api/edit` — Zod-validated inserts into Supabase with
  `status: "pending_review"`.
- `app/page.tsx` — landing page; counts all rows in both tables live (ISR, 5 min).

Submissions are reviewed and merged into the JSON with tooling in a separate private
repo; approved/rejected rows stay in Supabase permanently.
