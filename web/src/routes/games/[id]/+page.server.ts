import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getGameDetail } from '$lib/server/db';
import type {
  BoxScore, GoalEvent, SkaterStatLine, GoalieStatLine, TeamGameTotals,
} from '$engine/types';

export const load: PageServerLoad = async ({ params, platform }) => {
  const gameId = parseInt(params.id, 10);
  if (isNaN(gameId)) throw error(400, 'Invalid game ID');

  const db = platform?.env.DB;
  if (!db) throw error(503, 'Database not available');

  const row = await getGameDetail(db, gameId);
  if (!row) throw error(404, 'Game not found');

  let box: BoxScore | null = null;
  if (row.box_score_json) {
    try { box = JSON.parse(row.box_score_json) as BoxScore; } catch { /* ignore */ }
  }

  return {
    gameId,
    week: row.week,
    homeName: row.home_name,
    awayName: row.away_name,
    status: row.status,
    homeGoals: row.home_goals,
    awayGoals: row.away_goals,
    finalLabel: row.final_label,
    homeSog: row.home_sog,
    awaySog: row.away_sog,
    simulatedAt: row.simulated_at,
    // box score sections
    homeByPeriod:  box?.home.goalsByPeriod  ?? [],
    awayByPeriod:  box?.away.goalsByPeriod  ?? [],
    homeSogPeriod: box?.home.sogByPeriod    ?? [],
    awaySogPeriod: box?.away.sogByPeriod    ?? [],
    homeStats: box?.home  ?? null,
    awayStats: box?.away  ?? null,
    goals:       box?.goals    ?? [],
    skaters:     box?.skaters  ?? [],
    goalies:     box?.goalies  ?? [],
    threeStars:  box?.threeStars ?? null,
  } satisfies {
    gameId: number;
    week: number;
    homeName: string;
    awayName: string;
    status: string;
    homeGoals: number | null;
    awayGoals: number | null;
    finalLabel: string | null;
    homeSog: number | null;
    awaySog: number | null;
    simulatedAt: string | null;
    homeByPeriod: number[];
    awayByPeriod: number[];
    homeSogPeriod: number[];
    awaySogPeriod: number[];
    homeStats: TeamGameTotals | null;
    awayStats: TeamGameTotals | null;
    goals: GoalEvent[];
    skaters: SkaterStatLine[];
    goalies: GoalieStatLine[];
    threeStars: BoxScore['threeStars'] | null;
  };
};
