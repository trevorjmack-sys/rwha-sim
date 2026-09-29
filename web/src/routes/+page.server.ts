import type { PageServerLoad } from './$types';
import { getActiveSeasonId } from '$lib/server/db';
import type { FightEvent, GoalEvent, SkaterStatLine } from '$engine/types';
import { compareStars, type StarLine } from '$engine/stars';

export interface WeeklyStar extends StarLine {
  rank: 1 | 2 | 3;
  playerName: string;
  teamName: string;
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
  afterMichigan: boolean;
  afterInjury: boolean;
  goalieFight: boolean;
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

  // Extract fights from each game's box score, and tally each skater's week
  // for the three stars: goals, assists, fights, Gordie Howes, Michigans.
  const fights: FightDisplay[] = [];
  const week_: Map<string, WeeklyStar> = new Map();
  for (const g of weekGames.results) {
    try {
      const box = JSON.parse(g.box_score_json);
      const gameFights = (box.fights ?? []) as FightEvent[];
      const gameGoals  = (box.goals  ?? []) as GoalEvent[];
      const homeName   = box.home?.team ?? g.home_name;
      for (const s of (box.skaters ?? []) as SkaterStatLine[]) {
        const isHome = s.team === homeName;
        const mine = gameFights.filter(f => (isHome ? f.homePlayer : f.awayPlayer) === s.name);
        const michigans = gameGoals.filter(x => x.michigan && x.team === s.team && x.scorer === s.name).length;
        if (s.g + s.a + mine.length === 0) continue;
        const key = `${s.team}|${s.name}`;
        const w = week_.get(key) ?? {
          rank: 1, playerName: s.name, teamName: s.team,
          g: 0, a: 0, pts: 0, fights: 0, fightWins: 0, gordieHowes: 0, michigans: 0,
        } as WeeklyStar;
        w.g += s.g; w.a += s.a; w.pts += s.g + s.a;
        w.fights += mine.length;
        w.fightWins += mine.filter(f => f.outcome === (isHome ? 'home' : 'away')).length;
        if (s.g > 0 && s.a > 0 && mine.length > 0) w.gordieHowes++;
        w.michigans += michigans;
        week_.set(key, w);
      }
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
          afterMichigan: f.afterMichigan ?? false,
          afterInjury: f.afterInjury ?? false,
          goalieFight: f.goalieFight ?? false,
        });
      }
    } catch { /* skip malformed box score */ }
  }

  // Season PIM leaders
  const [pimRows] = await Promise.all([
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

  // Three stars of the week — goals, assists and fights, with bonuses for a
  // Gordie Howe hat trick and a Michigan (see $engine/stars).
  const stars: WeeklyStar[] = [...week_.values()]
    .sort(compareStars)
    .slice(0, 3)
    .map((s, i) => ({ ...s, rank: (i + 1) as 1 | 2 | 3 }));

  return { stars, fights, pimLeaders: pimRows.results, week, seasonName };
};
