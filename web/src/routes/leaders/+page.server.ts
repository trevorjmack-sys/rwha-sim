import type { PageServerLoad } from './$types';
import { getActiveSeasonId, getScoringLeaders, getGoalieLeaders } from '$lib/server/db';

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env.DB;
  if (!db) {
    return { skaters: [], goalies: [] };
  }

  const seasonId = await getActiveSeasonId(db) ?? 1;

  const [skaters, goalies] = await Promise.all([
    getScoringLeaders(db, seasonId, 500),   // load all, sort client-side
    getGoalieLeaders(db, seasonId, 100),
  ]);

  return { skaters, goalies };
};
