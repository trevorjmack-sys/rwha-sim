-- ── Migration 0003: Jersey numbers ───────────────────────────────────────────

ALTER TABLE players ADD COLUMN jersey_number INTEGER;

-- Assign 1-N per team, ordered: pro before farm, skaters before goalies, OV desc.
-- GMs can customise from there.
WITH numbered AS (
  SELECT id,
    CAST(ROW_NUMBER() OVER (
      PARTITION BY team_id
      ORDER BY
        CASE roster_level WHEN 'pro' THEN 0 ELSE 1 END,
        is_goalie,
        ov DESC
    ) AS INTEGER) AS rn
  FROM players
)
UPDATE players
SET jersey_number = (SELECT rn FROM numbered WHERE numbered.id = players.id);
