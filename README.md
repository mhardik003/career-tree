
# <img src="./icon.png" width="40" height="40" alt="Logo" style="vertical-align:middle;" /> Career Tree

**Democratizing Career Counseling through Open Source Data Visualization.**

> *Don't just follow a path. Understand it.*

Career Tree is an interactive, node-based map of career opportunities. Unlike traditional lists or aptitude tests, it visualizes career paths as a branching tree, allowing users to explore prerequisites, identify dead ends, and discover non-linear pathways from any stage of life.

Currently mapped for the **Indian Education System** (scaling globally soon).

## TODO
* Option to delete the nodes
* Bottom up paths as well
* Add github actions tests (in the gemini chat)

## 🚀 Features

*   **Interactive Graph:** A zoomable, pannable global view of all career connections using `React Flow`.
*   **Focus Mode:** A clean, hierarchical view (Parent → Current Node → Children) to prevent information overload.
*   **Crowdsourced Data:** Built-in "Suggest a Path" and "Edit Node" features allow the community to refine data — submissions land in Supabase and are reviewed with an AI + human-in-the-loop tool.
*   **Live Community Stats:** The homepage counters are fetched live from Supabase.
*   **AI-Powered Crawler:** A Python script utilizing **Google Gemini** to recursively generate and map career paths.
*   **Rich Metadata:** Nodes contain difficulty ratings, duration, descriptions, and curated search keywords.

## 🛠️ Tech Stack

