import type { PageServerLoad } from './$types';
import { getActiveSeasonId } from '$lib/server/db';
import { RWHA_CAP, RWHA_FLOOR } from '$lib/cap';

export interface DashGame {
  game_id: number;
  week: number;
  is_home: boolean;
  opponent: string;
  team_goals: number;
  opp_goals: number;
  final_label: string;
}

export const load: PageServerLoad = async ({ locals, platform }) => {
  const db     = platform?.env.DB;
  const teamId = locals.user!.teamId;
  if (!db) return { record: null, cap: null, nextGame: null, last5: [], rosterStatus: null, usingComputer: true };

  const seasonId = await getActiveSeasonId(db) ?? 1;

  const [allGamesRes, nextGameRow, capRow, rosterRow, lineRow] = await Promise.all([
    // All completed games for this team (for record + last-5)
    db.prepare(`
      SELECT sg.id AS game_id, sg.week, sg.home_team_id,
             h.name AS home_name, a.name AS away_name,
             r.home_goals, r.away_goals, r.final_label
      FROM scheduled_games sg
      JOIN teams h ON h.id = sg.home_team_id
      JOIN teams a ON a.id = sg.away_team_id
      JOIN game_results r ON r.game_id = sg.id
      WHERE sg.season_id = ? AND (sg.home_team_id = ? OR sg.away_team_id = ?)
      ORDER BY sg.id ASC
    `).bind(seasonId, teamId, teamId).all<{
      game_id: number; week: number; home_team_id: number;
      home_name: string; away_name: string;
      home_goals: number; away_goals: number; final_label: string;
    }>(),

    // Next scheduled game
    db.prepare(`
      SELECT sg.week, sg.home_team_id,
             h.name AS home_name, a.name AS away_name
      FROM scheduled_games sg
      JOIN teams h ON h.id = sg.home_team_id
      JOIN teams a ON a.id = sg.away_team_id
      WHERE sg.season_id = ? AND (sg.home_team_id = ? OR sg.away_team_id = ?)
        AND sg.status = 'scheduled'
      ORDER BY sg.week, sg.id LIMIT 1
    `).bind(seasonId, teamId, teamId).first<{
      week: number; home_team_id: number; home_name: string; away_name: string;
    }>(),

    // Pro cap hit
    db.prepare(`
      SELECT COALESCE(SUM(salary), 0) AS hit
      FROM players WHERE team_id = ? AND roster_level = 'pro' AND salary IS NOT NULL
    `).bind(teamId).first<{ hit: number }>(),

    // Roster counts
    db.prepare(`
      SELECT
        SUM(CASE WHEN roster_level='pro'  AND is_scratch=0 AND is_goalie=0 THEN 1 ELSE 0 END) AS dress_sk,
        SUM(CASE WHEN roster_level='pro'  AND is_scratch=0 AND is_goalie=1 THEN 1 ELSE 0 END) AS dress_g,
        SUM(CASE WHEN roster_level='pro'  AND is_scratch=1 THEN 1 ELSE 0 END)                  AS scratches,
        SUM(CASE WHEN roster_level='farm' THEN 1 ELSE 0 END)                                   AS farm
      FROM players WHERE team_id = ?
    `).bind(teamId).first<{ dress_sk: number; dress_g: number; scratches: number; farm: number }>(),

    // Lines preference
    db.prepare(`SELECT use_computer_lines FROM team_lines WHERE team_id = ?`)
      .bind(teamId).first<{ use_computer_lines: number }>(),
  ]);

  // Process game history
  const games = allGamesRes.results.map(g => {
    const isHome   = g.home_team_id === teamId;
    const tg       = isHome ? g.home_goals : g.away_goals;
    const og       = isHome ? g.away_goals : g.home_goals;
    const opponent = isHome ? g.away_name  : g.home_name;
    return { game_id: g.game_id, week: g.week, is_home: isHome, opponent, team_goals: tg, opp_goals: og, final_label: g.final_label } as DashGame;
  });

  // Compute record
  let w = 0, l = 0, otl = 0, gf = 0, ga = 0;
  for (const g of games) {
    gf += g.team_goals; ga += g.opp_goals;
    if (g.team_goals > g.opp_goals)           w++;
    else if (g.final_label === 'FINAL')        l++;
    else                                       otl++;
  }

  const hit       = capRow?.hit ?? 0;
  const capSpace  = RWHA_CAP   - hit;
  const floorRoom = hit - RWHA_FLOOR;

  return {
    record: { gp: w + l + otl, w, l, otl, pts: w * 2 + otl, gf, ga },
    cap: { hit, capSpace, floorRoom },
    nextGame: nextGameRow ? {
      week:     nextGameRow.week,
      is_home:  nextGameRow.home_team_id === teamId,
      opponent: nextGameRow.home_team_id === teamId ? nextGameRow.away_name : nextGameRow.home_name,
    } : null,
    last5: games.slice(-5).reverse(),   // most recent first
    rosterStatus: rosterRow ?? null,
    usingComputer: (lineRow?.use_computer_lines ?? 1) === 1,
  };
};
