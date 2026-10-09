-- Amar Agartala — run this once in Supabase → SQL Editor.
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

create table if not exists public.weekly (
  id         text not null,
  week       text not null,
  name       text not null default '',
  para       text not null default '',
  paddy      integer not null default 0,
  deliveries integer not null default 0,
  kaam       integer not null default 0,
  sights     integer not null default 0,
  earned     bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (id, week)
);
create index if not exists weekly_week_idx on public.weekly (week);
alter table public.weekly enable row level security;
create or replace view public.para_week as
  select week, para, sum(earned) as total, count(*) as players from public.weekly where para <> '' group by week, para;

create table if not exists public.presence (
  id   text primary key,
  name text not null default '',
  para text not null default '',
  x    double precision not null,
  z    double precision not null,
  face double precision not null,
  t    bigint not null
);
create index if not exists presence_t_idx on public.presence (t);
alter table public.presence enable row level security;

create table if not exists public.place_requests (
  id         text primary key,
  name       text not null,
  kind       text not null,
  note       text not null default '',
  x          integer not null,
  z          integer not null,
  lat        double precision not null,
  lon        double precision not null,
  farm       text not null,
  email      text not null default '',
  status     text not null default 'new',
  created_at timestamptz not null default now()
);
create index if not exists place_requests_created_idx on public.place_requests (created_at desc);
alter table public.place_requests enable row level security;
