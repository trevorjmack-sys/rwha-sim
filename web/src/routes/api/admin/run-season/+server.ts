// POST /api/admin/run-season
// Auth: commissioner only
//
// Runs ALL remaining unplayed games in the active season, in small batches
// of BATCH_SIZE to stay well within Cloudflare Worker CPU limits.
// Returns: { played: number, message: string }

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getActiveSeasonId } from '$lib/server/db';
import { runGame, pickNextGames } from '$lib/server/sim-bridge';

const BATCH_SIZE = 5;   // safe batch size per inner loop — avoids CF CPU timeout

export const POST: RequestHandler = async ({ locals, platform }) => {
  if (!locals.user?.isCommissioner) {
    throw error(403, 'Commissioner access required');
  }

  const db = platform?.env.DB;
  if (!db) throw error(500, 'Database not available');

  const seasonId = await getActiveSeasonId(db);
  if (!seasonId) throw error(400, 'No active season');

  let played = 0;

  // Keep pulling batches until no games remain
  while (true) {
    const gameIds = await pickNextGames(db, seasonId, BATCH_SIZE);
    if (gameIds.length === 0) break;

    for (const gameId of gameIds) {
      await runGame(db, gameId, seasonId);
      played++;
    }
  }

  return json({ played, message: `Season complete — ${played} games simulated.` });
};
