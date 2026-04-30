import type { LayoutServerLoad } from './$types';
import { getActiveSeasonId } from '$lib/server/db';

// Pass auth context and team list to every page in the app.
export const load: LayoutServerLoad = async ({ locals, platform }) => {
  const db = platform?.env.DB;
  let teamNames: string[] = [];

  if (db) {
    try {
      const seasonId = await getActiveSeasonId(db) ?? 1;
      const { results } = await db
        .prepare('SELECT name FROM teams WHERE season_id = ? ORDER BY name')
        .bind(seasonId)
        .all<{ name: string }>();
      teamNames = results.map(t => t.name);
    } catch { /* silently fail during local dev without DB */ }
  }

  return { user: locals.user, teamNames };
};
