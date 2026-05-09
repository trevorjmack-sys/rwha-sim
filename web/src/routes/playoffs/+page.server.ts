import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getActiveSeasonId, getStandings } from '$lib/server/db';
import type { StandingsRow } from '$lib/server/db';

export type Seed = StandingsRow & { seed: number };

function buildSeeds(rows: StandingsRow[], conf: number): Seed[] {
  return rows
    .filter(r => r.conference === conf)
    .sort((a, b) =>
      b.pts - a.pts ||
      (b.gf - b.ga) - (a.gf - a.ga) ||
      b.gf - a.gf
    )
    .slice(0, 4)
    .map((r, i) => ({ ...r, seed: i + 1 }));
}

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env.DB;
  if (!db) throw error(500, 'DB unavailable');

  const seasonId = await getActiveSeasonId(db) ?? 1;

  const [rows, seasonRow] = await Promise.all([
    getStandings(db, seasonId),
    db.prepare('SELECT name FROM seasons WHERE id = ?')
      .bind(seasonId).first<{ name: string }>(),
  ]);

  const honey  = buildSeeds(rows, 1);
  const sturdy = buildSeeds(rows, 2);

  // Use max GP among the top seeds to determine if season is in progress
  const gp = Math.max(honey[0]?.gp ?? 0, sturdy[0]?.gp ?? 0);

  return {
    honey,
    sturdy,
    seasonName: seasonRow?.name ?? 'Season',
    gp,
  };
};
