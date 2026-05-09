import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

interface TeamRow {
  id: number;
  name: string;
  abbrev: string;
  gm_name: string;
}
interface ProspectRow {
  id: number;
  team_id: number;
  name: string;
  draft_year: number | null;
  draft_overall: number | null;
}
interface PickRow {
  owner_team_id: number;
  original_abbrev: string;
  year: number;
  round: number;
}

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env.DB;
  if (!db) throw error(500, 'Database not available');

  const [teamsRes, prospectsRes, picksRes] = await Promise.all([
    db.prepare('SELECT id, name, abbrev, gm_name FROM teams ORDER BY name').all<TeamRow>(),
    db.prepare('SELECT * FROM prospects ORDER BY team_id, draft_year NULLS LAST, draft_overall NULLS LAST, name').all<ProspectRow>(),
    db.prepare('SELECT owner_team_id, original_abbrev, year, round FROM draft_picks ORDER BY owner_team_id, year, round, original_abbrev').all<PickRow>(),
  ]);

  const teams = teamsRes.results;
  const allProspects = prospectsRes.results;
  const allPicks = picksRes.results;

  // Group picks by owner team, then by year
  const picksByTeam = new Map<number, Map<number, PickRow[]>>();
  for (const pick of allPicks) {
    if (!picksByTeam.has(pick.owner_team_id)) {
      picksByTeam.set(pick.owner_team_id, new Map());
    }
    const byYear = picksByTeam.get(pick.owner_team_id)!;
    if (!byYear.has(pick.year)) byYear.set(pick.year, []);
    byYear.get(pick.year)!.push(pick);
  }

  const teamData = teams.map(team => ({
    ...team,
    prospects: allProspects.filter(p => p.team_id === team.id),
    picks: picksByTeam.get(team.id) ?? new Map<number, PickRow[]>(),
  }));

  // Flatten picks map to serialisable structure for Svelte
  const serialisable = teamData.map(t => ({
    id: t.id,
    name: t.name,
    abbrev: t.abbrev,
    gm_name: t.gm_name,
    prospects: t.prospects,
    picksByYear: [...t.picks.entries()].map(([year, picks]) => ({ year, picks })),
  }));

  return { teams: serialisable };
};
