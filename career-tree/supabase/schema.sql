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
