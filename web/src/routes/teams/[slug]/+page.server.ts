import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getActiveSeasonId, getTeamSchedule } from '$lib/server/db';
import type { RosterPlayer } from '../../rosters/+page.server';

export const load: PageServerLoad = async ({ params, platform }) => {
  const db = platform?.env.DB;
  if (!db) throw error(503, 'DB unavailable');

  const seasonId = await getActiveSeasonId(db) ?? 1;
  const slug     = params.slug.toLowerCase();

  // Look up team by lowercased name
  const team = await db.prepare(`
    SELECT id, name, gm_name, farm_name
    FROM teams WHERE season_id = ? AND LOWER(name) = ?
  `).bind(seasonId, slug).first<{
    id: number; name: string; gm_name: string; farm_name: string | null;
  }>();

  if (!team) throw error(404, `Team "${params.slug}" not found`);

  const [games, playerRows] = await Promise.all([
    getTeamSchedule(db, seasonId, team.id),
    db.prepare(`
      SELECT id, team_id, name, position, is_goalie, roster_level, ov, age, contract_yrs,
             salary, injured_games_remaining, is_scratch, is_personal, attrs
      FROM players WHERE team_id = ?
      ORDER BY roster_level DESC, is_goalie, ov DESC
    `).bind(team.id).all<{
      id: number; team_id: number; name: string; position: string;
      is_goalie: number; roster_level: string; ov: number;
      age: number | null; contract_yrs: number | null; salary: number | null;
      injured_games_remaining: number; is_scratch: number; is_personal: number;
      attrs: string;
    }>(),
  ]);

  // Compute record from completed games
  let w = 0, l = 0, otl = 0, gf = 0, ga = 0;
  for (const g of games) {
    if (g.status !== 'complete') continue;
    const tf = g.team_goals ?? 0;
    const of_ = g.opp_goals ?? 0;
    gf += tf; ga += of_;
    if (tf > of_)                      w++;
    else if (g.final_label === 'FINAL') l++;
    else                               otl++;
  }

  // Build roster — forwards first, then D, goalies separate
  const parse = (p: typeof playerRows.results[0]): RosterPlayer & { is_personal: number } => ({
    ...p,
    attrs: (() => { try { return JSON.parse(p.attrs); } catch { return {}; } })(),
  });

  const isD = (pos: string) => pos.split('/').some(p => p === 'D' || /^[LR]D$/.test(p));

  const pro  = playerRows.results.filter(p => p.roster_level === 'pro');
  const farm = playerRows.results.filter(p => p.roster_level === 'farm');

  const roster = {
    proSkaters:  [
      ...pro.filter(p => !p.is_goalie && !isD(p.position)).map(parse),
      ...pro.filter(p => !p.is_goalie &&  isD(p.position)).map(parse),
    ],
    proGoalies:  pro.filter(p => p.is_goalie).map(parse),
    farmSkaters: [
      ...farm.filter(p => !p.is_goalie && !isD(p.position)).map(parse),
      ...farm.filter(p => !p.is_goalie &&  isD(p.position)).map(parse),
    ],
    farmGoalies: farm.filter(p => p.is_goalie).map(parse),
  };

  return {
    team,
    games,
    record: { gp: w + l + otl, w, l, otl, pts: w * 2 + otl, gf, ga },
    roster,
  };
};
