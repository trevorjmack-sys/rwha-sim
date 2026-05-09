// PATCH /api/gm/jersey
// Body: { playerId: number, jerseyNumber: number }
// Auth: GM (must own the player's team) or commissioner
//
// Validates no duplicate jersey numbers on the PRO roster of the same team.
// Farm roster duplicates are allowed.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ request, locals, platform }) => {
  if (!locals.user) throw error(401, 'Not signed in');

  const db = platform?.env.DB;
  if (!db) throw error(500, 'Database not available');

  const body = await request.json() as { playerId?: number; jerseyNumber?: number };
  const { playerId, jerseyNumber } = body;

  if (!playerId || jerseyNumber == null) {
    throw error(400, 'playerId and jerseyNumber are required');
  }
  if (!Number.isInteger(jerseyNumber) || jerseyNumber < 1 || jerseyNumber > 99) {
    throw error(400, 'Jersey number must be between 1 and 99');
  }

  // Load the player to verify ownership
  const player = await db
    .prepare('SELECT id, team_id, roster_level, name FROM players WHERE id = ?')
    .bind(playerId)
    .first<{ id: number; team_id: number; roster_level: string; name: string }>();

  if (!player) throw error(404, 'Player not found');

  // Auth: must be the team's GM or a commissioner
  if (!locals.user.isCommissioner && locals.user.teamId !== player.team_id) {
    throw error(403, 'You can only edit your own team\'s jersey numbers');
  }

  // Duplicate check — pro roster only
  if (player.roster_level === 'pro') {
    const conflict = await db
      .prepare(`SELECT name FROM players
                WHERE team_id = ? AND roster_level = 'pro'
                  AND jersey_number = ? AND id != ?`)
      .bind(player.team_id, jerseyNumber, playerId)
      .first<{ name: string }>();

    if (conflict) {
      return json({ error: `#${jerseyNumber} is already worn by ${conflict.name}` }, { status: 409 });
    }
  }

  await db
    .prepare('UPDATE players SET jersey_number = ? WHERE id = ?')
    .bind(jerseyNumber, playerId)
    .run();

  return json({ ok: true });
};
