import type { PageServerLoad } from './$types';
import { getActiveSeasonId, getScheduleWeeks, getWeekSchedule } from '$lib/server/db';
import type { WeekSummary, ScheduleGame } from '$lib/server/db';

export const load: PageServerLoad = async ({ url, platform }) => {
  const db = platform?.env.DB;
  if (!db) return { weeks: [] as WeekSummary[], games: [] as ScheduleGame[], week: 1, teamFilter: '' };

  const seasonId = await getActiveSeasonId(db) ?? 1;
  const weeks    = await getScheduleWeeks(db, seasonId);

  // Default: week in progress, else next unplayed, else last played
  const inProgress = weeks.find(w => w.played > 0 && w.played < w.total)?.week;
  const nextWeek   = weeks.find(w => w.played === 0)?.week;
  const lastPlayed = weeks.filter(w => w.played > 0).at(-1)?.week;
  const autoWeek   = inProgress ?? nextWeek ?? lastPlayed ?? weeks[0]?.week ?? 1;

  const paramWeek = parseInt(url.searchParams.get('week') ?? '', 10);
  const selectedWeek = (!isNaN(paramWeek) && weeks.some(w => w.week === paramWeek))
    ? paramWeek : autoWeek;

  const teamFilter = url.searchParams.get('team') ?? '';
  const games = await getWeekSchedule(db, seasonId, selectedWeek);

  // Apply team filter
  const filtered = teamFilter
    ? games.filter(g =>
        g.home_name.toLowerCase().includes(teamFilter.toLowerCase()) ||
        g.away_name.toLowerCase().includes(teamFilter.toLowerCase()))
    : games;

  return { weeks, games: filtered, week: selectedWeek, teamFilter };
};
