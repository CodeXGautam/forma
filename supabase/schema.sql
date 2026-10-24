-- Run this once in the Supabase SQL editor. Only the server-side secret key
-- used by Next.js can read or write rows; no public table policies are added.
create table if not exists public.shared_schemas (
  id uuid primary key default gen_random_uuid(),
  sql text not null check (char_length(sql) between 1 and 200000),
  created_at timestamptz not null default now()
);

alter table public.shared_schemas enable row level security;
