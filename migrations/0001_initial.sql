-- ── RWHA Sim — D1 schema ────────────────────────────────────────────────────
-- Run with: npx wrangler d1 execute rwha-sim --file=migrations/0001_initial.sql
-- Local dev: npx wrangler d1 execute rwha-sim --local --file=migrations/0001_initial.sql

-- Seasons --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seasons (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  name   TEXT    NOT NULL,           -- "2025-26"
  status TEXT    NOT NULL DEFAULT 'active'
         CHECK (status IN ('setup','active','playoffs','complete'))
);

-- Teams ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id        INTEGER NOT NULL REFERENCES seasons(id),
  name             TEXT    NOT NULL,
  gm_name          TEXT    NOT NULL,
  gm_email         TEXT    NOT NULL,
  farm_name        TEXT,
  is_commissioner  INTEGER NOT NULL DEFAULT 0   -- 1 for Dean + Trevor
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_name_season ON teams(name, season_id);
CREATE        INDEX IF NOT EXISTS idx_teams_email       ON teams(gm_email);

-- Players --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS players (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id                     INTEGER NOT NULL REFERENCES teams(id),
  name                        TEXT    NOT NULL,
  position                    TEXT    NOT NULL,
  is_goalie                   INTEGER NOT NULL DEFAULT 0,
  ov                          INTEGER NOT NULL,
  attrs                       TEXT    NOT NULL,  -- JSON: {"ck":70,"fg":55,...}
  age                         INTEGER,
  contract_yrs                INTEGER,
  salary                      INTEGER,           -- dollars
  roster_level                TEXT    NOT NULL DEFAULT 'pro'
                              CHECK (roster_level IN ('pro','farm')),
  is_scratch                  INTEGER NOT NULL DEFAULT 0,
  -- Stub fields — Phase 4 will flesh these out fully
  injured_games_remaining     INTEGER NOT NULL DEFAULT 0,
  suspended_games_remaining   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_players_team    ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_goalie  ON players(team_id, is_goalie);

-- Scheduled games ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduled_games (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id    INTEGER NOT NULL REFERENCES seasons(id),
  week         INTEGER NOT NULL,
  home_team_id INTEGER NOT NULL REFERENCES teams(id),
  away_team_id INTEGER NOT NULL REFERENCES teams(id),
  status       TEXT    NOT NULL DEFAULT 'scheduled'
               CHECK (status IN ('scheduled','complete')),
  played_at    TEXT    -- ISO-8601 timestamp, NULL until played
);
CREATE INDEX IF NOT EXISTS idx_games_week    ON scheduled_games(season_id, week);
CREATE INDEX IF NOT EXISTS idx_games_status  ON scheduled_games(status);

-- Game results ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_results (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id        INTEGER NOT NULL UNIQUE REFERENCES scheduled_games(id),
  home_goals     INTEGER NOT NULL,
  away_goals     INTEGER NOT NULL,
  final_label    TEXT    NOT NULL,
  home_sog       INTEGER NOT NULL,
  away_sog       INTEGER NOT NULL,
  box_score_json TEXT    NOT NULL,   -- full BoxScore, JSON-serialised
  sim_seed       INTEGER NOT NULL,
  simulated_at   TEXT    NOT NULL
);

-- Per-skater game stats -------------------------------------------------------
CREATE TABLE IF NOT EXISTS skater_game_stats (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id     INTEGER NOT NULL REFERENCES scheduled_games(id),
  player_id   INTEGER NOT NULL REFERENCES players(id),
  team_id     INTEGER NOT NULL REFERENCES teams(id),
  g           INTEGER NOT NULL DEFAULT 0,
  a           INTEGER NOT NULL DEFAULT 0,
  plus_minus  INTEGER NOT NULL DEFAULT 0,
  sog         INTEGER NOT NULL DEFAULT 0,
  hits        INTEGER NOT NULL DEFAULT 0,
  blocks      INTEGER NOT NULL DEFAULT 0,
  pim         INTEGER NOT NULL DEFAULT 0,
  toi         TEXT
);
CREATE INDEX IF NOT EXISTS idx_sgs_player ON skater_game_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_sgs_game   ON skater_game_stats(game_id);

-- Per-goalie game stats -------------------------------------------------------
CREATE TABLE IF NOT EXISTS goalie_game_stats (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id       INTEGER NOT NULL REFERENCES scheduled_games(id),
  player_id     INTEGER NOT NULL REFERENCES players(id),
  team_id       INTEGER NOT NULL REFERENCES teams(id),
  decision      TEXT,              -- 'W' | 'L' | 'OT' | '-'
  shots_against INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0,
  toi           TEXT
);
CREATE INDEX IF NOT EXISTS idx_ggs_player ON goalie_game_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_ggs_game   ON goalie_game_stats(game_id);

-- Team lines (carry-over until changed) --------------------------------------
CREATE TABLE IF NOT EXISTS team_lines (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id            INTEGER NOT NULL UNIQUE REFERENCES teams(id),
  use_computer_lines INTEGER NOT NULL DEFAULT 1,  -- 1 until GM sets manually
  lines_json         TEXT,      -- NULL when use_computer_lines = 1
  updated_at         TEXT
);
