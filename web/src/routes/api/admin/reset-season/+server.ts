// POST /api/admin/reset-season
// Auth: commissioner only
//
// Wipes all results for the active season and resets every game back
// to 'scheduled', so the season can be simulated again from scratch.
// Player injuries/suspensions are also cleared.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getActiveSeasonId } from '$lib/server/db';
import { generateSchedule, type TeamEntry } from '$engine/schedule';

export const POST: RequestHandler = async ({ locals, platform }) => {
  if (!locals.user?.isCommissioner) throw error(403, 'Commissioner access required');

  const db = platform?.env.DB;
  if (!db) throw error(500, 'Database not available');

  const seasonId = await getActiveSeasonId(db);
  if (!seasonId) throw error(400, 'No active season');

  // Load teams for schedule generation
  const { results: teamRows } = await db.prepare(`
    SELECT id, name, conference FROM teams WHERE season_id = ? ORDER BY id
  `).bind(seasonId).all<{ id: number; name: string; conference: number }>();

  // Build team name → id map (needed for inserting games)
  const teamIdByName = new Map<string, number>(teamRows.map(t => [t.name, t.id]));

  // Generate a fresh schedule
  const entries: TeamEntry[] = teamRows.map(t => ({
    name:       t.name,
    conference: t.conference as 1 | 2,
  }));
  const seed = Date.now() % 0x7fffffff;
  const newSchedule = generateSchedule(entries, seed);

  await db.batch([
    // Wipe per-game player stats
    db.prepare(`
      DELETE FROM skater_game_stats
      WHERE game_id IN (SELECT id FROM scheduled_games WHERE season_id = ?)
    `).bind(seasonId),

    db.prepare(`
      DELETE FROM goalie_game_stats
      WHERE game_id IN (SELECT id FROM scheduled_games WHERE season_id = ?)
    `).bind(seasonId),

    // Wipe results
    db.prepare(`
      DELETE FROM game_results
      WHERE game_id IN (SELECT id FROM scheduled_games WHERE season_id = ?)
    `).bind(seasonId),

    // Reset all games to scheduled
    db.prepare(`
      UPDATE scheduled_games
      SET status = 'scheduled', played_at = NULL
      WHERE season_id = ?
    `).bind(seasonId),

    // Clear player injuries / suspensions
    db.prepare(`
      UPDATE players
      SET injured_games_remaining = 0, suspended_games_remaining = 0
      WHERE team_id IN (SELECT id FROM teams WHERE season_id = ?)
    `).bind(seasonId),

    // Delete old scheduled games (stats + results already deleted above)
    db.prepare(`DELETE FROM scheduled_games WHERE season_id = ?`).bind(seasonId),

    // Reset autoincrement so new games start at #1000
    db.prepare(`INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('scheduled_games', 999)`),
  ]);

  // Insert new schedule in batches of 100 (D1 limit)
  const insertStmts = newSchedule.map(g =>
    db.prepare(`
      INSERT INTO scheduled_games (season_id, week, home_team_id, away_team_id, status)
      VALUES (?, ?, ?, ?, 'scheduled')
    `).bind(
      seasonId,
      g.week,
      teamIdByName.get(g.homeTeam)!,
      teamIdByName.get(g.awayTeam)!,
    )
  );

  const BATCH_SIZE = 100;
  for (let i = 0; i < insertStmts.length; i += BATCH_SIZE) {
    await db.batch(insertStmts.slice(i, i + BATCH_SIZE));
  }

  return json({ ok: true, gamesGenerated: newSchedule.length });
};
