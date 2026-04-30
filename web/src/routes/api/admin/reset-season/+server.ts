// POST /api/admin/reset-season
// Auth: commissioner only
//
// Wipes all results for the active season and resets every game back
// to 'scheduled', so the season can be simulated again from scratch.
// Player injuries/suspensions are also cleared.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getActiveSeasonId } from '$lib/server/db';

export const POST: RequestHandler = async ({ locals, platform }) => {
  if (!locals.user?.isCommissioner) throw error(403, 'Commissioner access required');

  const db = platform?.env.DB;
  if (!db) throw error(500, 'Database not available');

  const seasonId = await getActiveSeasonId(db);
  if (!seasonId) throw error(400, 'No active season');

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
  ]);

  return json({ ok: true });
};
