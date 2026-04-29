import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getActiveSeasonId, getCurrentWeek, getWeekGames } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, platform }) => {
  if (!locals.user?.isCommissioner) {
    throw redirect(303, '/');
  }

  const db = platform?.env.DB;
  if (!db) {
    // Local Vite dev without D1
    return { weekGames: [], currentWeek: 1, totalGames: 902, playedGames: 0, seasonId: 1 };
  }

  const seasonId = await getActiveSeasonId(db) ?? 1;
  const currentWeek = await getCurrentWeek(db, seasonId);

  // Load this week's games AND next week's (in case current week is done)
  const [thisWeek, nextWeek, totals] = await Promise.all([
    getWeekGames(db, seasonId, currentWeek),
    getWeekGames(db, seasonId, currentWeek + 1),
    db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) AS played
      FROM scheduled_games WHERE season_id = ?
    `).bind(seasonId).first<{ total: number; played: number }>(),
  ]);

  // Show next week if current week is fully complete
  const thisComplete = thisWeek.every(g => g.status === 'complete');
  const weekGames = (thisComplete && nextWeek.length > 0) ? nextWeek : thisWeek;
  const displayWeek = (thisComplete && nextWeek.length > 0) ? currentWeek + 1 : currentWeek;

  return {
    weekGames,
    currentWeek: displayWeek,
    totalGames:  totals?.total  ?? 902,
    playedGames: totals?.played ?? 0,
    seasonId,
  };
};
