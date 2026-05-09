// POST /api/admin/run
// Body: { count: 1–5 }
// Auth: commissioner only (checked via locals.user.isCommissioner)
//
// Simulates the next `count` unplayed games in the active season.
// Returns: { games: RunGameResult[] }

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getActiveSeasonId } from '$lib/server/db';
import { runGame, pickNextGames } from '$lib/server/sim-bridge';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
  // Auth check
  if (!locals.user?.isCommissioner) {
    throw error(403, 'Commissioner access required');
  }

  const db = platform?.env.DB;
  if (!db) throw error(500, 'Database not available');

  // Parse body
  // count 1-5  → normal (animated reveal on client)
  // count 6-20 → bulk mode used by "run season" loop
  let count = 1;
  try {
    const body = await request.json() as { count?: number };
    count = Math.min(20, Math.max(1, body.count ?? 1));
  } catch { /* default to 1 */ }

  const seasonId = await getActiveSeasonId(db);
  if (!seasonId) throw error(400, 'No active season');

  // Pick next games
  const gameIds = await pickNextGames(db, seasonId, count);
  if (gameIds.length === 0) {
    return json({ games: [], message: 'All games played — season complete!' });
  }

  // Run each game sequentially (keeps D1 writes clean)
  const results = [];
  for (const gameId of gameIds) {
    try {
      const result = await runGame(db, gameId, seasonId);
      results.push(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json({ games: results, error: `Game ${gameId} failed: ${msg}` }, { status: 500 });
    }
  }

  return json({ games: results });
};
