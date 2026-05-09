// POST /admin/trade — commissioner-only trade & roster management tool.
// Handles: executing trades, adding/deleting/moving prospects, adding/deleting/moving picks,
// and direct player team transfers.

import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { D1Database } from '@cloudflare/workers-types';

interface TeamRow   { id: number; name: string; abbrev: string; gm_name: string }
interface PlayerRow { id: number; name: string; position: string; ov: number; roster_level: string; is_goalie: number; is_scratch: number }
interface ProspRow  { id: number; team_id: number; team_name: string; name: string; draft_year: number | null; draft_overall: number | null }
interface PickRow   { id: number; owner_team_id: number; owner_team_name: string; owner_abbrev: string; original_abbrev: string; year: number; round: number }

async function loadTeamAssets(db: D1Database, teamId: number, teams: TeamRow[]) {
  const [pl, pr, pk] = await Promise.all([
    db.prepare(`SELECT id, name, position, ov, roster_level, is_goalie, is_scratch
                FROM players WHERE team_id = ? AND (is_personal IS NULL OR is_personal = 0)
                ORDER BY roster_level DESC, is_goalie, ov DESC`).bind(teamId).all<PlayerRow>(),
    db.prepare(`SELECT id, name, draft_year, draft_overall FROM prospects
                WHERE team_id = ? ORDER BY draft_year NULLS LAST, draft_overall NULLS LAST, name`).bind(teamId).all<{ id:number; name:string; draft_year:number|null; draft_overall:number|null }>(),
    db.prepare(`SELECT id, original_abbrev, year, round FROM draft_picks
                WHERE owner_team_id = ? ORDER BY year, round, original_abbrev`).bind(teamId).all<{ id:number; original_abbrev:string; year:number; round:number }>(),
  ]);
  const meta = teams.find(t => t.id === teamId)!;
  return { ...meta, players: pl.results, prospects: pr.results, picks: pk.results };
}

