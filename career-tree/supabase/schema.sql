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
-- proposed_data is jsonb, so ::text is key-ordered and whitespace-normalized
-- by Postgres — equal payloads hash equal regardless of how they were sent.
create unique index if not exists suggestions_pending_dedup
  on public.suggestions (parent_node_id, lower(trim(suggested_name)))
  where status = 'pending_review';

create unique index if not exists edits_pending_dedup
  on public.edits (target_node_id, md5(proposed_data::text))
  where status = 'pending_review';
