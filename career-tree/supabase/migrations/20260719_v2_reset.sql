-- Destructive V2 production cutover. Legacy review rows are intentionally not
-- migrated because their path-based identities cannot be trusted in the V2 DAG.

begin;

delete from public.suggestions;
delete from public.edits;

alter table public.suggestions
  drop column if exists parent_path,
  add column if not exists parent_node_id text,
  add column if not exists resolved_node_id text,
  add column if not exists model_refined_name text,
  add column if not exists model_refined_description text,
  add column if not exists rejection_reason text;

alter table public.edits
  drop column if exists target_node_key,
  add column if not exists target_node_id text,
  add column if not exists approval_reason text,
  add column if not exists rejection_reason text;

alter table public.suggestions
  drop constraint if exists suggestions_status_check,
  alter column status drop default,
  alter column status set default 'pending_review',
  alter column status set not null,
  alter column parent_node_id set not null,
  add constraint suggestions_status_check
    check (status in ('pending_review', 'approved', 'rejected'));

alter table public.edits
  drop constraint if exists edits_status_check,
  alter column status drop default,
  alter column status set default 'pending_review',
  alter column status set not null,
  alter column target_node_id set not null,
  add constraint edits_status_check
    check (status in ('pending_review', 'approved', 'rejected'));

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

do $$
begin
  if exists (select 1 from public.suggestions)
     or exists (select 1 from public.edits) then
    raise exception 'V2 reset must leave both tables empty';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and (
        (table_name = 'suggestions' and column_name = 'parent_path')
        or (table_name = 'edits' and column_name = 'target_node_key')
      )
  ) then
    raise exception 'legacy path columns remain';
  end if;
end $$;

commit;
