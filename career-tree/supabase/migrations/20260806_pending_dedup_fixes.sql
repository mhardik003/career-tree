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

drop index if exists public.suggestions_pending_dedup;
drop index if exists public.edits_pending_dedup;

-- Duplicates already in the queue would make the unique indexes uncreatable.
-- Rows are never deleted in this project, so supersede rather than remove:
-- keep the earliest pending row of each duplicate group, reject the rest.
with ranked as (
  select id,
         row_number() over (
           partition by parent_node_id, lower(trim(suggested_name))
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
           partition by target_node_id, md5(proposed_data::text)
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

-- proposed_data is jsonb, so ::text is key-ordered and whitespace-normalized
-- by Postgres — equal payloads hash equal regardless of how they were sent.
create unique index if not exists suggestions_pending_dedup
  on public.suggestions (parent_node_id, lower(trim(suggested_name)))
  where status = 'pending_review';

create unique index if not exists edits_pending_dedup
  on public.edits (target_node_id, md5(proposed_data::text))
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
