-- Amar Agartala on Cloudflare D1. Apply with: npm run cf:db  (or --local for wrangler dev)
-- Saves, sessions, farm codes and accounts are all rows in kv; each write is compare-and-set on rev.
CREATE TABLE IF NOT EXISTS kv (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  rev        INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leaderboard (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 24),
  worth      INTEGER NOT NULL DEFAULT 0,
  day        INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS leaderboard_worth_idx ON leaderboard (worth DESC, day ASC);

-- Weekly boards: one row per farm per ISO week. Para totals are summed from here.
CREATE TABLE IF NOT EXISTS weekly (
  id         TEXT NOT NULL,
  week       TEXT NOT NULL,
  name       TEXT NOT NULL,
  para       TEXT NOT NULL,
  paddy      INTEGER NOT NULL DEFAULT 0,
  deliveries INTEGER NOT NULL DEFAULT 0,
  kaam       INTEGER NOT NULL DEFAULT 0,
  sights     INTEGER NOT NULL DEFAULT 0,
  earned     INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (id, week)
);
CREATE INDEX IF NOT EXISTS weekly_week_idx ON weekly (week);

-- Who is out in the city: refreshed every few seconds while a player walks around.
CREATE TABLE IF NOT EXISTS presence (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  para TEXT NOT NULL,
  x    REAL NOT NULL,
  z    REAL NOT NULL,
  face REAL NOT NULL,
  t    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS presence_t_idx ON presence (t);

-- Places players asked for from the map ("Missing a place?"). status: new → added / declined, by hand.
CREATE TABLE IF NOT EXISTS place_requests (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  x          INTEGER NOT NULL,   -- game metres east of the origin
  z          INTEGER NOT NULL,   -- game metres south of the origin
  lat        REAL NOT NULL,
  lon        REAL NOT NULL,
  farm       TEXT NOT NULL,      -- the farm's public id
  email      TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS place_requests_created_idx ON place_requests (created_at);
