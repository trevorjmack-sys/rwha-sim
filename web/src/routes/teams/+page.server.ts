import type { PageServerLoad } from './$types';
import { getActiveSeasonId, getTeamStats } from '$lib/server/db';

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env.DB;
  if (!db) return { teams: [] };

  const seasonId = await getActiveSeasonId(db) ?? 1;
  const teams    = await getTeamStats(db, seasonId);
  return { teams };
};
