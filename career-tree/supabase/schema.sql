-- Career Tree V2 — clean-install Supabase schema

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  parent_node_id text not null,
  resolved_node_id text,
  suggested_name text not null,
  suggested_description text not null,
  model_refined_name text,
  model_refined_description text,
  rejection_reason text,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.edits (
  id uuid primary key default gen_random_uuid(),
  target_node_id text not null,
  original_data jsonb not null,
  proposed_data jsonb not null,
  approval_reason text,
  rejection_reason text,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

-- The app writes with the service-role key, which bypasses RLS. With no anon
-- policies, public clients cannot read or write moderation rows directly.
alter table public.suggestions enable row level security;
alter table public.edits enable row level security;

create index if not exists suggestions_status_idx
  on public.suggestions (status);
create index if not exists suggestions_parent_node_id_idx
  on public.suggestions (parent_node_id);
create index if not exists edits_status_idx
  on public.edits (status);
create index if not exists edits_target_node_id_idx
  on public.edits (target_node_id);

-- Dedup guards. Without these, the same payload inserts without limit: the
-- app's own checks only compare against the published graph (suggestions) or
-- reject an exact no-op (edits), so neither sees what is already queued.
--
-- Partial on pending_review deliberately: the constraint bites only while a
-- row awaits review, so a contributor may legitimately re-raise the same
-- suggestion or edit once the first has been approved or rejected. The API
-- routes translate 23505 into 409.
--
-- The two helper functions and both index expressions below are copied verbatim
-- from migrations/20260806_pending_dedup_fixes.sql, so a database bootstrapped
-- from this file and one built by replaying the migrations end up with the same
-- guard. They are kept in sync by hand and pipeline/tests/test_migrations.py
-- fails if the two files diverge. Do not "simplify" the keys back to
-- lower(trim(suggested_name)) / md5(proposed_data::text): Zod already trims
-- before insert, and jsonb normalizes object key order but PRESERVES array
-- order, so neither of those expressions actually dedups.

-- Canonical dedup keys. These must be IMMUTABLE to be usable in an index
-- expression, and they are: same input, same output, always.

-- Whitespace and case are not meaningful differences in a suggested name, and
-- neither is a stray trailing terminator. Invisible/format and bidi-control
-- characters are stripped first: soft hyphen, combining grapheme joiner, the
-- Arabic letter mark, Mongolian vowel separator, the zero-width space/
-- joiner/non-joiner and left-to-right/right-to-left marks, the bidi
-- embedding/override/isolate controls, the invisible math operators, the
-- word joiner (the Unicode-recommended replacement for using the BOM as a
-- zero-width no-break space), the deprecated-but-assigned inhibit/activate
-- symmetric-swapping and Arabic-form-shaping controls and the national/
-- nominal digit-shape controls (U+206A-U+206F), and the BOM/ZWNBSP itself —
-- all invisible in the UI, so a rotating invisible-character suffix would
-- otherwise be a free bypass of the whole guard. Non-breaking and other
-- Unicode space separators (NBSP, figure space, narrow no-break space, etc.
-- — \s alone misses these) are folded into the same whitespace-collapse pass
-- as plain spaces. Postgres ARE `\uXXXX` escapes are used throughout instead
-- of the literal invisible characters, so the pattern stays legible and
-- verifiable by eye.
create or replace function public.suggestion_dedup_key(name text)
returns text
language sql
immutable
as $$
  select lower(btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          coalesce(name, ''),
          '[\u00AD\u034F\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]',
          '', 'g'
        ),
        '[\s\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+', ' ', 'g'
      ),
      '[.,;:!?\s]+$', '', 'g'
    )
  ));
$$;

-- jsonb normalizes object key order but PRESERVES array order, so hashing
-- proposed_data::text directly treats aliases ["a","b"] and ["b","a"] as two
-- different edits. Sort the alias array and normalize the free-text fields the
-- same way suggestion_dedup_key does, then hash the result. Aliases are
-- de-duplicated (schemas.ts caps the array at 25 elements but never enforces
-- uniqueness, so ["a"] and ["a","a"] would otherwise key differently) and
-- sorted under the "C" collation explicitly, so a future collation/ICU
-- upgrade cannot silently reorder — and therefore rehash — an existing
-- payload. `string_agg(DISTINCT expr, ...)` requires its ORDER BY expression
-- to match the aggregated expression exactly, so the same COLLATE decoration
-- is applied to both.
create or replace function public.edit_dedup_key(payload jsonb)
returns text
language sql
immutable
as $$
  select md5(
    coalesce(public.suggestion_dedup_key(payload->>'title'), '')
    || e'\x1f' ||
    coalesce(public.suggestion_dedup_key(payload->>'description'), '')
    || e'\x1f' ||
    coalesce((
      select string_agg(distinct public.suggestion_dedup_key(value) collate "C", e'\x1e' order by
                        public.suggestion_dedup_key(value) collate "C")
      from jsonb_array_elements_text(
        case jsonb_typeof(payload->'aliases')
          when 'array' then payload->'aliases'
          else '[]'::jsonb
        end
      ) as alias(value)
    ), '')
  );
$$;

create unique index if not exists suggestions_pending_dedup
  on public.suggestions (parent_node_id, public.suggestion_dedup_key(suggested_name))
  where status = 'pending_review';

create unique index if not exists edits_pending_dedup
  on public.edits (target_node_id, public.edit_dedup_key(proposed_data))
  where status = 'pending_review';
