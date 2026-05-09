import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getActiveSeasonId, getTeamSchedule } from '$lib/server/db';
import type { RosterPlayer } from '../../rosters/+page.server';
import type { TeamGameTotals } from '$engine/types';

export const load: PageServerLoad = async ({ params, platform }) => {
  const db = platform?.env.DB;
  if (!db) throw error(503, 'DB unavailable');

  const seasonId = await getActiveSeasonId(db) ?? 1;
  const slug     = params.slug.toLowerCase();

  const team = await db.prepare(`
    SELECT id, name, gm_name, farm_name, conference, division
    FROM teams WHERE season_id = ? AND LOWER(name) = ?
  `).bind(seasonId, slug).first<{
    id: number; name: string; gm_name: string; farm_name: string | null;
    conference: number | null; division: string | null;
  }>();

  if (!team) throw error(404, `Team "${params.slug}" not found`);

  const [games, playerRows, resultRows, skaterStatRows, goalieStatRows] = await Promise.all([
    getTeamSchedule(db, seasonId, team.id),

    db.prepare(`
      SELECT id, team_id, name, position, is_goalie, roster_level, ov, age, contract_yrs,
             salary, injured_games_remaining, is_scratch, is_personal, nhl_id, attrs
      FROM players WHERE team_id = ?
      ORDER BY roster_level DESC, is_goalie, ov DESC
    `).bind(team.id).all<{
      id: number; team_id: number; name: string; position: string;
      is_goalie: number; roster_level: string; ov: number;
      age: number | null; contract_yrs: number | null; salary: number | null;
      injured_games_remaining: number; is_scratch: number; is_personal: number;
      nhl_id: number | null; attrs: string;
    }>(),

    // Box scores for all completed games — to aggregate team stats
    db.prepare(`
      SELECT sg.id AS game_id, sg.home_team_id,
             r.home_goals, r.away_goals, r.home_sog, r.away_sog,
             r.box_score_json
      FROM scheduled_games sg
      JOIN game_results r ON r.game_id = sg.id
      WHERE sg.season_id = ? AND (sg.home_team_id = ? OR sg.away_team_id = ?)
    `).bind(seasonId, team.id, team.id).all<{
      game_id: number; home_team_id: number;
      home_goals: number; away_goals: number;
      home_sog: number; away_sog: number;
      box_score_json: string;
    }>(),

    // Skater season stats for this team
    db.prepare(`
      SELECT p.id, p.name, p.position,
             COUNT(*)          AS gp,
             SUM(s.g)          AS g,
             SUM(s.a)          AS a,
             SUM(s.g + s.a)    AS pts,
             SUM(s.plus_minus) AS plus_minus,
             SUM(s.sog)        AS sog,
             SUM(s.hits)       AS hits,
             SUM(s.blocks)     AS blocks,
             SUM(s.pim)        AS pim
      FROM skater_game_stats s
      JOIN players p ON p.id = s.player_id
      WHERE s.team_id = ?
      GROUP BY s.player_id
      ORDER BY pts DESC, g DESC
    `).bind(team.id).all<{
      id: number; name: string; position: string;
      gp: number; g: number; a: number; pts: number;
      plus_minus: number; sog: number; hits: number; blocks: number; pim: number;
    }>(),

    // Goalie season stats for this team
    db.prepare(`
      SELECT p.id, p.name,
             COUNT(*)                                                       AS gp,
             SUM(CASE WHEN g.decision = 'W'  THEN 1 ELSE 0 END)           AS w,
             SUM(CASE WHEN g.decision = 'L'  THEN 1 ELSE 0 END)           AS l,
             SUM(CASE WHEN g.decision = 'OT' THEN 1 ELSE 0 END)           AS otl,
             SUM(g.goals_against)                                          AS ga,
             SUM(g.shots_against)                                          AS sa
      FROM goalie_game_stats g
      JOIN players p ON p.id = g.player_id
      WHERE g.team_id = ?
      GROUP BY g.player_id
      ORDER BY w DESC
    `).bind(team.id).all<{
      id: number; name: string;
      gp: number; w: number; l: number; otl: number;
      ga: number; sa: number;
    }>(),
  ]);

  // ── Record ──────────────────────────────────────────────────────────────────
  let w = 0, l = 0, otl = 0, gf = 0, ga = 0;
  for (const g of games) {
    if (g.status !== 'complete') continue;
    const tf = g.team_goals ?? 0, of_ = g.opp_goals ?? 0;
    gf += tf; ga += of_;
    if (tf > of_)                      w++;
    else if (g.final_label === 'FINAL') l++;
    else                               otl++;
  }

  // ── Aggregate team stats from box scores ────────────────────────────────────
  const agg = {
    gp: 0, sog: 0, sogA: 0,
    ppGoals: 0, ppOpps: 0, pkGoalsA: 0, pkOpps: 0,
    foWon: 0, foTotal: 0,
    hits: 0, blocks: 0, pim: 0,
  };

  for (const row of resultRows.results) {
    const isHome = row.home_team_id === team.id;
    let side: TeamGameTotals | null = null;
    let opp: TeamGameTotals | null = null;
    try {
      const box = JSON.parse(row.box_score_json);
      side = isHome ? box.home : box.away;
      opp  = isHome ? box.away : box.home;
    } catch { /* skip malformed */ }
    if (!side || !opp) continue;

    agg.gp++;
    agg.sog      += (side.sogByPeriod ?? []).reduce((s: number, n: number) => s + n, 0);
    agg.sogA     += (opp.sogByPeriod  ?? []).reduce((s: number, n: number) => s + n, 0);
    agg.ppGoals  += side.ppGoals  ?? 0;
    agg.ppOpps   += side.ppOpps   ?? 0;
    agg.pkGoalsA += opp.ppGoals   ?? 0;  // goals allowed on PK = opp PP goals
    agg.pkOpps   += opp.ppOpps    ?? 0;
    agg.foWon    += side.faceoffsWon   ?? 0;
    agg.foTotal  += side.faceoffsTotal ?? 0;
    agg.hits     += side.hits    ?? 0;
    agg.blocks   += side.blocks  ?? 0;
    agg.pim      += side.pim     ?? 0;
  }

  const gp = agg.gp || 1; // avoid divide-by-zero
  const teamStats = {
    gp: agg.gp,
    gf, ga,
    gfPg: +(gf / gp).toFixed(2),
    gaPg: +(ga / gp).toFixed(2),
    sog:  agg.sog,
    sogA: agg.sogA,
    sogPg:  +(agg.sog  / gp).toFixed(1),
    sogAPg: +(agg.sogA / gp).toFixed(1),
    ppGoals: agg.ppGoals, ppOpps: agg.ppOpps,
    ppPct: agg.ppOpps > 0 ? +((agg.ppGoals / agg.ppOpps) * 100).toFixed(1) : 0,
    pkGoalsA: agg.pkGoalsA, pkOpps: agg.pkOpps,
    pkPct: agg.pkOpps > 0 ? +(((agg.pkOpps - agg.pkGoalsA) / agg.pkOpps) * 100).toFixed(1) : 0,
    foPct: agg.foTotal > 0 ? +((agg.foWon / agg.foTotal) * 100).toFixed(1) : 0,
    hitsPg:   +(agg.hits   / gp).toFixed(1),
    blocksPg: +(agg.blocks / gp).toFixed(1),
    pimPg:    +(agg.pim    / gp).toFixed(1),
  };

  // ── Roster ──────────────────────────────────────────────────────────────────
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

  // ── Player stats ────────────────────────────────────────────────────────────
  const skaterStats = skaterStatRows.results;

  const goalieStats = goalieStatRows.results.map(g => {
    const svPct = g.sa > 0 ? +((1 - g.ga / g.sa)).toFixed(3) : 0;
    // GAA needs total minutes — approximate from GP * 60 (full games)
    const gaa  = g.gp > 0 ? +((g.ga / g.gp)).toFixed(2) : 0;
    return { ...g, svPct, gaa };
  });

  return {
    team,
    games,
    record: { gp: w + l + otl, w, l, otl, pts: w * 2 + otl, gf, ga },
    roster,
    teamStats,
    skaterStats,
    goalieStats,
  };
};
