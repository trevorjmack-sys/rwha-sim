import type { PageServerLoad } from './$types';
import { getActiveSeasonId } from '$lib/server/db';
import { RWHA_CAP, RWHA_FLOOR } from '$lib/cap';

export interface PlayerCapRow {
  id: number;
  name: string;
  position: string;
  is_goalie: number;
  ov: number;
  salary: number | null;
  contract_yrs: number | null;
  roster_level: string;
}

export interface TeamCapData {
  team_id: number;
  team_name: string;
  gm_name: string;
  pro_cap_hit: number;
  farm_payroll: number;
  pro_missing: number;   // pro players with no salary data
  farm_missing: number;
  pro_players: PlayerCapRow[];
  farm_players: PlayerCapRow[];
  cap_space: number;     // RWHA_CAP - pro_cap_hit
  floor_space: number;   // pro_cap_hit - RWHA_FLOOR (negative = under floor)
  status: 'over' | 'under' | 'ok';
}

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env.DB;
  if (!db) return { teams: [] as TeamCapData[], cap: RWHA_CAP, floor: RWHA_FLOOR };

  const seasonId = await getActiveSeasonId(db) ?? 1;

  // Load all teams + all their players in one query
  const { results } = await db.prepare(`
    SELECT
      t.id        AS team_id,
      t.name      AS team_name,
      t.gm_name,
      p.id        AS player_id,
      p.name      AS player_name,
      p.position,
      p.is_goalie,
      p.ov,
      p.salary,
      p.contract_yrs,
      p.roster_level
    FROM teams t
    LEFT JOIN players p ON p.team_id = t.id
    WHERE t.season_id = ?
    ORDER BY t.name, p.roster_level DESC, p.salary DESC
  `).bind(seasonId).all<{
    team_id: number; team_name: string; gm_name: string;
    player_id: number | null; player_name: string | null;
    position: string | null; is_goalie: number | null;
    ov: number | null; salary: number | null;
    contract_yrs: number | null; roster_level: string | null;
  }>();

  // Aggregate by team
  const teamMap = new Map<number, TeamCapData>();

  for (const row of results) {
    if (!teamMap.has(row.team_id)) {
      teamMap.set(row.team_id, {
        team_id:      row.team_id,
        team_name:    row.team_name,
        gm_name:      row.gm_name,
        pro_cap_hit:  0,
        farm_payroll: 0,
        pro_missing:  0,
        farm_missing: 0,
        pro_players:  [],
        farm_players: [],
        cap_space:    0,
        floor_space:  0,
        status:       'ok',
      });
    }

    if (!row.player_id) continue; // team with no players (shouldn't happen)

    const t = teamMap.get(row.team_id)!;
    const player: PlayerCapRow = {
      id:           row.player_id,
      name:         row.player_name ?? '',
      position:     row.position ?? '',
      is_goalie:    row.is_goalie ?? 0,
      ov:           row.ov ?? 0,
      salary:       row.salary,
      contract_yrs: row.contract_yrs,
      roster_level: row.roster_level ?? 'pro',
    };

    if (row.roster_level === 'pro') {
      t.pro_players.push(player);
      if (row.salary) t.pro_cap_hit += row.salary;
      else t.pro_missing++;
    } else {
      t.farm_players.push(player);
      if (row.salary) t.farm_payroll += row.salary;
      else t.farm_missing++;
    }
  }

  // Compute derived fields + status
  const teams: TeamCapData[] = Array.from(teamMap.values()).map(t => {
    const cap_space   = RWHA_CAP   - t.pro_cap_hit;
    const floor_space = t.pro_cap_hit - RWHA_FLOOR;
    const status: TeamCapData['status'] =
      cap_space   < 0 ? 'over'  :
      floor_space < 0 ? 'under' : 'ok';

    // Sort players: by salary desc within each group
    t.pro_players.sort((a, b)  => (b.salary ?? 0) - (a.salary ?? 0));
    t.farm_players.sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0));

    return { ...t, cap_space, floor_space, status };
  });

  // Sort: over-cap first, then by pro cap hit desc
  teams.sort((a, b) => {
    const rank = (s: TeamCapData['status']) => s === 'over' ? 0 : s === 'under' ? 2 : 1;
    const dr = rank(a.status) - rank(b.status);
    return dr !== 0 ? dr : b.pro_cap_hit - a.pro_cap_hit;
  });

  return { teams, cap: RWHA_CAP, floor: RWHA_FLOOR };
};
