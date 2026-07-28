-- Dedup guards for the moderation queue. Without these the same payload
-- inserts without limit: the app compares a suggestion only against the
-- published graph and rejects only an exact no-op edit, so neither sees what
-- is already sitting in the queue.
--
-- Partial on pending_review deliberately: the constraint bites only while a
-- row awaits review, so the same suggestion or edit may legitimately be
-- re-raised once the first has been approved or rejected.

begin;

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
  and ranked.rn > 1;

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
  and ranked.rn > 1;

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
