import type { PageServerLoad } from './$types';
import { getActiveSeasonId } from '$lib/server/db';

export interface RosterPlayer {
  id: number;
  name: string;
  position: string;
  is_goalie: number;
  roster_level: string;
  ov: number;
  age: number | null;
  contract_yrs: number | null;
  salary: number | null;
  injured_games_remaining: number;
  is_scratch: number;
  nhl_id: number | null;
  attrs: Record<string, number>;
}

export interface TeamRoster {
  id: number;
  name: string;
  gm_name: string;
  farm_name: string | null;
  proSkaters:  RosterPlayer[];
  proGoalies:  RosterPlayer[];
  farmSkaters: RosterPlayer[];
  farmGoalies: RosterPlayer[];
}

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env.DB;
  if (!db) return { teams: [] as TeamRoster[] };

  const seasonId = await getActiveSeasonId(db) ?? 1;

  const [teamRows, playerRows] = await Promise.all([
    db.prepare(`SELECT id, name, gm_name, farm_name FROM teams WHERE season_id = ? ORDER BY name`)
      .bind(seasonId).all<{ id: number; name: string; gm_name: string; farm_name: string | null }>(),
    db.prepare(`SELECT id, team_id, name, position, is_goalie, roster_level, ov, age, contract_yrs,
                       salary, injured_games_remaining, is_scratch, nhl_id, attrs
                FROM players WHERE team_id IN (SELECT id FROM teams WHERE season_id = ?)
                ORDER BY team_id, roster_level DESC, is_goalie, ov DESC`)
      .bind(seasonId).all<{
        id: number; team_id: number; name: string; position: string;
        is_goalie: number; roster_level: string; ov: number;
        age: number | null; contract_yrs: number | null; salary: number | null;
        injured_games_remaining: number; is_scratch: number; nhl_id: number | null; attrs: string;
      }>(),
  ]);

  // Group players by team
  const byTeam = new Map<number, typeof playerRows.results>();
  for (const p of playerRows.results) {
    if (!byTeam.has(p.team_id)) byTeam.set(p.team_id, []);
    byTeam.get(p.team_id)!.push(p);
  }

  const teams: TeamRoster[] = teamRows.results.map(t => {
    const players = byTeam.get(t.id) ?? [];
    const parsed: RosterPlayer[] = players.map(p => ({
      ...p,
      attrs: (() => { try { return JSON.parse(p.attrs); } catch { return {}; } })(),
    }));

    const isD = (pos: string) => pos.split('/').includes('D');

    return {
      id:        t.id,
      name:      t.name,
      gm_name:   t.gm_name,
      farm_name: t.farm_name,
      proSkaters:  parsed.filter(p => p.roster_level === 'pro'  && !p.is_goalie && !isD(p.position)),
      proGoalies:  parsed.filter(p => p.roster_level === 'pro'  &&  p.is_goalie),
      farmSkaters: parsed.filter(p => p.roster_level === 'farm' && !p.is_goalie && !isD(p.position)),
      farmGoalies: parsed.filter(p => p.roster_level === 'farm' &&  p.is_goalie),
      // Defense mixed into skaters — re-sort to keep D together at bottom
    };
  });

  // Actually include D in skaters but sorted: fwd first, then D
  for (const t of teams) {
    const allPro  = (byTeam.get(t.id) ?? []).filter(p => p.roster_level === 'pro');
    const allFarm = (byTeam.get(t.id) ?? []).filter(p => p.roster_level === 'farm');
    const parse = (p: typeof allPro[0]): RosterPlayer => ({
      ...p,
      attrs: (() => { try { return JSON.parse(p.attrs); } catch { return {}; } })(),
    });
    const isD = (pos: string) => pos.split('/').includes('D');

    t.proSkaters  = [
      ...allPro.filter(p => !p.is_goalie && !isD(p.position)).map(parse),
      ...allPro.filter(p => !p.is_goalie &&  isD(p.position)).map(parse),
    ];
    t.proGoalies  = allPro.filter(p => p.is_goalie).map(parse);
    t.farmSkaters = [
      ...allFarm.filter(p => !p.is_goalie && !isD(p.position)).map(parse),
      ...allFarm.filter(p => !p.is_goalie &&  isD(p.position)).map(parse),
    ];
    t.farmGoalies = allFarm.filter(p => p.is_goalie).map(parse);
  }

  return { teams };
};
