import type { PageServerLoad } from './$types';
import { getActiveSeasonId } from '$lib/server/db';
import type { FightEvent } from '$engine/types';

export interface WeeklyStar {
  rank: 1 | 2 | 3;
  playerName: string;
  teamName: string;
  g: number;
  a: number;
  pts: number;
}

export interface FightDisplay {
  gameId: number;
  homeName: string;
  awayName: string;
  homeGoals: number;
  awayGoals: number;
  period: number;
  time: string;
  homePlayer: string;
  awayPlayer: string;
  outcome: 'home' | 'away' | 'draw';
  homeGameMisconduct: boolean;
  awayGameMisconduct: boolean;
}

export interface PimLeader {
  playerName: string;
  teamName: string;
  pim: number;
  gp: number;
}

const EMPTY = {
  stars: [] as WeeklyStar[],
  fights: [] as FightDisplay[],
  pimLeaders: [] as PimLeader[],
  week: 0,
  seasonName: '',
};

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env.DB;
  if (!db) return EMPTY;

  const seasonId = await getActiveSeasonId(db) ?? 1;

  const [seasonRow, latestWeekRow] = await Promise.all([
    db.prepare('SELECT name FROM seasons WHERE id = ?')
      .bind(seasonId).first<{ name: string }>(),
    db.prepare(`
      SELECT sg.week
      FROM scheduled_games sg
      JOIN game_results gr ON gr.game_id = sg.id
      WHERE sg.season_id = ?
      ORDER BY sg.week DESC LIMIT 1
    `).bind(seasonId).first<{ week: number }>(),
  ]);

  const seasonName = seasonRow?.name ?? '';
  if (!latestWeekRow) return { ...EMPTY, seasonName };

  const week = latestWeekRow.week;

  // Games from the latest played week with box scores and team names
  const weekGames = await db.prepare(`
    SELECT sg.id AS game_id,
           ht.name AS home_name, at.name AS away_name,
           gr.home_goals, gr.away_goals, gr.box_score_json
    FROM scheduled_games sg
    JOIN teams ht ON ht.id = sg.home_team_id
    JOIN teams at ON at.id = sg.away_team_id
    JOIN game_results gr ON gr.game_id = sg.id
    WHERE sg.season_id = ? AND sg.week = ?
    ORDER BY sg.id
  `).bind(seasonId, week).all<{
    game_id: number;
    home_name: string; away_name: string;
    home_goals: number; away_goals: number;
    box_score_json: string;
  }>();

  // Extract fights from each game's box score
  const fights: FightDisplay[] = [];
  for (const g of weekGames.results) {
    try {
      const box = JSON.parse(g.box_score_json);
      for (const f of (box.fights ?? []) as FightEvent[]) {
        fights.push({
          gameId:  g.game_id,
          homeName: g.home_name,
          awayName: g.away_name,
          homeGoals: g.home_goals,
          awayGoals: g.away_goals,
          period:   f.period,
          time:     f.time,
          homePlayer: f.homePlayer,
          awayPlayer: f.awayPlayer,
          outcome:  f.outcome,
          homeGameMisconduct: f.homeGameMisconduct ?? false,
          awayGameMisconduct: f.awayGameMisconduct ?? false,
        });
      }
    } catch { /* skip malformed box score */ }
  }

  // Three stars of the week — top 3 point scorers across all games this week
  const [starRows, pimRows] = await Promise.all([
    db.prepare(`
      SELECT p.name  AS playerName,
             t.name  AS teamName,
             SUM(s.g)         AS g,
             SUM(s.a)         AS a,
             SUM(s.g + s.a)   AS pts
      FROM skater_game_stats s
      JOIN scheduled_games sg ON sg.id = s.game_id
      JOIN players p ON p.id = s.player_id
      JOIN teams   t ON t.id = s.team_id
      WHERE sg.season_id = ? AND sg.week = ?
      GROUP BY s.player_id
      ORDER BY pts DESC, g DESC
      LIMIT 3
    `).bind(seasonId, week).all<{ playerName: string; teamName: string; g: number; a: number; pts: number }>(),

    // Season PIM leaders
    db.prepare(`
      SELECT p.name  AS playerName,
             t.name  AS teamName,
             SUM(s.pim)  AS pim,
             COUNT(*)    AS gp
      FROM skater_game_stats s
      JOIN scheduled_games sg ON sg.id = s.game_id
      JOIN players p ON p.id = s.player_id
      JOIN teams   t ON t.id = s.team_id
      WHERE sg.season_id = ?
      GROUP BY s.player_id
      ORDER BY pim DESC
      LIMIT 3
    `).bind(seasonId).all<PimLeader>(),
  ]);

  const stars: WeeklyStar[] = starRows.results.map((r, i) => ({
    rank: (i + 1) as 1 | 2 | 3,
    ...r,
  }));

  return { stars, fights, pimLeaders: pimRows.results, week, seasonName };
};