**Frontend (Web App)**
*   **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
*   **Database:** [Supabase](https://supabase.com/) (Postgres) — community suggestions & edits
*   **Styling:** Tailwind CSS
*   **Animation:** Framer Motion
*   **Visualization:** React Flow & Dagre (Graph Layout)
*   **Icons:** Lucide React

**Data Pipeline**
*   **Language:** Python 3.11+
*   **LLM:** Google Gemini 2.5 (Pro for crawling, Flash for metadata)
*   **Validation:** Pydantic (Structured Output)

---

## 🏁 Getting Started

### Prerequisites
*   Node.js 18+
*   Python 3.10+
*   A Google Gemini API Key (for the data crawler)

### 1. Clone the Repository
```bash
git clone https://github.com/mhardik003/career-tree.git
cd career-tree
```

### 2. Run the Web Application
The Next.js app lives in the `career-tree/` subdirectory.

```bash
cd career-tree

# Install dependencies
npm install

# Run the development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

Browsing the tree works with no configuration (the tree data is static JSON). The
"Suggest a Path" / "Edit Node" forms and the homepage counters additionally need a
Supabase project — create `career-tree/.env.local` with:
```env
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret key — server-side only>
```
and run `career-tree/supabase/schema.sql` once in the Supabase SQL editor to create
the `suggestions` and `edits` tables.

### 3. (Optional) Add data from the Data Crawler
If you want to expand the tree data yourself using AI (scripts live at the repo root):

1.  Create a `.env` file at the repo root and add your key:
    ```env
    GEMINI_API_KEY=your_actual_api_key_here
    ```
2.  Install Python requirements:
    ```bash
    pip install google-genai pydantic python-dotenv networkx pyvis
    ```
3.  Run the crawler:
    ```bash
    python generate_tree_gemini.py --node "<node path you want to expand>"
    ```
    *This reads and updates `career-tree/data/career_tree_data.json` in place (as does
    `generate_metadata_gemini.py` for `metadata.json`) — the same files the app serves,
    so just restart the dev server to see new data, then make a pull request.*

---

## 📂 Project Structure

```
.
├── career-tree/                  # The Next.js web app
│   ├── app/
│   │   ├── api/                  # Route handlers: /api/suggest, /api/edit → Supabase
│   │   ├── explore/[...slug]/    # Focus View (dynamic route)
│   │   ├── map/                  # The Global Graph View
│   │   └── page.tsx              # Landing page (live stats from Supabase)
│   ├── components/               # Reusable UI (NodeCard, Modals)
│   ├── data/
│   │   ├── career_tree_data.json # The tree itself (static, read-only)
│   │   └── metadata.json         # Rich per-node metadata
│   ├── lib/
│   │   ├── treeUtils.ts          # Graph logic & slug helpers
│   │   └── supabase.ts           # Server-side Supabase client
│   └── supabase/schema.sql       # DDL for the suggestions/edits tables
├── generate_tree_gemini.py       # AI crawler (expands the tree)
├── generate_metadata_gemini.py   # AI enrichment (fills metadata.json)
└── visualise_tree.py             # pyvis debug view -> career_map.html
```

User submissions are stored in Supabase (`suggestions` and `edits` tables) and merged
into the JSON after an AI + human review; rows are kept forever with a
`pending_review` / `approved` / `rejected` status.

---

## 🤝 Contributing

We believe career data should be a public good, not a trade secret.

**How to contribute:**
1.  **Code:** Fork the repo, make feature updates, and submit a PR.
2.  **Data:** Use the website's "Suggest" / "Edit" features to add missing niches, or edit `career-tree/data/career_tree_data.json` directly and submit a PR.

## 📝 Update Log

*   **2026-07-03** — `visualise_tree.py` no longer calls `net.get_nodes()` (a full list scan) for every child while wiring edges — it snapshots the node IDs into a set once. Output is identical; most of the remaining runtime is pyvis's own per-edge validation.
*   **2026-07-03** — The global map (`/map`) now only renders nodes inside the viewport (React Flow's `onlyRenderVisibleElements`): the DOM went from a constant 2,703 node elements (~28,600 elements total) to ~250 at the initial view and ~15 when zoomed in, making pan/zoom much lighter on low-end devices.
*   **2026-07-03** — Hardened the suggest/edit APIs: suggestions are now rejected when the parent node doesn't exist in the tree (400) or when the suggested child already exists under it (409, compared by URL slug), edits are rejected for unknown node keys, and malformed JSON bodies return 400 instead of 500. The Zod schemas moved out of the route files into `lib/schemas.ts` (route modules should only export handlers).
*   **2026-07-03** — The crawler's fresh-start seed node was `"10th Class (India)"`, which doesn't match the actual tree root `"10th Class"` — a from-scratch run would have grown a second, divergent root. It now seeds `"10th Class"`.
*   **2026-07-03** — Fixed `generate_metadata_gemini.py`'s single-node helper storing metadata under the node title instead of the full path key (making it invisible to the app), and exposed it as `--node "<full path>"` to regenerate one node's metadata.
*   **2026-07-02** — Shrunk the site icons: all five copies of the logo (favicon, app icons, header logo, README logo) were the full 1.9MB 1024×1024 PNG — ~10MB served with every first visit. They are now properly sized (32px favicon, 180px apple-touch, 64px header, multi-size `.ico`), ~52KB in total.
*   **2026-07-02** — Pipeline scripts (`generate_tree_gemini.py`, `generate_metadata_gemini.py`, `visualise_tree.py`) now read/write `career-tree/data/` directly — the files the app actually serves — instead of dumping to the current working directory, where generated data was invisible to the site and the crawler couldn't resume from existing data. Paths are anchored to the script location, so they work from any cwd.
*   **2026-07-02** — The root `.gitignore` ignored itself and was therefore untracked, so fresh clones had no ignore rules at the repo root where `.env` (Gemini key) lives. It no longer ignores itself and is now committed; local bug logs (`BUGS*.md`) are ignored too.
*   **2026-07-02** — Fixed the Edit modal telling users to separate list items with commas while the parser split on semicolons, which merged e.g. "JEE, BITSAT, VITEEE" into one item. Semicolons are the separator (many data items contain commas); the header and placeholders now say so. Also: `generate_tree_gemini.py` now loads `.env` and fails fast if `GEMINI_API_KEY` is missing, instead of sending a placeholder key.
*   **2026-07-02** — Fixed the suggest/edit API rate limiter: it was one global bucket shared by all visitors (7 requests/min site-wide); it now limits per client IP (5 requests/min, `Retry-After` on 429) with no external dependency — the `limiter` package is gone.
*   **2026-07-02** — Moved the tree data server-side: explore and map are now server components, so the ~5.4MB JSON bundle no longer ships to the browser and the dagre map layout runs at build time. All 2,703 node pages are statically generated with per-node titles/descriptions; added `sitemap.xml`, `robots.txt`, and real HTTP 404s for unknown paths.
*   **2026-07-02** — Migrated crowdsourcing storage from MongoDB (Mongoose) to Supabase (Postgres). Homepage community stats are now counted live from Supabase (all submissions, any status) instead of a static `stats.json`; submissions are never deleted, only flipped between `pending_review`/`approved`/`rejected`.
*   **2025-12-14** — Initial public release: Next.js app + Gemini data pipeline.

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

Made with ❤️ by Hardik