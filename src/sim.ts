// ── Simulation pipeline (Phase 1, milestone 1) ──────────────────────────────
//
// This is the *scaffolded* sim: it produces a fully-shaped BoxScore using
// vaguely attribute-aware rolls. The numbers are NOT yet tuned to NHL-realistic
// distributions — that's the next milestone. The goal here is plumbing:
// `simulateGame()` runs end to end, returns a valid BoxScore, can be wired into
// the CLI and a season loop.
//
// Calibration TODOs are marked with `// TUNE:` throughout.

import type {
  Team, Lines, Skater, Goalie, BoxScore, GoalEvent, PenaltyEvent,
  FightEvent, SkaterStatLine, GoalieStatLine, TeamGameTotals, ThreeStar,
  Strength,
} from './types.ts';
import { generateLines } from './lines.ts';
import { makeRng, type RNG } from './rng.ts';

export interface SimOptions {
  seed?: number;
  gameId?: number;
  week?: number;
  // GMs may eventually pass overrides here (custom lines, overrides on TOI).
  homeLines?: Lines;
  awayLines?: Lines;
}

const PERIOD_LENGTH = 20 * 60; // seconds
const OT_LENGTH     = 5  * 60;

// Penalty infraction palette — sampled by DI weighting (Phase 1: uniform).
const INFRACTIONS = [
  'Hooking', 'Tripping', 'Slashing', 'High-sticking',
  'Cross-checking', 'Holding', 'Interference', 'Roughing',
  'Boarding', 'Delay of Game', 'Too Many Men',
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtToi(minutes: number): string {
  const totalSecs = Math.round(minutes * 60);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Average attribute value across an array of skaters. */
function avg<T>(arr: T[], pick: (x: T) => number): number {
  if (arr.length === 0) return 50;
  return arr.reduce((s, x) => s + pick(x), 0) / arr.length;
}

/** All skaters in the lineup, with their slot label. */
function flatSkaters(lines: Lines): { skater: Skater; slot: string }[] {
  const out: { skater: Skater; slot: string }[] = [];
  lines.forwards.forEach((line, i) => {
    out.push({ skater: line.lw, slot: `L${i + 1}` });
    out.push({ skater: line.c,  slot: `L${i + 1}` });
    out.push({ skater: line.rw, slot: `L${i + 1}` });
  });
  lines.defense.forEach((pair, i) => {
    out.push({ skater: pair.ld, slot: `D${i + 1}` });
    out.push({ skater: pair.rd, slot: `D${i + 1}` });
  });
  return out;
}

function findSlot(lines: Lines, slot: string): Skater[] {
  // Returns the skaters at a given slot label (e.g. "L1", "D2")
  const idx = parseInt(slot.slice(1)) - 1;
  if (slot.startsWith('L')) {
    const line = lines.forwards[idx]!;
    return [line.lw, line.c, line.rw];
  } else {
    const pair = lines.defense[idx]!;
    return [pair.ld, pair.rd];
  }
}

// ── Main entry ───────────────────────────────────────────────────────────────
export function simulateGame(
  home: Team,
  away: Team,
  opts: SimOptions = {},
): BoxScore {
  const seed = opts.seed ?? Math.floor(Math.random() * 0x7fffffff);
  const rng  = makeRng(seed);

  const homeLines = opts.homeLines ?? generateLines(home);
  const awayLines = opts.awayLines ?? generateLines(away);

  // ── Team-level scoring rates (very rough Phase-1 weights) ─────────────────
  // TUNE: these constants need calibration. Right now we just want vaguely
  // plausible totals (~30 SOG, ~3 goals per team).
  const homeOff = teamOffense(home, homeLines);
  const awayOff = teamOffense(away, awayLines);
  const homeDef = teamDefense(home, homeLines);
  const awayDef = teamDefense(away, awayLines);

  // Shots on goal per team per period — Poisson around 10/period, scaled
  const sogHomePer: number[] = [];
  const sogAwayPer: number[] = [];
  for (let p = 0; p < 3; p++) {
    sogHomePer.push(rng.poisson(10 * (homeOff / awayDef)));
    sogAwayPer.push(rng.poisson(10 * (awayOff / homeDef)));
  }

  // Goals per period — derive from shots × per-shot conversion (TUNE)
  const homeSavePct = goalieSavePct(homeLines.starter);
  const awaySavePct = goalieSavePct(awayLines.starter);

  const goalsHomePer: number[] = sogHomePer.map(s => goalsFromShots(s, awaySavePct, rng));
  const goalsAwayPer: number[] = sogAwayPer.map(s => goalsFromShots(s, homeSavePct, rng));

  // ── Overtime / shootout handling ──────────────────────────────────────────
  let homeTotal = goalsHomePer.reduce((a, b) => a + b, 0);
  let awayTotal = goalsAwayPer.reduce((a, b) => a + b, 0);
  let finalLabel: BoxScore['finalLabel'] = 'FINAL';
  let otGoalEvent: { time: number; teamHome: boolean } | null = null;
  let shootout: { winnerHome: boolean } | null = null;
  let sogHomeOt = 0, sogAwayOt = 0;

  if (homeTotal === awayTotal) {
    // 5-min 3v3 OT — short, high-pace, ~3 SOG per side
    sogHomeOt = rng.poisson(3 * (homeOff / awayDef));
    sogAwayOt = rng.poisson(3 * (awayOff / homeDef));
    const otGoalsHome = goalsFromShots(sogHomeOt, awaySavePct, rng);
    const otGoalsAway = goalsFromShots(sogAwayOt, homeSavePct, rng);

    if (otGoalsHome > 0 && otGoalsAway === 0) {
      otGoalEvent = { time: rng.int(10, OT_LENGTH - 10), teamHome: true };
      homeTotal += 1;
      finalLabel = 'FINAL / OT';
    } else if (otGoalsAway > 0 && otGoalsHome === 0) {
      otGoalEvent = { time: rng.int(10, OT_LENGTH - 10), teamHome: false };
      awayTotal += 1;
      finalLabel = 'FINAL / OT';
    } else if (otGoalsHome > 0 && otGoalsAway > 0) {
      // Both scored — earliest time wins. Phase-1 simplification: home wins.
      otGoalEvent = { time: rng.int(10, OT_LENGTH - 10), teamHome: true };
      homeTotal += 1;
      finalLabel = 'FINAL / OT';
    } else {
      // No OT goal — go to shootout. Winner = higher PS skater, with noise.
      const homePs = avg(home.proSkaters.slice(0, 9), s => s.attrs.ps);
      const awayPs = avg(away.proSkaters.slice(0, 9), s => s.attrs.ps);
      const homeWeight = homePs + rng.normal(0, 8);
      const awayWeight = awayPs + rng.normal(0, 8);
      const winnerHome = homeWeight >= awayWeight;
      shootout = { winnerHome };
      if (winnerHome) homeTotal += 1; else awayTotal += 1;
      finalLabel = 'FINAL / SO';
    }
  }

  // ── Goal events ───────────────────────────────────────────────────────────
  const goals: GoalEvent[] = [];
  for (let p = 0; p < 3; p++) {
    addPeriodGoals(goals, p + 1, goalsHomePer[p]!, true,  home, homeLines, away, rng);
    addPeriodGoals(goals, p + 1, goalsAwayPer[p]!, false, away, awayLines, home, rng);
  }
  if (otGoalEvent) {
    const team = otGoalEvent.teamHome ? home : away;
    const lines = otGoalEvent.teamHome ? homeLines : awayLines;
    const goal = pickGoal(team, lines, rng, 4, fmtTime(otGoalEvent.time), 'EV');
    goals.push(goal);
  }

  // Mark game-winning goal (last go-ahead goal)
  markGameWinner(goals, homeTotal, awayTotal, home.name, away.name);

  // ── Penalties (Phase 1: ~3 per team, not yet wired into PP/SH goals) ──────
  const penalties: PenaltyEvent[] = [
    ...generatePenalties(home, homeLines, rng, 3),
    ...generatePenalties(away, awayLines, rng, 3),
  ];

  // ── Fights ────────────────────────────────────────────────────────────────
  const fights: FightEvent[] = generateFights(home, homeLines, away, awayLines, rng);

  // ── Per-skater stats ──────────────────────────────────────────────────────
  const skaters: SkaterStatLine[] = [];
  for (const { skater, slot } of flatSkaters(homeLines)) {
    skaters.push(skaterLine(skater, slot, home.name, goals, penalties, fights, rng, true,  homeLines));
  }
  for (const { skater, slot } of flatSkaters(awayLines)) {
    skaters.push(skaterLine(skater, slot, away.name, goals, penalties, fights, rng, false, awayLines));
  }

  // ── Goalies ───────────────────────────────────────────────────────────────
  const sogHomeTotal = sogHomePer.reduce((a, b) => a + b, 0) + sogHomeOt;
  const sogAwayTotal = sogAwayPer.reduce((a, b) => a + b, 0) + sogAwayOt;
  const goalies: GoalieStatLine[] = [
    goalieLine(homeLines.starter, home.name, sogAwayTotal, awayTotal,
               homeTotal > awayTotal ? 'W' : finalLabel.includes('OT') || finalLabel.includes('SO') ? 'OT' : 'L'),
    goalieLine(awayLines.starter, away.name, sogHomeTotal, homeTotal,
               awayTotal > homeTotal ? 'W' : finalLabel.includes('OT') || finalLabel.includes('SO') ? 'OT' : 'L'),
  ];

  // ── Team totals ───────────────────────────────────────────────────────────
  const homeTotals: TeamGameTotals = teamTotals(
    home.name, goalsHomePer, sogHomePer, otGoalEvent?.teamHome ? 1 : 0, sogHomeOt,
    skaters.filter(s => s.team === home.name), penalties.filter(p => p.team === home.name),
  );
  const awayTotals: TeamGameTotals = teamTotals(
    away.name, goalsAwayPer, sogAwayPer, otGoalEvent && !otGoalEvent.teamHome ? 1 : 0, sogAwayOt,
    skaters.filter(s => s.team === away.name), penalties.filter(p => p.team === away.name),
  );

  // ── Three stars (top points; goalie wins steal #1 on shutouts) ────────────
  const threeStars = pickThreeStars(skaters, goalies, homeTotal, awayTotal);

  return {
    gameId: opts.gameId ?? 0,
    week: opts.week ?? 0,
    home: homeTotals,
    away: awayTotals,
    finalLabel,
    goals,
    penalties,
    fights,
    skaters,
    goalies,
    threeStars,
  };
}

// ── Sub-routines ─────────────────────────────────────────────────────────────
function teamOffense(team: Team, lines: Lines): number {
  const fwd = lines.forwards.flatMap(l => [l.lw, l.c, l.rw]);
  const dfn = lines.defense.flatMap(p => [p.ld, p.rd]);
  // Heavy weight on top forwards (line ice time matters)
  const fScore = (lines.forwards[0]!.lw.attrs.sc + lines.forwards[0]!.c.attrs.sc + lines.forwards[0]!.rw.attrs.sc) * 1.0
               + (lines.forwards[1]!.lw.attrs.sc + lines.forwards[1]!.c.attrs.sc + lines.forwards[1]!.rw.attrs.sc) * 0.8
               + (lines.forwards[2]!.lw.attrs.sc + lines.forwards[2]!.c.attrs.sc + lines.forwards[2]!.rw.attrs.sc) * 0.6
               + (lines.forwards[3]!.lw.attrs.sc + lines.forwards[3]!.c.attrs.sc + lines.forwards[3]!.rw.attrs.sc) * 0.4;
  const dScore = avg(dfn, d => d.attrs.ph + d.attrs.pa) * 0.5;
  return (fScore + dScore) / 100;
}

function teamDefense(team: Team, lines: Lines): number {
  const fwd = lines.forwards.flatMap(l => [l.lw, l.c, l.rw]);
  const dfn = lines.defense.flatMap(p => [p.ld, p.rd]);
  return (avg(dfn, d => d.attrs.df) + avg(fwd, f => f.attrs.df) * 0.5) / 50;
}

function goalieSavePct(g: Goalie): number {
  // TUNE: collapse SC/RT/AG/SK/SZ/HS into a save probability around .905
  // Phase 1: simple linear map from OV (60→.890, 90→.925)
  const base = 0.890 + (g.ov - 60) / 30 * 0.035;
  return Math.min(0.945, Math.max(0.860, base));
}

function goalsFromShots(sog: number, savePct: number, rng: RNG): number {
  let goals = 0;
  for (let i = 0; i < sog; i++) {
    if (!rng.bool(savePct)) goals++;
  }
  return goals;
}

function addPeriodGoals(
  goals: GoalEvent[], period: number, count: number, isHome: boolean,
  team: Team, lines: Lines, _opp: Team, rng: RNG,
) {
  for (let i = 0; i < count; i++) {
    const sec = rng.int(10, PERIOD_LENGTH - 10);
    goals.push(pickGoal(team, lines, rng, period, fmtTime(sec), 'EV'));
  }
}

function pickGoal(
  team: Team, lines: Lines, rng: RNG, period: number, time: string, strength: Strength,
): GoalEvent {
  // Pick which line is on the ice — weighted by TOI
  const lineIdx = rng.weighted(lines.toi.forwards);
  const line = lines.forwards[lineIdx]!;
  const candidates = [line.lw, line.c, line.rw];
  // Plus one defenseman from D pair on the ice (random pair)
  const dPair = lines.defense[Math.min(lineIdx, 2)]!;
  candidates.push(dPair.ld, dPair.rd);

  // Goal scorer weighted by SC; D's SC counts a bit less
  const scWeights = candidates.map((s, idx) => {
    const isD = idx >= 3;
    return s.attrs.sc * (isD ? 0.4 : 1.0);
  });
  const scorerIdx = rng.weighted(scWeights);
  const scorer = candidates[scorerIdx]!;

  // Assists: 0-2, weighted by PA, from non-scorers on same unit
  const others = candidates.filter((_, i) => i !== scorerIdx);
  const numAssists = rng.weighted([10, 30, 60]); // 0=10%, 1=30%, 2=60%
  const assists: string[] = [];
  const usedIdx = new Set<number>();
  for (let i = 0; i < numAssists && others.length > 0; i++) {
    const paWeights = others.map((s, idx) => usedIdx.has(idx) ? 0 : s.attrs.pa);
    const idx = rng.weighted(paWeights);
    if (paWeights[idx] === 0) break;
    usedIdx.add(idx);
    assists.push(others[idx]!.name);
  }

  return { period, time, team: team.name, scorer: scorer.name, assists, strength };
}

function markGameWinner(goals: GoalEvent[], homeTotal: number, awayTotal: number,
                       homeName: string, _awayName: string) {
  // Game-winner = the goal that put the winning team ahead to stay
  // For Phase 1: just mark the last goal of the game by the winning team
  const winner = homeTotal > awayTotal ? homeName : _awayName;
  for (let i = goals.length - 1; i >= 0; i--) {
    if (goals[i]!.team === winner) { goals[i]!.gameWinner = true; break; }
  }
}

function generatePenalties(team: Team, lines: Lines, rng: RNG, count: number): PenaltyEvent[] {
  const all = flatSkaters(lines).map(x => x.skater);
  const out: PenaltyEvent[] = [];
  for (let i = 0; i < count; i++) {
    const weights = all.map(s => s.attrs.di);
    const player = all[rng.weighted(weights)]!;
    const period = rng.int(1, 3);
    const sec = rng.int(60, PERIOD_LENGTH - 60);
    const infraction = INFRACTIONS[rng.int(0, INFRACTIONS.length - 1)]!;
    out.push({ period, time: fmtTime(sec), team: team.name,
               player: player.name, infraction, minutes: 2 });
  }
  return out;
}

function generateFights(home: Team, hl: Lines, away: Team, al: Lines, rng: RNG): FightEvent[] {
  // Phase 1: ~50% chance of one fight per game, picked from the highest-FG skaters
  if (!rng.bool(0.5)) return [];
  const homeFighter = [...flatSkaters(hl)].map(x => x.skater).sort((a, b) => b.attrs.fg - a.attrs.fg)[0]!;
  const awayFighter = [...flatSkaters(al)].map(x => x.skater).sort((a, b) => b.attrs.fg - a.attrs.fg)[0]!;
  const period = rng.int(1, 3);
  const sec = rng.int(60, PERIOD_LENGTH - 60);
  // Outcome by ST + FG
  const hWeight = homeFighter.attrs.fg + homeFighter.attrs.st + rng.normal(0, 10);
  const aWeight = awayFighter.attrs.fg + awayFighter.attrs.st + rng.normal(0, 10);
  const diff = hWeight - aWeight;
  const outcome: FightEvent['outcome'] = Math.abs(diff) < 5 ? 'draw' : diff > 0 ? 'home' : 'away';
  return [{ period, time: fmtTime(sec), homePlayer: homeFighter.name, awayPlayer: awayFighter.name, outcome }];
}

function skaterLine(
  skater: Skater, slot: string, teamName: string,
  goals: GoalEvent[], penalties: PenaltyEvent[], fights: FightEvent[],
  rng: RNG, _isHome: boolean, lines: Lines,
): SkaterStatLine {
  const g = goals.filter(gg => gg.team === teamName && gg.scorer === skater.name).length;
  const a = goals.filter(gg => gg.team === teamName && gg.assists.includes(skater.name)).length;
  const pim = penalties.filter(p => p.team === teamName && p.player === skater.name)
               .reduce((s, p) => s + p.minutes, 0)
            + fights.filter(f => f.homePlayer === skater.name || f.awayPlayer === skater.name).length * 5;

  // Hits / blocks scaled to attribute value (Poisson around λ ~ ck/30)
  const hits   = rng.poisson(skater.attrs.ck / 30);
  const blocks = rng.poisson(skater.attrs.df / 50);
  const sog    = rng.poisson(skater.attrs.sc / 35) + (g > 0 ? g : 0);
  // Phase 1: random +/- around 0 — proper tracking is Phase 2
  const plusMinus = rng.int(-2, 2);

  // Default TOI by slot, then noise
  const baseToi = slot.startsWith('L')
    ? lines.toi.forwards[parseInt(slot.slice(1)) - 1]!
    : lines.toi.defense[parseInt(slot.slice(1)) - 1]!;
  const enFactor = skater.attrs.en / 75;
  const toiMin = baseToi * enFactor + rng.normal(0, 0.5);

  return {
    name: skater.name, position: skater.position, team: teamName, lineSlot: slot,
    g, a, plusMinus, sog, hits, blocks, pim,
    toi: fmtToi(Math.max(0, toiMin)),
  };
}

function goalieLine(g: Goalie, teamName: string, sa: number, ga: number,
                   decision: GoalieStatLine['decision']): GoalieStatLine {
  const sv = sa - ga;
  return {
    name: g.name, team: teamName, decision,
    shotsAgainst: sa, goalsAgainst: ga,
    savePct: sa > 0 ? sv / sa : 1,
    toi: '60:00',
  };
}

function teamTotals(
  teamName: string, goalsByPeriod: number[], sogByPeriod: number[],
  otGoals: number, otSog: number,
  skaters: SkaterStatLine[], penalties: PenaltyEvent[],
): TeamGameTotals {
  const periods = otSog > 0 ? [...goalsByPeriod, otGoals] : goalsByPeriod;
  const sogs    = otSog > 0 ? [...sogByPeriod, otSog]    : sogByPeriod;
  return {
    team: teamName,
    goalsByPeriod: periods,
    sogByPeriod:   sogs,
    ppGoals: 0, ppOpps: 3,        // TUNE: PP not yet modeled
    faceoffsWon: 28, faceoffsTotal: 56, // TUNE: faceoff totals
    hits:   skaters.reduce((s, x) => s + x.hits, 0),
    blocks: skaters.reduce((s, x) => s + x.blocks, 0),
    pim:    penalties.reduce((s, p) => s + p.minutes, 0),
  };
}

function pickThreeStars(
  skaters: SkaterStatLine[], goalies: GoalieStatLine[],
  homeTotal: number, awayTotal: number,
): [ThreeStar, ThreeStar, ThreeStar] {
  // Goalie steals #1 on a shutout
  if (homeTotal === 0 || awayTotal === 0) {
    const winner = homeTotal === 0 ? goalies[1]! : goalies[0]!;
    if (winner.goalsAgainst === 0) {
      const top2 = [...skaters].sort((a, b) => (b.g + b.a) - (a.g + a.a)).slice(0, 2);
      return [
        { rank: 1, player: winner.name, team: winner.team, blurb: `SHUTOUT (${winner.shotsAgainst} sv)` },
        { rank: 2, player: top2[0]!.name, team: top2[0]!.team, blurb: starBlurb(top2[0]!) },
        { rank: 3, player: top2[1]!.name, team: top2[1]!.team, blurb: starBlurb(top2[1]!) },
      ];
    }
  }
  const sorted = [...skaters].sort((a, b) => (b.g * 2 + b.a) - (a.g * 2 + a.a));
  const top3 = sorted.slice(0, 3);
  return [
    { rank: 1, player: top3[0]!.name, team: top3[0]!.team, blurb: starBlurb(top3[0]!) },
    { rank: 2, player: top3[1]!.name, team: top3[1]!.team, blurb: starBlurb(top3[1]!) },
    { rank: 3, player: top3[2]!.name, team: top3[2]!.team, blurb: starBlurb(top3[2]!) },
  ];
}

function starBlurb(s: SkaterStatLine): string {
  return `${s.g}-${s.a}-${s.g + s.a}`;
}
