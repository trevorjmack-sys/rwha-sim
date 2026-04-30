import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getTeamPlayers, getActiveSeasonId } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, platform }) => {
  const db = platform?.env.DB;
  if (!db) return { players: [], nextGame: null };

  const seasonId = await getActiveSeasonId(db) ?? 1;
  const teamId   = locals.user!.teamId;

  const [players, nextGameRow] = await Promise.all([
    getTeamPlayers(db, teamId),
    db.prepare(`
      SELECT sg.week, sg.home_team_id,
             h.name AS home_name, a.name AS away_name
      FROM scheduled_games sg
      JOIN teams h ON h.id = sg.home_team_id
      JOIN teams a ON a.id = sg.away_team_id
      WHERE sg.season_id = ?
        AND (sg.home_team_id = ? OR sg.away_team_id = ?)
        AND sg.status = 'scheduled'
      ORDER BY sg.week, sg.id
      LIMIT 1
    `).bind(seasonId, teamId, teamId).first<{
      week: number; home_team_id: number;
      home_name: string; away_name: string;
    }>(),
  ]);

  const nextGame = nextGameRow ? {
    week:     nextGameRow.week,
    is_home:  nextGameRow.home_team_id === teamId,
    opponent: nextGameRow.home_team_id === teamId
      ? nextGameRow.away_name : nextGameRow.home_name,
  } : null;

  return { players, nextGame };
};

export const actions: Actions = {
  saveRoster: async ({ request, locals, platform }) => {
    const db = platform?.env.DB;
    if (!db) return fail(503, { error: 'DB unavailable' });

    const data = await request.formData();
    const movesRaw = data.get('moves');
    if (!movesRaw) return { ok: true };

    let moves: Array<{ id: number; roster_level: string; is_scratch: number }>;
    try {
      moves = JSON.parse(String(movesRaw));
    } catch {
      return fail(400, { error: 'Invalid roster data' });
    }

    const teamId = locals.user!.teamId;
    const stmts  = moves
      .filter(m => typeof m.id === 'number' && ['pro', 'farm'].includes(m.roster_level))
      .map(m =>
        db.prepare(`UPDATE players SET roster_level = ?, is_scratch = ? WHERE id = ? AND team_id = ?`)
          .bind(m.roster_level, m.is_scratch ? 1 : 0, m.id, teamId)
      );

    if (stmts.length > 0) await db.batch(stmts);
    return { ok: true };
  },
};
