import type { PageServerLoad } from './$types';
import { getActiveSeasonId, getScheduleWeeks, getWeekSchedule } from '$lib/server/db';
import type { WeekSummary, ScheduleGame } from '$lib/server/db';

type ScheduleGameWithRivalry = ScheduleGame & { rivalryLevel: number };

export const load: PageServerLoad = async ({ url, platform }) => {
  const db = platform?.env.DB;
  if (!db) return { weeks: [] as WeekSummary[], games: [] as ScheduleGameWithRivalry[], week: 1, teamFilter: '' };

  const seasonId = await getActiveSeasonId(db) ?? 1;
  const [weeks, seasonRow] = await Promise.all([
    getScheduleWeeks(db, seasonId),
    db.prepare('SELECT name FROM seasons WHERE id = ?').bind(seasonId).first<{ name: string }>(),
  ]);
  const seasonName = seasonRow?.name ?? '';

  // Default: week in progress, else next unplayed, else last played
  const inProgress = weeks.find(w => w.played > 0 && w.played < w.total)?.week;
  const nextWeek   = weeks.find(w => w.played === 0)?.week;
  const lastPlayed = weeks.filter(w => w.played > 0).at(-1)?.week;
  const autoWeek   = inProgress ?? nextWeek ?? lastPlayed ?? weeks[0]?.week ?? 1;

  const paramWeek = parseInt(url.searchParams.get('week') ?? '', 10);
  const selectedWeek = (!isNaN(paramWeek) && weeks.some(w => w.week === paramWeek))
    ? paramWeek : autoWeek;

  const teamFilter = url.searchParams.get('team') ?? '';
  const [games, rivalryRows] = await Promise.all([
    getWeekSchedule(db, seasonId, selectedWeek),
    db.prepare(`SELECT team_a_id, team_b_id, level FROM rivalries`)
      .all<{ team_a_id: number; team_b_id: number; level: number }>()
      .then(r => r.results)
      .catch(() => [] as { team_a_id: number; team_b_id: number; level: number }[]),
  ]);

  // Build rivalry lookup: "minId-maxId" → level
  const rivalryMap = new Map<string, number>();
  for (const r of rivalryRows) {
    const key = `${Math.min(r.team_a_id, r.team_b_id)}-${Math.max(r.team_a_id, r.team_b_id)}`;
    rivalryMap.set(key, r.level);
  }

  const withRivalry: ScheduleGameWithRivalry[] = games.map(g => {
    const key = `${Math.min(g.home_team_id, g.away_team_id)}-${Math.max(g.home_team_id, g.away_team_id)}`;
    return { ...g, rivalryLevel: rivalryMap.get(key) ?? 0 };
  });

  // Apply team filter
  const filtered = teamFilter
    ? withRivalry.filter(g =>
        g.home_name.toLowerCase().includes(teamFilter.toLowerCase()) ||
        g.away_name.toLowerCase().includes(teamFilter.toLowerCase()))
    : withRivalry;

  return { weeks, games: filtered, week: selectedWeek, teamFilter, seasonName };
};
