-- Sessions table for cookie-based login sessions (see server/src/session.ts).
--
-- Columns use quoted camelCase identifiers to match SessionRecord and the
-- Supabase queries in session.ts (e.g. .eq("tokenHash", ...)). Run this once in
-- the Supabase SQL editor for the project pointed at by SUPABASE_URL.

create table if not exists public.sessions (
  "sessionId"  uuid primary key,
  "userId"     text not null,
  "tokenHash"  text not null unique,
  "createdAt"  timestamptz not null,
  "expiresAt"  timestamptz not null,
  "remember"   boolean not null default false,
  "revoked"    boolean not null default false,
  "lastSeen"   timestamptz not null
);

-- Fast lookups by token hash (validateSession) and by user (revoke-all).
create index if not exists sessions_token_hash_idx on public.sessions ("tokenHash");
create index if not exists sessions_user_id_idx on public.sessions ("userId");

-- Row-level security: enable it with NO anon/authenticated policies, so only
-- the server (service-role key, which bypasses RLS) can read or write sessions.
alter table public.sessions enable row level security;
