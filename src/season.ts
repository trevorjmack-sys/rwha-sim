// ── Season simulation ─────────────────────────────────────────────────────────
//
// Runs a full 82-game regular season for all 22 RWHA teams.
// Each game uses `simulateGame`; this module accumulates per-team and
// per-player stats, builds the standings, and returns a SeasonResults.

import type {
  League, BoxScore, SkaterSeasonStats, GoalieSeasonStats,
  TeamSeasonRecord, SeasonResults,
} from './types.ts';
import { simulateGame } from './sim.ts';
import { generateSchedule } from './schedule.ts';

export interface SeasonOptions {
  seed?: number;
  verbose?: boolean;     // print a dot per game to stderr
}

export function simulateSeason(
  league: League,
  opts: SeasonOptions = {},
): SeasonResults {
  const seed  = opts.seed ?? Math.floor(Math.random() * 0x7fffffff);
  const teams = [...league.teams.values()];
  const names = teams.map(t => t.name);

  const schedule = generateSchedule(names, seed);

  // ── Accumulators ─────────────────────────────────────────────────────────
  const standings = new Map<string, TeamSeasonRecord>();
  for (const t of teams) {
    standings.set(t.name, {
      team: t.name, gp: 0,
      w: 0, l: 0, otl: 0, pts: 0,
      gf: 0, ga: 0, diff: 0,
      streak: '',
      last10: { w: 0, l: 0, otl: 0 },
    });
  }

  const skaterMap  = new Map<string, SkaterSeasonStats>();  // key = "name|team"
  const goalieMap  = new Map<string, GoalieSeasonStats>();  // key = "name|team"
  // Rolling last-10 result queues
  const last10Queue = new Map<string, ('W' | 'L' | 'OT')[]>();
  for (const t of teams) last10Queue.set(t.name, []);

  const allBoxScores: BoxScore[] = [];
  let gamesSim = 0;

  // ── Run games ─────────────────────────────────────────────────────────────
  for (const sg of schedule) {
    const home = league.teams.get(sg.homeTeam)!;
    const away = league.teams.get(sg.awayTeam)!;
    const gameSeed = seed ^ (sg.gameId * 0x9e3779b9);  // deterministic per-game seed

    const box = simulateGame(home, away, {
      seed: gameSeed,
      gameId: sg.gameId,
      week: sg.week,
    });
    allBoxScores.push(box);

    // ── Standings ─────────────────────────────────────────────────────────
    const homeGoals = box.home.goalsByPeriod.reduce((s, n) => s + n, 0);
    const awayGoals = box.away.goalsByPeriod.reduce((s, n) => s + n, 0);
    const isOT = box.finalLabel !== 'FINAL';

    const hRec = standings.get(sg.homeTeam)!;
    const aRec = standings.get(sg.awayTeam)!;

    hRec.gp++; hRec.gf += homeGoals; hRec.ga += awayGoals;
    aRec.gp++; aRec.gf += awayGoals; aRec.ga += homeGoals;

    if (homeGoals > awayGoals) {
      hRec.w++; hRec.pts += 2;
      aRec.l += isOT ? 0 : 1;
      if (isOT) { aRec.otl++; aRec.pts++; }
      pushStreak(last10Queue, hRec, 'W');
      pushStreak(last10Queue, aRec, isOT ? 'OT' : 'L');
    } else {
      aRec.w++; aRec.pts += 2;
      hRec.l += isOT ? 0 : 1;
      if (isOT) { hRec.otl++; hRec.pts++; }
      pushStreak(last10Queue, aRec, 'W');
      pushStreak(last10Queue, hRec, isOT ? 'OT' : 'L');
    }

    hRec.diff = hRec.gf - hRec.ga;
    aRec.diff = aRec.gf - aRec.ga;

    // ── Skater stats ──────────────────────────────────────────────────────
    for (const s of box.skaters) {
      const key = `${s.name}|${s.team}`;
      if (!skaterMap.has(key)) {
        // Look up the player to get their position
        const teamObj = league.teams.get(s.team)!;
        const playerObj = teamObj.proSkaters.find(p => p.name === s.name)
                       ?? teamObj.farmSkaters.find(p => p.name === s.name);
        skaterMap.set(key, {
          name: s.name, team: s.team,
          position: playerObj?.position ?? s.position,
          gp: 0, g: 0, a: 0, pts: 0,
          plusMinus: 0, pim: 0, sog: 0, hits: 0, blocks: 0,
          ppg: 0,
        });
      }
      const acc = skaterMap.get(key)!;
      acc.gp++;
      acc.g   += s.g;
      acc.a   += s.a;
      acc.pts += s.g + s.a;
      acc.plusMinus += s.plusMinus;
      acc.pim       += s.pim;
      acc.sog       += s.sog;
      acc.hits      += s.hits;
      acc.blocks    += s.blocks;
    }

    // ── Goalie stats ──────────────────────────────────────────────────────
    for (const g of box.goalies) {
      const key = `${g.name}|${g.team}`;
      if (!goalieMap.has(key)) {
        goalieMap.set(key, {
          name: g.name, team: g.team,
          gp: 0, w: 0, l: 0, otl: 0,
          ga: 0, sa: 0, gaa: 0, svPct: 0, so: 0,
        });
      }
      const acc = goalieMap.get(key)!;
      acc.gp++;
      acc.ga += g.goalsAgainst;
      acc.sa += g.shotsAgainst;
      if (g.decision === 'W')  acc.w++;
      if (g.decision === 'L')  acc.l++;
      if (g.decision === 'OT') acc.otl++;
      if (g.goalsAgainst === 0 && g.shotsAgainst > 0) acc.so++;
    }

    gamesSim++;
    if (opts.verbose && process.stderr) {
      process.stderr.write(gamesSim % 50 === 0 ? `\n${gamesSim}` : '.');
    }
  }
  if (opts.verbose) process.stderr.write('\n');

  // ── Finalize goalie rate stats ────────────────────────────────────────────
  for (const g of goalieMap.values()) {
    g.svPct = g.sa > 0 ? (g.sa - g.ga) / g.sa : 1;
    g.gaa   = g.gp > 0 ? (g.ga / g.gp) : 0;
  }

  // ── Sort standings (pts → diff → gf) ─────────────────────────────────────
  const sortedStandings = [...standings.values()].sort((a, b) =>
    b.pts !== a.pts ? b.pts - a.pts
    : b.diff !== a.diff ? b.diff - a.diff
    : b.gf - a.gf,
  );

  const sortedSkaters = [...skaterMap.values()]
    .filter(s => s.gp > 0)
    .sort((a, b) =>
      b.pts !== a.pts ? b.pts - a.pts :
      b.g !== a.g ? b.g - a.g : 0,
    );

  const sortedGoalies = [...goalieMap.values()]
    .filter(g => g.gp >= 10)
    .sort((a, b) =>
      b.svPct !== a.svPct ? b.svPct - a.svPct : b.w - a.w,
    );

  return {
    schedule,
    standings: sortedStandings,
    skaterStats: sortedSkaters,
    goalieStats: sortedGoalies,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function pushStreak(
  queues: Map<string, ('W'|'L'|'OT')[]>,
  rec: TeamSeasonRecord,
  result: 'W' | 'L' | 'OT',
) {
  // Update streak string
  const prev = rec.streak;
  if (!prev) {
    rec.streak = `${result}1`;
  } else {
    const prevType = prev[0]!;
    const prevCount = parseInt(prev.slice(1));
    rec.streak = prevType === result
      ? `${result}${prevCount + 1}`
      : `${result}1`;
  }

  // Update last-10 rolling window
  const queue = queues.get(rec.team)!;
  queue.push(result);
  if (queue.length > 10) queue.shift();
  rec.last10 = {
    w:   queue.filter(r => r === 'W').length,
    l:   queue.filter(r => r === 'L').length,
    otl: queue.filter(r => r === 'OT').length,
  };
}
