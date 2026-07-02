-- Career Tree — Supabase schema
-- Run this once in the Supabase dashboard (SQL Editor) or via `supabase db push`.

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  parent_path text not null,
  suggested_name text not null,
  suggested_description text not null,
  status text not null default 'pending_review',
  created_at timestamptz not null default now()
);

create table if not exists public.edits (
  id uuid primary key default gen_random_uuid(),
  target_node_key text not null,
  original_data jsonb not null,
  proposed_data jsonb not null,
  status text not null default 'pending_review',
  created_at timestamptz not null default now()
);

-- The app writes with the service-role key, which bypasses RLS.
-- Enabling RLS with no policies means the public anon key can read/write nothing.
alter table public.suggestions enable row level security;
alter table public.edits enable row level security;

-- Handy for the review workflow
create index if not exists suggestions_status_idx on public.suggestions (status);
create index if not exists edits_status_idx on public.edits (status);
