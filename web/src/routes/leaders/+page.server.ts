import type { PageServerLoad } from './$types';
import { getActiveSeasonId, getScoringLeaders, getGoalieLeaders } from '$lib/server/db';

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env.DB;
  if (!db) {
    return { skaters: [], goalies: [] };
  }

  const seasonId = await getActiveSeasonId(db) ?? 1;

  const [skaters, goalies] = await Promise.all([
    getScoringLeaders(db, seasonId, 30),
    getGoalieLeaders(db, seasonId, 20),
  ]);

  return { skaters, goalies };
};
