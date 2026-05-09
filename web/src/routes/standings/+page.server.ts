import type { PageServerLoad } from './$types';
import { getStandings, getActiveSeasonId, getCurrentWeek } from '$lib/server/db';

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env.DB;
  if (!db) {
    // Local Vite dev without D1 — return empty shells so the page renders
    return { standings: [], seasonName: '2025-26', currentWeek: 0 };
  }

  const seasonId = await getActiveSeasonId(db) ?? 1;
  const [standings, currentWeek] = await Promise.all([
    getStandings(db, seasonId),
    getCurrentWeek(db, seasonId),
  ]);

  return { standings, seasonName: '2025-26', currentWeek };
};
