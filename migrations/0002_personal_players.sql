-- ── RWHA Sim — Migration 0002: personal players ─────────────────────────────
-- Run against production:
--   npx wrangler d1 execute rwha-sim --remote --file=migrations/0002_personal_players.sql
-- Local dev:
--   npx wrangler d1 execute rwha-sim --local --file=migrations/0002_personal_players.sql

ALTER TABLE players ADD COLUMN is_personal INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_players_personal ON players(is_personal);
