# Entity-Resolution Rubric — when are two titles the same role?

*Committed before any resolver code. Every automated resolution decision (rules,
embedding shortlist, OpenAI judge) and every human review applies THIS table, in
order — first matching row wins. The judge prompt embeds it verbatim
(`resolve.rubric_table()`).*

**Standing preference: under-merge.** A missed merge is fixable later with an additive
alias; a wrong merge silently corrupts every route that shares the entity. When in doubt:
`distinct`.

Definitions:
- *slug* — `lowercase, [^a-z0-9]+ → '-', trim '-'` (matches `career-tree/lib/slugify.ts`)
- *tight slug* — slug with `-` removed
- *qualifier* — a trailing parenthetical: `Research Scientist (Govt.)` → base
  `Research Scientist`, qualifier `Govt.`

## Decision table

| # | Case | Examples from the data | Decision |
|---|------|------------------------|----------|
| 1 | Same `node_type` and same tight slug | `Journalist\|Reporter` / `Journalist \| Reporter`; `Ph.D in Law` / `PhD in Law` | **same_role** (formatting variants → aliases) |
| 2 | Same words, different order (token multiset of slugs equal) | `CA \| Chartered Accountancy` / `Chartered Accountancy (CA)`; `MBA (Master of Business Administration)` / `Master of Business Administration (MBA)` | **same_role** |
| 3 | Same base + qualifier synonyms (qualifier maps to the same controlled-vocabulary entry) | `(Govt.)` / `(Government)` / `(e.g., CSIR, DRDO, ISRO)`; `(Pharma)` / `(Pharmaceuticals)` | **same_role**; qualifier normalized. Controlled vocabulary: Government, Industry, Academia, Abroad, plus field names (Pharma, Biotech, …) |
| 4 | Same base, genuinely different qualifier domains | `Research Scientist (Government)` vs `Research Scientist (Pharma)` | **distinct** (sibling specializations of the same base) |
| 5 | `{Role} in/of {Domain}` or `{Role} ({Domain})` vs bare `{Role}` | `Assistant Professor (Law)` vs `Assistant Professor` (25 domain variants exist) | **distinct**, linked `specializes → <base role>`; never collapsed into the base |
| 6 | Context-inheriting generic academic stages | bare `Ph.D.`, `M.Sc.`, `M.Tech`, `Specialization`, `Higher Studies` under different parents | **never cross-merge** across domains — same surface title under different parents is NOT the same role. A bare generic under parent X resolves to (or creates) the domain-qualified role for X |
| 7 | Different academic/seniority level | `Professor` vs `Assistant Professor`; `B.Sc X` vs `M.Sc X`; `DM` vs `MD`; `Software Developer` vs `Senior Software Developer` | **distinct** — level tokens (B./M./Ph.D, Junior/Senior/Lead/Chief, Assistant/Associate/Full) are identity-bearing |
| 8 | Singular/plural, spelling-convention pairs (Indian/British ↔ American), honorific dots | `counsellor/counselor`, `paediatric/pediatric`, `PSU/PSUs`, `System/Systems Analyst` | **same_role** (canonical: Indian/British spelling; most-frequent variant as title) |
| 9 | Abbreviation vs expansion of the same credential/role | `CS` vs `Company Secretary (CS)`; `JAG Officer` vs `Judge Advocate General Officer` | **same_role** — but ONLY when the expansion is unambiguous in context; bare 2–3-letter forms (`CS`, `PM`, `DM`) that are ambiguous across types → rule 12 |
| 10 | Aggregate/disjunction titles | `Further Studies (MBA\|LLB)`, `Government Jobs (PSU\|UPSC\|State)`, `Entry-Level Job Roles & Further Education` (~41 exist) | `node_type: category` — **excluded from ER entirely**; never merged with anything, never a merge target |
| 11 | Cross-`node_type` resemblance | `CA` the exam gateway vs `Chartered Accountant` the job; `UPSC Civil Services` (exam) vs `IAS Officer` (job) | **distinct** — ER runs strictly within one `node_type` |
| 12 | Ambiguous short forms / insufficient signal | bare `DM` (Doctor of Medicine? District Magistrate?), any pair the judge can't place with the rows above | **distinct** + `needs_review: true` — the under-merge default |

## Judge-band mechanics

- Ladder (`resolve.py`): aggregate/disjunction titles are rejected outright (row 10)
  and never enter ER; bare generics inherit a domain qualifier from their parent
  (row 6); an exact normalized title/alias match within the type links directly, no
  model call. Otherwise the candidate is embedded (`text-embedding-3-large`, 1,024
  dims) and cosine-shortlisted against same-type nodes — at or above the calibrated
  judge band the top 3 go to the OpenAI judge with this rubric; below it a new node
  is minted. Similarity never auto-merges.
- Judge output is schema-constrained: `{decision: same_role|distinct|unsure,
  matched_id (same_role only, from the shortlist), rule: <row #>, rationale}`.
  `distinct`/`unsure` mint; `unsure` — or a `matched_id` outside the shortlist —
  additionally flags `needs_review`. No judge free-text ever flows into another prompt.
- **Replay-not-redecide**: judge calls cache by a sha256 digest of the full
  structured-call payload (provider, model, prompt version, schema, prompt, tools —
  `cache_keys.py`), so unchanged calls replay instead of being reissued; every
  resolution appends to the committed, append-only ledger `ledger/er_decisions.jsonl`.

## Acceptance tests (must pass before the resolver is trusted)

| Pair | Expected |
|---|---|
| `MBA (Master of Business Administration)` ↔ `Master of Business Administration (MBA)` | same_role (rule 2) |
| `Professor` ↔ `Assistant Professor` | distinct (rule 7) |
| `Research Scientist (Govt.)` ↔ `Research Scientist (e.g., CSIR, DRDO)` | same_role (rule 3) |
| `Research Scientist (Government)` ↔ `Research Scientist (Pharma)` | distinct (rule 4) |
| `Assistant Professor (Law)` ↔ `Assistant Professor` | distinct (rule 5) |
| `Ph.D.` under Economics ↔ `Ph.D.` under Civil Engineering | distinct (rule 6) |
| `B.Sc in Radiology Imaging Technology` ↔ `M.Sc in Radiology Imaging Technology` | distinct (rule 7) |
| `Biotech Entrepreneur (Startup Founder)` ↔ `Tech Entrepreneur (Startup Founder)` | distinct (rule 4/7 — different domain) |
| `Software Developer` ↔ `Software Development Engineer` | same_role (rule 9; industry synonyms) |
| `Further Studies (MBA\|LLB)` ↔ `MBA` | never merged (rule 10) |

The labeled evaluation set lives in `eval/er_labels.json` (655 pairs); the judge band
is calibrated against it by `calibrate_er.py --write` and recorded in
`eval/er_openai_report.json`.
