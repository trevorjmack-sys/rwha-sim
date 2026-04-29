import { describe, it, expect } from 'vitest';
import { loadLeague, getTeam } from '../src/data.ts';
import { generateLines } from '../src/lines.ts';
import { simulateGame } from '../src/sim.ts';
import { formatBoxScore } from '../src/format.ts';

describe('league loading', () => {
  it('loads all 22 RWHA teams', () => {
    const league = loadLeague();
    expect(league.teams.size).toBe(22);
  });

  it('finds teams case-insensitively', () => {
    const league = loadLeague();
    expect(getTeam(league, 'bunnies').name).toBe('Bunnies');
    expect(getTeam(league, 'BUNNIES').name).toBe('Bunnies');
  });

  it('throws on unknown teams', () => {
    const league = loadLeague();
    expect(() => getTeam(league, 'Senators')).toThrow(/Unknown team/);
  });

  it('parses skater attributes as numbers', () => {
    const league = loadLeague();
    const bunnies = getTeam(league, 'Bunnies');
    const top = bunnies.proSkaters[0]!;
    expect(typeof top.attrs.sc).toBe('number');
    expect(top.ov).toBeGreaterThan(0);
  });
});

describe('line generation', () => {
  it('builds 4 forward lines and 3 D pairs for every team', () => {
    const league = loadLeague();
    for (const team of league.teams.values()) {
      const lines = generateLines(team);
      expect(lines.forwards).toHaveLength(4);
      expect(lines.defense).toHaveLength(3);
      expect(lines.starter).toBeDefined();
      expect(lines.backup).toBeDefined();
    }
  });

  it('puts highest-OV available skaters in top slots', () => {
    const league = loadLeague();
    const bunnies = getTeam(league, 'Bunnies');
    const lines = generateLines(bunnies);
    const l1 = [lines.forwards[0].lw, lines.forwards[0].c, lines.forwards[0].rw];
    const l4 = [lines.forwards[3].lw, lines.forwards[3].c, lines.forwards[3].rw];
    const avg = (s: typeof l1) => s.reduce((a, b) => a + b.ov, 0) / s.length;
    expect(avg(l1)).toBeGreaterThan(avg(l4));
  });
});

describe('simulateGame', () => {
  it('produces a valid box score for any two teams', () => {
    const league = loadLeague();
    const home = getTeam(league, 'Gladiators');
    const away = getTeam(league, 'Bunnies');
    const box = simulateGame(home, away, { seed: 42 });

    // Final score is sum of period goals
    const homeTotal = box.home.goalsByPeriod.reduce((a, b) => a + b, 0);
    const awayTotal = box.away.goalsByPeriod.reduce((a, b) => a + b, 0);
    expect(homeTotal).toBeGreaterThanOrEqual(0);
    expect(awayTotal).toBeGreaterThanOrEqual(0);

    // Goal events length matches actual goal totals
    const homeGoalEvents = box.goals.filter(g => g.team === home.name).length;
    const awayGoalEvents = box.goals.filter(g => g.team === away.name).length;
    expect(homeGoalEvents).toBe(homeTotal);
    expect(awayGoalEvents).toBe(awayTotal);

    // Skaters and goalies are populated
    expect(box.skaters.length).toBeGreaterThan(0);
    expect(box.goalies.length).toBe(2);

    // Three stars
    expect(box.threeStars).toHaveLength(3);
  });

  it('produces deterministic output with the same seed', () => {
    const league = loadLeague();
    const home = getTeam(league, 'Oilers');
    const away = getTeam(league, 'Aces');

    const a = simulateGame(home, away, { seed: 7 });
    const b = simulateGame(home, away, { seed: 7 });

    expect(a.home.goalsByPeriod).toEqual(b.home.goalsByPeriod);
    expect(a.away.goalsByPeriod).toEqual(b.away.goalsByPeriod);
    expect(a.goals.length).toBe(b.goals.length);
  });

  it('formats without error', () => {
    const league = loadLeague();
    const box = simulateGame(
      getTeam(league, 'Phantoms'),
      getTeam(league, 'Cunts'),
      { seed: 99 },
    );
    const text = formatBoxScore(box);
    expect(text).toContain('PHANTOMS');
    expect(text).toContain('CUNTS');
    expect(text).toContain('GOALS');
    expect(text).toContain('THREE STARS');
  });
});
