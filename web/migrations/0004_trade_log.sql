-- ── Trade Log ─────────────────────────────────────────────────────────────────
-- Stores every trade executed by the commissioners.
-- Each trade has two sides (team_a, team_b) and a JSONB-style text payload
-- listing what each team gave up.

CREATE TABLE IF NOT EXISTS trade_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  traded_at     TEXT    NOT NULL,          -- ISO 8601 timestamp
  team_a_id     INTEGER NOT NULL REFERENCES teams(id),
  team_b_id     INTEGER NOT NULL REFERENCES teams(id),
  -- Human-readable summaries of what each team sent
  a_to_b        TEXT    NOT NULL DEFAULT '',  -- comma-separated list
  b_to_a        TEXT    NOT NULL DEFAULT '',
  -- Full detail as JSON for future use
  detail_json   TEXT    NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_trade_log_team_a ON trade_log(team_a_id);
CREATE INDEX IF NOT EXISTS idx_trade_log_team_b ON trade_log(team_b_id);
CREATE INDEX IF NOT EXISTS idx_trade_log_traded_at ON trade_log(traded_at DESC);
