-- Corrects 20260728_pending_dedup_indexes.sql, which is ALREADY APPLIED and so
-- cannot be fixed in place. That migration's dedup keys do not actually dedup:
-- md5(proposed_data::text) is sensitive to alias ARRAY order (jsonb normalizes
-- object key order but preserves array order), and lower(trim(suggested_name))
-- is a near no-op because Zod already trims before insert. Its comment claiming
-- "equal payloads hash equal regardless of how they were sent" is false.
--
-- Both indexes are dropped and rebuilt: `create unique index if not exists` finds
-- the existing name and silently skips, and the do-block below checks names only,
-- so without the drops this migration would commit successfully having changed
-- nothing.

begin;

-- Fail fast instead of queueing. The ACCESS EXCLUSIVE lock taken below
-- conflicts with ROW EXCLUSIVE (held by every INSERT), so without a timeout one
-- forgotten idle-in-transaction session stalls /api/suggest and /api/edit
-- indefinitely and the POSTs surface as Vercel function timeouts.
set local lock_timeout = '5s';

-- Take the strongest lock this transaction needs BEFORE mutating anything.
-- DROP INDEX takes ACCESS EXCLUSIVE on the index's parent table, which outranks
-- both the ROW EXCLUSIVE of the UPDATEs below and the SHARE of the CREATE
-- UNIQUE INDEX at the end. Requesting it here rather than letting the drops
-- raise it means there is no mid-transaction upgrade to deadlock on, and no
-- window in which a concurrent INSERT can add a duplicate that would make the
-- index uncreatable.
--
-- ACCESS EXCLUSIVE conflicts with every lock mode including ACCESS SHARE, so
-- for the length of this transaction READS of these two tables block as well as
-- writes -- app/page.tsx counts both tables for the homepage counters, so an ISR
-- revalidation landing in the window waits. That is the cost of the drops; it is
-- bounded by how long this transaction runs (well under a second in practice)
-- and by the lock_timeout above while acquiring. See docs/OPERATIONS.md.
lock table public.suggestions in access exclusive mode;
lock table public.edits in access exclusive mode;

drop index if exists public.suggestions_pending_dedup;
drop index if exists public.edits_pending_dedup;

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

-- Duplicates already in the queue would make the unique indexes uncreatable.
-- Rows are never deleted in this project, so supersede rather than remove:
-- keep the earliest pending row of each duplicate group, reject the rest.
with ranked as (
  select id,
         row_number() over (
           partition by parent_node_id, public.suggestion_dedup_key(suggested_name)
           order by created_at, id
         ) as rn
  from public.suggestions
  where status = 'pending_review'
)
update public.suggestions s
set status = 'rejected',
    rejection_reason = 'superseded duplicate (pending-dedup migration)'
from ranked
where ranked.id = s.id
  and ranked.rn > 1
  -- READ COMMITTED re-checks the WHERE clause against a concurrently updated
  -- row, but only for columns it actually mentions. `ranked` is a frozen
  -- snapshot, so without this line a row the moderation tool approved since
  -- the CTE ran would be rejected on top of its own approval.
  and s.status = 'pending_review';

with ranked as (
  select id,
         row_number() over (
           partition by target_node_id, public.edit_dedup_key(proposed_data)
           order by created_at, id
         ) as rn
  from public.edits
  where status = 'pending_review'
)
update public.edits e
set status = 'rejected',
    rejection_reason = 'superseded duplicate (pending-dedup migration)'
from ranked
where ranked.id = e.id
  and ranked.rn > 1
  -- See the suggestions UPDATE above: `ranked` is a snapshot, so the live
  -- row's status must be re-checked explicitly.
  and e.status = 'pending_review';

create unique index if not exists suggestions_pending_dedup
  on public.suggestions (parent_node_id, public.suggestion_dedup_key(suggested_name))
  where status = 'pending_review';

create unique index if not exists edits_pending_dedup
  on public.edits (target_node_id, public.edit_dedup_key(proposed_data))
  where status = 'pending_review';

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'suggestions_pending_dedup'
  ) or not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'edits_pending_dedup'
  ) then
    raise exception 'pending-dedup indexes were not created';
  end if;
end $$;

commit;
