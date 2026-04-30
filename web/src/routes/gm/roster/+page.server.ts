import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getTeamPlayers } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, platform }) => {
  const db = platform?.env.DB;
  if (!db) return { players: [] };

  const players = await getTeamPlayers(db, locals.user!.teamId);
  return { players };
};

export const actions: Actions = {
  saveRoster: async ({ request, locals, platform }) => {
    const db = platform?.env.DB;
    if (!db) return fail(503, { error: 'DB unavailable' });

    const data = await request.formData();
    const movesRaw = data.get('moves');
    if (!movesRaw) return { ok: true }; // nothing to do

    let moves: Array<{ id: number; roster_level: string; is_scratch: number }>;
    try {
      moves = JSON.parse(String(movesRaw));
    } catch {
      return fail(400, { error: 'Invalid roster data' });
    }

    const teamId = locals.user!.teamId;

    // Batch all updates in one D1 round-trip
    const stmts = moves
      .filter(m => typeof m.id === 'number' && ['pro', 'farm'].includes(m.roster_level))
      .map(m =>
        db.prepare(`UPDATE players SET roster_level = ?, is_scratch = ? WHERE id = ? AND team_id = ?`)
          .bind(m.roster_level, m.is_scratch ? 1 : 0, m.id, teamId)
      );

    if (stmts.length > 0) await db.batch(stmts);

    return { ok: true };
  },
};
