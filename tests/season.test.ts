import { describe, it, expect } from 'vitest';
import { loadLeague } from '../src/data.ts';
import { generateSchedule } from '../src/schedule.ts';
import { simulateSeason } from '../src/season.ts';

describe('schedule generation', () => {
  it('produces exactly 902 games for 22 teams', () => {
    const league = loadLeague();
    const names  = [...league.teams.values()].map(t => t.name);
    const sched  = generateSchedule(names, 1);
    expect(sched).toHaveLength(902);
  });

  it('gives every team exactly 82 games', () => {
    const league = loadLeague();
    const names  = [...league.teams.values()].map(t => t.name);
    const sched  = generateSchedule(names, 1);

    const counts = new Map<string, number>();
    for (const g of sched) {
      counts.set(g.homeTeam, (counts.get(g.homeTeam) ?? 0) + 1);
      counts.set(g.awayTeam, (counts.get(g.awayTeam) ?? 0) + 1);
    }
    for (const [team, gp] of counts) {
      expect(gp, `${team} GP`).toBe(82);
    }
  });

  it('gives every team 41 home and 41 away games', () => {
    const league = loadLeague();
    const names  = [...league.teams.values()].map(t => t.name);
    const sched  = generateSchedule(names, 1);

    const home = new Map<string, number>();
    const away = new Map<string, number>();
    for (const g of sched) {
      home.set(g.homeTeam, (home.get(g.homeTeam) ?? 0) + 1);
      away.set(g.awayTeam, (away.get(g.awayTeam) ?? 0) + 1);
    }
    for (const name of names) {
      expect(home.get(name), `${name} home`).toBe(41);
      expect(away.get(name), `${name} away`).toBe(41);
    }
  });

  it('assigns all games to weeks 1–26', () => {
    const league = loadLeague();
    const names  = [...league.teams.values()].map(t => t.name);
    const sched  = generateSchedule(names, 42);
    for (const g of sched) {
      expect(g.week).toBeGreaterThanOrEqual(1);
      expect(g.week).toBeLessThanOrEqual(26);
    }
  });

  it('is deterministic with the same seed', () => {
    const league = loadLeague();
    const names  = [...league.teams.values()].map(t => t.name);
    const a = generateSchedule(names, 7);
    const b = generateSchedule(names, 7);
    expect(a.map(g => g.gameId)).toEqual(b.map(g => g.gameId));
    expect(a.map(g => g.homeTeam + g.awayTeam)).toEqual(b.map(g => g.homeTeam + g.awayTeam));
  });
});

describe('simulateSeason', () => {
  it('produces standings for all 22 teams', () => {
    const league  = loadLeague();
    const results = simulateSeason(league, { seed: 1 });
    expect(results.standings).toHaveLength(22);
    for (const rec of results.standings) {
      expect(rec.gp).toBe(82);
      expect(rec.pts).toBe(rec.w * 2 + rec.otl);
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
