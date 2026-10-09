-- Haora Bari · Agartala on Cloudflare D1. Apply with: npm run cf:db  (or --local for wrangler dev)
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
