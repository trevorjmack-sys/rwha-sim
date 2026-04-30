import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getActiveSeasonId, getTeamSchedule } from '$lib/server/db';

export const load: PageServerLoad = async ({ params, platform }) => {
  const db = platform?.env.DB;
  if (!db) throw error(503, 'DB unavailable');

  const seasonId = await getActiveSeasonId(db) ?? 1;
  const slug     = params.slug.toLowerCase();

  // Look up team by lowercased name
  const team = await db.prepare(`
    SELECT id, name, gm_name, farm_name
    FROM teams WHERE season_id = ? AND LOWER(name) = ?
  `).bind(seasonId, slug).first<{
    id: number; name: string; gm_name: string; farm_name: string | null;
  }>();

  if (!team) throw error(404, `Team "${params.slug}" not found`);

  const games = await getTeamSchedule(db, seasonId, team.id);

  // Compute record from completed games
  let w = 0, l = 0, otl = 0, gf = 0, ga = 0;
  for (const g of games) {
    if (g.status !== 'complete') continue;
    const tf = g.team_goals ?? 0;
    const of_ = g.opp_goals ?? 0;
    gf += tf; ga += of_;
    if (tf > of_)                      w++;
    else if (g.final_label === 'FINAL') l++;
    else                               otl++;
  }
  const pts = w * 2 + otl;
  const gp  = w + l + otl;

  return { team, games, record: { gp, w, l, otl, pts, gf, ga } };
};
