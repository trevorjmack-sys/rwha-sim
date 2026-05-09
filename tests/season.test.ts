import { describe, it, expect } from 'vitest';
import { loadLeague } from '../src/data.ts';
import { generateSchedule, type TeamEntry } from '../src/schedule.ts';
import { simulateSeason } from '../src/season.ts';

// Helper: split 22 teams into two conferences of 11 (alphabetical)
function makeTeamEntries(): TeamEntry[] {
  const league = loadLeague();
  const names  = [...league.teams.keys()].sort();
  const conf1  = new Set(names.slice(0, 11));
  return names.map(n => ({ name: n, conference: (conf1.has(n) ? 1 : 2) as 1 | 2 }));
}

describe('schedule generation', () => {
  it('produces exactly 451 games for 22 teams', () => {
    const entries = makeTeamEntries();
    const sched   = generateSchedule(entries, 1);
    expect(sched).toHaveLength(451);
  });

  it('gives every team exactly 41 games', () => {
    const entries = makeTeamEntries();
    const sched   = generateSchedule(entries, 1);

    const counts = new Map<string, number>();
    for (const g of sched) {
      counts.set(g.homeTeam, (counts.get(g.homeTeam) ?? 0) + 1);
      counts.set(g.awayTeam, (counts.get(g.awayTeam) ?? 0) + 1);
    }
    for (const { name } of entries) {
      expect(counts.get(name), `${name} GP`).toBe(41);
    }
  });

  it('assigns all games to weeks 1–21', () => {
    const entries = makeTeamEntries();
    const sched   = generateSchedule(entries, 42);
    for (const g of sched) {
      expect(g.week).toBeGreaterThanOrEqual(1);
      expect(g.week).toBeLessThanOrEqual(21);
    }
  });

  it('is deterministic with the same seed', () => {
    const entries = makeTeamEntries();
    const a = generateSchedule(entries, 7);
    const b = generateSchedule(entries, 7);
    expect(a.map(g => g.gameId)).toEqual(b.map(g => g.gameId));
    expect(a.map(g => g.homeTeam + g.awayTeam)).toEqual(b.map(g => g.homeTeam + g.awayTeam));
  });

  it('requires exactly 11 teams per conference', () => {
    const bad: TeamEntry[] = [
      ...Array.from({ length: 10 }, (_, i) => ({ name: `T${i}`, conference: 1 as 1 | 2 })),
      ...Array.from({ length: 12 }, (_, i) => ({ name: `U${i}`, conference: 2 as 1 | 2 })),
    ];
    expect(() => generateSchedule(bad, 1)).toThrow(/exactly 11 teams/);
  });
});

describe('simulateSeason', () => {
  it('produces standings for all 22 teams', () => {
    const league  = loadLeague();
    const results = simulateSeason(league, { seed: 1 });
    expect(results.standings).toHaveLength(22);
    for (const rec of results.standings) {
      expect(rec.gp).toBe(41);
      // Points = W×2 + OTL×1 + T×1
      expect(rec.pts).toBe(rec.w * 2 + rec.otl + rec.t);
    }
  });

  it('has consistent GF/GA totals (league GF === league GA)', () => {
    const league  = loadLeague();
    const results = simulateSeason(league, { seed: 2 });
    const totalGF = results.standings.reduce((s, r) => s + r.gf, 0);
    const totalGA = results.standings.reduce((s, r) => s + r.ga, 0);
    expect(totalGF).toBe(totalGA);
  });

  it('is deterministic with the same seed', () => {
    const league = loadLeague();
    const a = simulateSeason(league, { seed: 42 });
    const b = simulateSeason(league, { seed: 42 });
    expect(a.standings.map(r => r.pts)).toEqual(b.standings.map(r => r.pts));
    expect(a.skaterStats[0]?.pts).toBe(b.skaterStats[0]?.pts);
  });

  it('scoring leaders are sorted by points desc', () => {
    const league  = loadLeague();
    const results = simulateSeason(league, { seed: 3 });
    for (let i = 0; i < results.skaterStats.length - 1; i++) {
      expect(results.skaterStats[i]!.pts).toBeGreaterThanOrEqual(
        results.skaterStats[i + 1]!.pts,
      );
    }
  });
});
