-- ── Beer League Summer Season ─────────────────────────────────────────────────

-- Conference assignment (1 or 2) for schedule generation.
-- Default split: alphabetical first 11 → conference 1, next 11 → conference 2.
ALTER TABLE teams ADD COLUMN conference INTEGER NOT NULL DEFAULT 1;

-- Rivalries: a pair of teams with an intensity level 1–5.
-- team_a_id < team_b_id enforced by the app to avoid duplicate pairs.
CREATE TABLE IF NOT EXISTS rivalries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  team_a_id    INTEGER NOT NULL REFERENCES teams(id),
  team_b_id    INTEGER NOT NULL REFERENCES teams(id),
  level        INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  UNIQUE (team_a_id, team_b_id)
);

CREATE INDEX IF NOT EXISTS idx_rivalries_a ON rivalries(team_a_id);
CREATE INDEX IF NOT EXISTS idx_rivalries_b ON rivalries(team_b_id);

-- Assign conferences: first 11 teams (by id) → conf 1, rest → conf 2.
-- Admins can override via the rivalries/settings page.
UPDATE teams
SET conference = CASE
  WHEN id IN (
    SELECT id FROM teams ORDER BY id LIMIT 11
  ) THEN 1
  ELSE 2
END;
