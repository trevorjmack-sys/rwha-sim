import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

interface TradeRow {
  id: number;
  traded_at: string;
  team_a_id: number;
  team_b_id: number;
  team_a_name: string;
  team_b_name: string;
  a_to_b: string;
  b_to_a: string;
}

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env.DB;
  if (!db) throw error(500, 'Database not available');

  const { results } = await db.prepare(`
    SELECT
      tl.id, tl.traded_at,
      tl.team_a_id, tl.team_b_id,
      ta.name AS team_a_name,
      tb.name AS team_b_name,
      tl.a_to_b, tl.b_to_a
    FROM trade_log tl
    JOIN teams ta ON ta.id = tl.team_a_id
    JOIN teams tb ON tb.id = tl.team_b_id
    ORDER BY tl.traded_at DESC
    LIMIT 200
  `).all<TradeRow>();

  return { trades: results };
};
