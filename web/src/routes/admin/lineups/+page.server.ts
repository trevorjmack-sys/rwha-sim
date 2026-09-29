// /admin/lineups — commissioner view of every team's lineup setup, with a way
// to hand a team (or all teams) back to the computer: computer-set lines and
// no scratches, so the sim dresses the best available players by OV.

import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import type { D1Database } from '@cloudflare/workers-types';
import { getActiveSeasonId } from '$lib/server/db';

export interface LineupStatus {
  id: number;
  name: string;
  gm_name: string;
  use_computer: number;      // 1 = computer lines
  gm_saved_at: string | null;
  scratches: number;
  injured: number;
}

export const load: PageServerLoad = async ({ locals, platform }) => {
  if (!locals.user?.isCommissioner) throw redirect(303, '/');
  const db = platform?.env.DB;
  if (!db) return { teams: [] as LineupStatus[] };

  const seasonId = await getActiveSeasonId(db) ?? 1;
  const { results: teams } = await db.prepare(`
    SELECT t.id, t.name, t.gm_name,
           COALESCE(tl.use_computer_lines, 1) AS use_computer,
           tl.updated_at AS gm_saved_at,
           (SELECT COUNT(*) FROM players p WHERE p.team_id = t.id AND p.is_active = 1
              AND p.roster_level = 'pro' AND p.is_scratch = 1) AS scratches,
           (SELECT COUNT(*) FROM players p WHERE p.team_id = t.id AND p.is_active = 1
              AND p.roster_level = 'pro' AND p.injured_games_remaining > 0) AS injured
    FROM teams t
    LEFT JOIN team_lines tl ON tl.team_id = t.id
    WHERE t.season_id = ?
    ORDER BY t.name
  `).bind(seasonId).all<LineupStatus>();

  return { teams };
};

/** Computer lines + clear scratches for the given teams. GM's saved lines are
 *  kept (not deleted) so the GM can switch back to them from the Lines page. */
async function setComputer(db: D1Database, teamIds: number[]) {
  const stmts = teamIds.flatMap(id => [
    db.prepare(`
      INSERT INTO team_lines (team_id, use_computer_lines) VALUES (?, 1)
      ON CONFLICT(team_id) DO UPDATE SET use_computer_lines = 1
    `).bind(id),
    db.prepare(`
      UPDATE players SET is_scratch = 0
      WHERE team_id = ? AND roster_level = 'pro' AND is_active = 1
    `).bind(id),
  ]);
  for (let i = 0; i < stmts.length; i += 90) await db.batch(stmts.slice(i, i + 90));
}

export const actions: Actions = {
  computerOne: async ({ locals, platform, request }) => {
    if (!locals.user?.isCommissioner) throw error(403, 'Commissioner access required');
    const db = platform?.env.DB;
    if (!db) return fail(503, { error: 'No DB' });
    const teamId = Number((await request.formData()).get('team_id'));
    if (!teamId) return fail(400, { error: 'Missing team' });
    await setComputer(db, [teamId]);
    return { success: true, count: 1 };
  },

  computerAll: async ({ locals, platform }) => {
    if (!locals.user?.isCommissioner) throw error(403, 'Commissioner access required');
    const db = platform?.env.DB;
    if (!db) return fail(503, { error: 'No DB' });
    const seasonId = await getActiveSeasonId(db) ?? 1;
    const { results } = await db.prepare(`SELECT id FROM teams WHERE season_id = ?`)
      .bind(seasonId).all<{ id: number }>();
    await setComputer(db, results.map(r => r.id));
    return { success: true, count: results.length };
  },
};