export const load: PageServerLoad = async ({ url, locals, platform }) => {
  if (!locals.user?.isCommissioner) throw error(403, 'Commissioner access required');

  const db = platform?.env.DB;
  if (!db) throw error(500, 'Database not available');

  const teamAId = Number(url.searchParams.get('teamA')) || null;
  const teamBId = Number(url.searchParams.get('teamB')) || null;
  const traded  = Number(url.searchParams.get('traded')) || null;

  const [teamsRes, prospectsRes, picksRes] = await Promise.all([
    db.prepare('SELECT id, name, abbrev, gm_name FROM teams ORDER BY name').all<TeamRow>(),
    db.prepare(`SELECT p.id, p.team_id, t.name as team_name, p.name, p.draft_year, p.draft_overall
                FROM prospects p JOIN teams t ON t.id = p.team_id
                ORDER BY t.name, p.draft_year NULLS LAST, p.draft_overall NULLS LAST, p.name`).all<ProspRow>(),
    db.prepare(`SELECT dp.id, dp.owner_team_id, t.name as owner_team_name, t.abbrev as owner_abbrev,
                       dp.original_abbrev, dp.year, dp.round
                FROM draft_picks dp JOIN teams t ON t.id = dp.owner_team_id
                ORDER BY t.name, dp.year, dp.round, dp.original_abbrev`).all<PickRow>(),
  ]);

  const teams = teamsRes.results;

  const [teamAData, teamBData] = await Promise.all([
    teamAId ? loadTeamAssets(db, teamAId, teams) : Promise.resolve(null),
    teamBId ? loadTeamAssets(db, teamBId, teams) : Promise.resolve(null),
  ]);

  return { teams, teamAData, teamBData, teamAId, teamBId, traded, prospects: prospectsRes.results, picks: picksRes.results };
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
    const aPlayers   = toArr('a_player');
    const bPlayers   = toArr('b_player');
    const aProspects = toArr('a_prospect');
    const bProspects = toArr('b_prospect');
    const aPicks     = toArr('a_pick');
    const bPicks     = toArr('b_pick');

    const total = aPlayers.length + bPlayers.length + aProspects.length + bProspects.length + aPicks.length + bPicks.length;
    if (total === 0) return fail(400, { error: 'No assets selected.' });

    // Look up names for the trade log before moving anything
    const lookupNames = async (ids: number[], table: string, nameCol = 'name') => {
      if (ids.length === 0) return [] as string[];
      const { results } = await db.prepare(
        `SELECT ${nameCol} FROM ${table} WHERE id IN (${ids.map(() => '?').join(',')})`
      ).bind(...ids).all<{ [k: string]: string }>();
      return results.map(r => r[nameCol] as string);
    };
    const lookupPickLabels = async (ids: number[]) => {
      if (ids.length === 0) return [] as string[];
      const { results } = await db.prepare(
        `SELECT original_abbrev, year, round FROM draft_picks WHERE id IN (${ids.map(() => '?').join(',')})`
      ).bind(...ids).all<{ original_abbrev: string; year: number; round: number }>();
      return results.map(r => `${r.year} R${r.round} (${r.original_abbrev})`);
    };

    const [aPlayerNames, bPlayerNames, aProspNames, bProspNames, aPickLabels, bPickLabels, teamNames] =
      await Promise.all([
        lookupNames(aPlayers, 'players'),
        lookupNames(bPlayers, 'players'),
        lookupNames(aProspects, 'prospects'),
        lookupNames(bProspects, 'prospects'),
        lookupPickLabels(aPicks),
        lookupPickLabels(bPicks),
        db.prepare('SELECT id, name FROM teams WHERE id IN (?, ?)').bind(teamAId, teamBId)
          .all<{ id: number; name: string }>(),
      ]);

    const teamMap = new Map(teamNames.results.map(t => [t.id, t.name]));
    const teamAName = teamMap.get(teamAId) ?? String(teamAId);
    const teamBName = teamMap.get(teamBId) ?? String(teamBId);

    // a_to_b = what team A gives to team B
    const aToB = [...aPlayerNames, ...aProspNames, ...aPickLabels].join(', ') || '—';
    const bToA = [...bPlayerNames, ...bProspNames, ...bPickLabels].join(', ') || '—';

    const stmts = [
      ...aPlayers.map(id   => db.prepare('UPDATE players    SET team_id = ?, is_scratch = 0 WHERE id = ?').bind(teamBId, id)),
      ...bPlayers.map(id   => db.prepare('UPDATE players    SET team_id = ?, is_scratch = 0 WHERE id = ?').bind(teamAId, id)),
      ...aProspects.map(id => db.prepare('UPDATE prospects  SET team_id = ? WHERE id = ?').bind(teamBId, id)),
      ...bProspects.map(id => db.prepare('UPDATE prospects  SET team_id = ? WHERE id = ?').bind(teamAId, id)),
      ...aPicks.map(id     => db.prepare('UPDATE draft_picks SET owner_team_id = ? WHERE id = ?').bind(teamBId, id)),
      ...bPicks.map(id     => db.prepare('UPDATE draft_picks SET owner_team_id = ? WHERE id = ?').bind(teamAId, id)),
      // Write trade log entry
      db.prepare(
        `INSERT INTO trade_log (traded_at, team_a_id, team_b_id, a_to_b, b_to_a, detail_json)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        new Date().toISOString(), teamAId, teamBId, aToB, bToA,
        JSON.stringify({ teamA: teamAName, teamB: teamBName, aPlayers, bPlayers, aProspects, bProspects, aPicks, bPicks }),
      ),
    ];

    await db.batch(stmts);
    throw redirect(303, `/admin/trade?teamA=${teamAId}&teamB=${teamBId}&traded=${total}`);
  },

  // ── Prospect actions ──────────────────────────────────────────────────────
  addProspect: async ({ request, locals, platform }) => {
    if (!locals.user?.isCommissioner) throw error(403);
    const db = platform?.env.DB;
    if (!db) return fail(500, { error: 'DB unavailable' });

    const form    = await request.formData();
    const teamId  = Number(form.get('team_id'));
    const name    = String(form.get('name') ?? '').trim();
    const dy      = form.get('draft_year')    ? Number(form.get('draft_year'))    : null;
    const overall = form.get('draft_overall') ? Number(form.get('draft_overall')) : null;

    if (!teamId || !name) return fail(400, { error: 'Team and name are required.' });
    await db.prepare('INSERT INTO prospects (team_id, name, draft_year, draft_overall) VALUES (?,?,?,?)')
      .bind(teamId, name, dy, overall).run();
    return { success: true, action: 'addProspect' };
  },

  deleteProspect: async ({ request, locals, platform }) => {
    if (!locals.user?.isCommissioner) throw error(403);
    const db = platform?.env.DB;
    if (!db) return fail(500, { error: 'DB unavailable' });
    const form = await request.formData();
    await db.prepare('DELETE FROM prospects WHERE id = ?').bind(Number(form.get('id'))).run();
    return { success: true, action: 'deleteProspect' };
  },

  moveProspect: async ({ request, locals, platform }) => {
    if (!locals.user?.isCommissioner) throw error(403);
    const db = platform?.env.DB;
    if (!db) return fail(500, { error: 'DB unavailable' });
    const form = await request.formData();
    await db.prepare('UPDATE prospects SET team_id = ? WHERE id = ?')
      .bind(Number(form.get('to_team_id')), Number(form.get('id'))).run();
    return { success: true, action: 'moveProspect' };
  },

  // ── Pick actions ──────────────────────────────────────────────────────────
  addPick: async ({ request, locals, platform }) => {
    if (!locals.user?.isCommissioner) throw error(403);
    const db = platform?.env.DB;
    if (!db) return fail(500, { error: 'DB unavailable' });

    const form    = await request.formData();
    const owner   = Number(form.get('owner_team_id'));
    const abbrev  = String(form.get('original_abbrev') ?? '').trim().toUpperCase();
    const year    = Number(form.get('year'));
    const round   = Number(form.get('round'));

    if (!owner || !abbrev || !year || !round) return fail(400, { error: 'All fields required.' });
    await db.prepare('INSERT INTO draft_picks (owner_team_id, original_abbrev, year, round) VALUES (?,?,?,?)')
      .bind(owner, abbrev, year, round).run();
    return { success: true, action: 'addPick' };
  },

  deletePick: async ({ request, locals, platform }) => {
    if (!locals.user?.isCommissioner) throw error(403);
    const db = platform?.env.DB;
    if (!db) return fail(500, { error: 'DB unavailable' });
    const form = await request.formData();
    await db.prepare('DELETE FROM draft_picks WHERE id = ?').bind(Number(form.get('id'))).run();
    return { success: true, action: 'deletePick' };
  },

  movePick: async ({ request, locals, platform }) => {
    if (!locals.user?.isCommissioner) throw error(403);
    const db = platform?.env.DB;
    if (!db) return fail(500, { error: 'DB unavailable' });
    const form = await request.formData();
    await db.prepare('UPDATE draft_picks SET owner_team_id = ? WHERE id = ?')
      .bind(Number(form.get('to_team_id')), Number(form.get('id'))).run();
    return { success: true, action: 'movePick' };
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
