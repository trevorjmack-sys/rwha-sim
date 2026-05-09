import type { PageServerLoad, Actions } from './$types';
import { getActiveSeasonId } from '$lib/server/db';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env.DB;
  if (!db) return { teams: [], rivalries: [] };

  const seasonId = await getActiveSeasonId(db) ?? 1;

  const { results: teams } = await db
    .prepare('SELECT id, name, conference, division FROM teams WHERE season_id = ? ORDER BY conference, division, name')
    .bind(seasonId)
    .all<{ id: number; name: string; conference: number; division: string }>();

  const { results: rivalries } = await db
    .prepare('SELECT id, team_a_id, team_b_id, level FROM rivalries ORDER BY level DESC, id')
    .all<{ id: number; team_a_id: number; team_b_id: number; level: number }>();

  return { teams, rivalries };
};

export const actions: Actions = {
  // Set or update a rivalry between two teams
  setRivalry: async ({ platform, request }) => {
    const db = platform?.env.DB;
    if (!db) return fail(503, { error: 'No DB' });

    const data = await request.formData();
    const teamAId = Number(data.get('team_a_id'));
    const teamBId = Number(data.get('team_b_id'));
    const level   = Number(data.get('level'));

    if (!teamAId || !teamBId || teamAId === teamBId) {
      return fail(400, { error: 'Select two different teams' });
    }
    if (level < 1 || level > 5) {
      return fail(400, { error: 'Level must be 1–5' });
    }

    const [a, b] = teamAId < teamBId ? [teamAId, teamBId] : [teamBId, teamAId];

    await db.prepare(`
      INSERT INTO rivalries (team_a_id, team_b_id, level)
      VALUES (?, ?, ?)
      ON CONFLICT (team_a_id, team_b_id)
      DO UPDATE SET level = excluded.level
    `).bind(a, b, level).run();

    return { success: true };
  },

  removeRivalry: async ({ platform, request }) => {
    const db = platform?.env.DB;
    if (!db) return fail(503, { error: 'No DB' });

    const data = await request.formData();
    const rivalryId = Number(data.get('rivalry_id'));
    if (!rivalryId) return fail(400, { error: 'Missing rivalry id' });

    await db.prepare('DELETE FROM rivalries WHERE id = ?').bind(rivalryId).run();
    return { success: true };
  },

  // Move a team to a different division (and conference, derived from division)
  setDivision: async ({ platform, request }) => {
    const db = platform?.env.DB;
    if (!db) return fail(503, { error: 'No DB' });

    const data = await request.formData();
    const teamId  = Number(data.get('team_id'));
    const division = String(data.get('division') ?? '');

    const divToConf: Record<string, number> = {
      Jofa: 1, Titan: 1, Cooper: 2, CCM: 2,
    };
    const conf = divToConf[division];
    if (!teamId || !conf) {
      return fail(400, { error: 'Invalid team or division' });
    }

    await db.prepare('UPDATE teams SET conference = ?, division = ? WHERE id = ?')
      .bind(conf, division, teamId).run();

    return { success: true };
  },
};
