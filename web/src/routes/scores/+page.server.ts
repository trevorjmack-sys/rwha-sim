import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  getActiveSeasonId,
  getPlayedWeeks,
  getWeekResults,
} from '$lib/server/db';

export const load: PageServerLoad = async ({ url, platform }) => {
  const db = platform?.env.DB;
  if (!db) {
    return { games: [], playedWeeks: [], week: 1, seasonId: 1 };
  }

  const seasonId = await getActiveSeasonId(db) ?? 1;
  const playedWeeks = await getPlayedWeeks(db, seasonId);

  if (playedWeeks.length === 0) {
    return { games: [], playedWeeks: [], week: 0, seasonId };
  }

  // Default to latest played week; allow ?week= override
  const latestWeek = playedWeeks[playedWeeks.length - 1];
  const reqWeek = parseInt(url.searchParams.get('week') ?? String(latestWeek), 10);
  const week = playedWeeks.includes(reqWeek) ? reqWeek : latestWeek;

  const games = await getWeekResults(db, seasonId, week);

  return { games, playedWeeks, week, seasonId };
};
