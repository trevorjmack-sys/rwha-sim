import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  getActiveSeasonId,
  getPlayedWeeks,
  getWeekResults,
} from '$lib/server/db';
import type { WeekResultRow } from '$lib/server/db';

type WeekResultWithRivalry = WeekResultRow & { rivalryLevel: number };

export const load: PageServerLoad = async ({ url, platform }) => {
  const db = platform?.env.DB;
  if (!db) {
    return { games: [] as WeekResultWithRivalry[], playedWeeks: [], week: 1, seasonId: 1 };
  }

  const seasonId = await getActiveSeasonId(db) ?? 1;
  const playedWeeks = await getPlayedWeeks(db, seasonId);

  if (playedWeeks.length === 0) {
    return { games: [] as WeekResultWithRivalry[], playedWeeks: [], week: 0, seasonId };
  }

  // Default to latest played week; allow ?week= override
  const latestWeek = playedWeeks[playedWeeks.length - 1];
  const reqWeek = parseInt(url.searchParams.get('week') ?? String(latestWeek), 10);
  const week = playedWeeks.includes(reqWeek) ? reqWeek : latestWeek;

  const [games, rivalryRows] = await Promise.all([
    getWeekResults(db, seasonId, week),
    db.prepare(`SELECT team_a_id, team_b_id, level FROM rivalries`)
      .all<{ team_a_id: number; team_b_id: number; level: number }>()
      .then(r => r.results)
      .catch(() => [] as { team_a_id: number; team_b_id: number; level: number }[]),
  ]);

  // Build rivalry lookup keyed by sorted team id pair
  const rivalryMap = new Map<string, number>();
  for (const r of rivalryRows) {
    const key = `${Math.min(r.team_a_id, r.team_b_id)}-${Math.max(r.team_a_id, r.team_b_id)}`;
    rivalryMap.set(key, r.level);
  }

  // WeekResultRow has id but no team ids — fetch them from scheduled_games
  const gameIds = games.map(g => g.id);
  let teamPairMap = new Map<number, { home_team_id: number; away_team_id: number }>();
  if (gameIds.length > 0) {
    const { results: pairRows } = await db.prepare(`
      SELECT id, home_team_id, away_team_id FROM scheduled_games
      WHERE id IN (${gameIds.map(() => '?').join(',')})
    `).bind(...gameIds).all<{ id: number; home_team_id: number; away_team_id: number }>();
    for (const r of pairRows) teamPairMap.set(r.id, r);
  }

  const withRivalry: WeekResultWithRivalry[] = games.map(g => {
    const pair = teamPairMap.get(g.id);
    let rivalryLevel = 0;
    if (pair) {
      const key = `${Math.min(pair.home_team_id, pair.away_team_id)}-${Math.max(pair.home_team_id, pair.away_team_id)}`;
      rivalryLevel = rivalryMap.get(key) ?? 0;
    }
    return { ...g, rivalryLevel };
  });

  return { games: withRivalry, playedWeeks, week, seasonId };
};
