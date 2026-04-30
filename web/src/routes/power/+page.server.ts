import type { PageServerLoad } from './$types';
import { getActiveSeasonId, getTeamStats, getPowerGames } from '$lib/server/db';
import type { PowerGameRow } from '$lib/server/db';

export interface PowerRanking {
  rank: number;
  team_id: number;
  team_name: string;
  gp: number;
  w: number; l: number; otl: number; pts: number;
  l10_w: number; l10_l: number; l10_otl: number; l10_pts: number; l10_gp: number;
  l5: Array<'W' | 'L' | 'OT'>;
  streak_type: 'W' | 'L' | 'OT';
  streak_count: number;
  power_score: number;
}

function outcome(g: PowerGameRow, teamId: number): 'W' | 'L' | 'OT' {
  const isHome = g.home_team_id === teamId;
  const tf = isHome ? g.home_goals : g.away_goals;
  const of_ = isHome ? g.away_goals : g.home_goals;
  if (tf > of_) return 'W';
  if (g.final_label === 'FINAL') return 'L';
  return 'OT';
}

function pts(o: 'W' | 'L' | 'OT') {
  return o === 'W' ? 2 : o === 'OT' ? 1 : 0;
}

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env.DB;
  if (!db) return { rankings: [] as PowerRanking[] };

  const seasonId = await getActiveSeasonId(db) ?? 1;

  const [stats, games] = await Promise.all([
    getTeamStats(db, seasonId),
    getPowerGames(db, seasonId),
  ]);

  if (stats.every(t => t.gp === 0)) return { rankings: [] as PowerRanking[] };

  // Build per-team game list (chronological — games are already ordered by id)
  const teamGames = new Map<number, PowerGameRow[]>();
  for (const t of stats) teamGames.set(t.team_id, []);
  for (const g of games) {
    teamGames.get(g.home_team_id)?.push(g);
    teamGames.get(g.away_team_id)?.push(g);
  }

  const rankings: PowerRanking[] = stats.map(t => {
    const tg = teamGames.get(t.team_id) ?? [];

    // Overall
    const totalPts = tg.reduce((s, g) => s + pts(outcome(g, t.team_id)), 0);
    const overallPpg = tg.length > 0 ? totalPts / tg.length : 0;

    // Last 10
    const last10 = tg.slice(-10);
    const l10Pts = last10.reduce((s, g) => s + pts(outcome(g, t.team_id)), 0);
    const l10Ppg = last10.length > 0 ? l10Pts / last10.length : 0;
    const l10Outcomes = last10.map(g => outcome(g, t.team_id));

    // Last 5 for trend dots
    const l5 = tg.slice(-5).map(g => outcome(g, t.team_id));

    // Streak
    let streak_type: 'W' | 'L' | 'OT' = 'L';
    let streak_count = 0;
    for (let i = tg.length - 1; i >= 0; i--) {
      const o = outcome(tg[i], t.team_id);
      if (streak_count === 0) { streak_type = o; streak_count = 1; }
      else if (o === streak_type) streak_count++;
      else break;
    }

    // Power score: 40% overall PPG + 60% last-10 PPG (recent form weighs more)
    const power_score = tg.length > 0
      ? (overallPpg * 0.4 + l10Ppg * 0.6)
      : 0;

    return {
      rank: 0, // filled after sort
      team_id: t.team_id,
      team_name: t.team_name,
      gp: t.gp,
      w: t.w, l: t.l, otl: t.otl, pts: t.pts,
      l10_gp:  last10.length,
      l10_w:   l10Outcomes.filter(o => o === 'W').length,
      l10_l:   l10Outcomes.filter(o => o === 'L').length,
      l10_otl: l10Outcomes.filter(o => o === 'OT').length,
      l10_pts: l10Pts,
      l5,
      streak_type,
      streak_count,
      power_score,
    };
  });

  rankings.sort((a, b) => b.power_score - a.power_score);
  rankings.forEach((r, i) => r.rank = i + 1);

  return { rankings };
};
