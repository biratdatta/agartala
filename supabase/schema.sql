-- Haora Bari · Agartala — run this once in Supabase → SQL Editor.
-- Row-level security is on with no policies, so only the server (service role key) can read or write.

create table if not exists public.kv (
  key        text primary key,
  value      jsonb not null,
  rev        integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.kv enable row level security;

create table if not exists public.leaderboard (
  id         text primary key,
  name       text not null check (char_length(name) between 2 and 24),
  worth      bigint not null default 0,
  day        integer not null default 1,
  updated_at timestamptz not null default now()
);
create index if not exists leaderboard_worth_idx on public.leaderboard (worth desc, day asc);
alter table public.leaderboard enable row level security;
