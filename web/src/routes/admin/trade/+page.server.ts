// POST /admin/trade — commissioner-only trade & roster management tool.
// Handles: executing trades (players only) and direct player team transfers.

import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { D1Database } from '@cloudflare/workers-types';

interface TeamRow   { id: number; name: string; abbrev: string; gm_name: string }
interface PlayerRow { id: number; name: string; position: string; ov: number; roster_level: string; is_goalie: number; is_scratch: number }

async function loadTeamAssets(db: D1Database, teamId: number, teams: TeamRow[]) {
  const pl = await db.prepare(
    `SELECT id, name, position, ov, roster_level, is_goalie, is_scratch
     FROM players WHERE team_id = ? AND (is_personal IS NULL OR is_personal = 0)
     ORDER BY roster_level DESC, is_goalie, ov DESC`
  ).bind(teamId).all<PlayerRow>();
  const meta = teams.find(t => t.id === teamId)!;
  return { ...meta, players: pl.results };
}

export const load: PageServerLoad = async ({ url, locals, platform }) => {
  if (!locals.user?.isCommissioner) throw error(403, 'Commissioner access required');

  const db = platform?.env.DB;
  if (!db) throw error(500, 'Database not available');

  const teamAId = Number(url.searchParams.get('teamA')) || null;
  const teamBId = Number(url.searchParams.get('teamB')) || null;
  const traded  = Number(url.searchParams.get('traded')) || null;

  const teamsRes = await db.prepare('SELECT id, name, abbrev, gm_name FROM teams ORDER BY name').all<TeamRow>();
  const teams = teamsRes.results;

  const [teamAData, teamBData] = await Promise.all([
    teamAId ? loadTeamAssets(db, teamAId, teams) : Promise.resolve(null),
    teamBId ? loadTeamAssets(db, teamBId, teams) : Promise.resolve(null),
  ]);

  return { teams, teamAData, teamBData, teamAId, teamBId, traded };
};

export const actions: Actions = {

  // ── Execute trade ─────────────────────────────────────────────────────────
  executeTrade: async ({ request, locals, platform }) => {
    if (!locals.user?.isCommissioner) throw error(403);
    const db = platform?.env.DB;
    if (!db) return fail(500, { error: 'DB unavailable' });

    const form    = await request.formData();
    const teamAId = Number(form.get('team_a_id'));
    const teamBId = Number(form.get('team_b_id'));

    const toArr = (key: string) => form.getAll(key).map(Number).filter(Boolean);
    const aPlayers = toArr('a_player');
    const bPlayers = toArr('b_player');

    const total = aPlayers.length + bPlayers.length;
    if (total === 0) return fail(400, { error: 'No assets selected.' });

    const lookupNames = async (ids: number[]) => {
      if (ids.length === 0) return [] as string[];
      const { results } = await db.prepare(
        `SELECT name FROM players WHERE id IN (${ids.map(() => '?').join(',')})`
      ).bind(...ids).all<{ name: string }>();
      return results.map(r => r.name);
    };

    const [aPlayerNames, bPlayerNames, teamNames] = await Promise.all([
      lookupNames(aPlayers),
      lookupNames(bPlayers),
      db.prepare('SELECT id, name FROM teams WHERE id IN (?, ?)').bind(teamAId, teamBId)
        .all<{ id: number; name: string }>(),
    ]);

    const teamMap  = new Map(teamNames.results.map(t => [t.id, t.name]));
    const teamAName = teamMap.get(teamAId) ?? String(teamAId);
    const teamBName = teamMap.get(teamBId) ?? String(teamBId);

    const aToB = aPlayerNames.join(', ') || '—';
    const bToA = bPlayerNames.join(', ') || '—';

    const stmts = [
      ...aPlayers.map(id => db.prepare('UPDATE players SET team_id = ?, is_scratch = 0 WHERE id = ?').bind(teamBId, id)),
      ...bPlayers.map(id => db.prepare('UPDATE players SET team_id = ?, is_scratch = 0 WHERE id = ?').bind(teamAId, id)),
      db.prepare(
        `INSERT INTO trade_log (traded_at, team_a_id, team_b_id, a_to_b, b_to_a, detail_json)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        new Date().toISOString(), teamAId, teamBId, aToB, bToA,
        JSON.stringify({ teamA: teamAName, teamB: teamBName, aPlayers, bPlayers }),
      ),
    ];

    await db.batch(stmts);
    throw redirect(303, `/admin/trade?teamA=${teamAId}&teamB=${teamBId}&traded=${total}`);
  },

  // ── Direct player team transfer (one-off correction) ─────────────────────
  movePlayer: async ({ request, locals, platform }) => {
    if (!locals.user?.isCommissioner) throw error(403);
    const db = platform?.env.DB;
    if (!db) return fail(500, { error: 'DB unavailable' });
    const form = await request.formData();
    await db.prepare('UPDATE players SET team_id = ?, is_scratch = 0 WHERE id = ?')
      .bind(Number(form.get('to_team_id')), Number(form.get('id'))).run();
    return { success: true, action: 'movePlayer' };
  },
};
