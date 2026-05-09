// ── Schedule generator — 41-game Summer Season ───────────────────────────────
//
// Format: 22 teams in 2 conferences of 11.
//
//   Within-conference:  play each of 10 opponents 3 times = 30 games
//                       (one opponent gets 2H+1A, the other 1H+2A per team)
//   Cross-conference:   play each of 11 opponents 1 time  = 11 games
//
//   Total: 41 games per team.
//   Total unique games: 22 × 41 / 2 = 451.
//   Season length: ~21 weeks (~2 games/team/week).

import type { ScheduledGame } from './types.ts';
import { makeRng } from './rng.ts';

export const SEASON_WEEKS = 21;

export interface TeamEntry {
  name:       string;
  conference: 1 | 2;
}

export function generateSchedule(
  teams: TeamEntry[],
  seed = 1,
): ScheduledGame[] {
  const rng = makeRng(seed);

  const conf1 = teams.filter(t => t.conference === 1);
  const conf2 = teams.filter(t => t.conference === 2);

  if (conf1.length !== 11 || conf2.length !== 11) {
    throw new Error(
      `generateSchedule requires exactly 11 teams per conference ` +
      `(got ${conf1.length} + ${conf2.length})`,
    );
  }

  const matchups: [string, string][] = [];  // [home, away]

  // ── Within-conference: 3 games per pair ───────────────────────────────────
  const addConferenceGames = (conf: TeamEntry[]) => {
    for (let a = 0; a < conf.length; a++) {
      for (let b = a + 1; b < conf.length; b++) {
        // Randomly assign which team gets 2 home games
        const home2 = rng.bool(0.5) ? a : b;
        const away1 = home2 === a ? b : a;
        matchups.push([conf[home2]!.name, conf[away1]!.name]);
        matchups.push([conf[home2]!.name, conf[away1]!.name]);
        matchups.push([conf[away1]!.name, conf[home2]!.name]);
      }
    }
  };

  addConferenceGames(conf1);
  addConferenceGames(conf2);

  // ── Cross-conference: 1 game per pair (home alternates by round) ──────────
  // Each conf-1 team plays each conf-2 team exactly once.
  // Home assignment: alternate row-by-row to balance H/A across the conference.
  for (let a = 0; a < conf1.length; a++) {
    for (let b = 0; b < conf2.length; b++) {
      // Checkerboard pattern: even sum → conf1 is home, odd sum → conf2 is home
      if ((a + b) % 2 === 0) {
        matchups.push([conf1[a]!.name, conf2[b]!.name]);
      } else {
        matchups.push([conf2[b]!.name, conf1[a]!.name]);
      }
    }
  }

  // ── Sanity: each team should have exactly 41 games ────────────────────────
  const gpCheck = new Map<string, number>();
  for (const t of teams) gpCheck.set(t.name, 0);
  for (const [h, a] of matchups) {
    gpCheck.set(h, (gpCheck.get(h) ?? 0) + 1);
    gpCheck.set(a, (gpCheck.get(a) ?? 0) + 1);
  }
  for (const [name, gp] of gpCheck) {
    if (gp !== 41) {
      throw new Error(`Schedule bug: ${name} has ${gp} games, expected 41`);
    }
  }

  // ── Fisher-Yates shuffle ─────────────────────────────────────────────────
  for (let i = matchups.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [matchups[i], matchups[j]] = [matchups[j]!, matchups[i]!];
  }

  // ── Distribute across weeks (~22 games/week) ─────────────────────────────
  const total        = matchups.length;  // 451
  const gamesPerWeek = Math.ceil(total / SEASON_WEEKS);

  return matchups.map(([hi, ai], idx) => ({
    gameId:   idx + 1,
    week:     Math.min(SEASON_WEEKS, Math.floor(idx / gamesPerWeek) + 1),
    homeTeam: hi,
    awayTeam: ai,
  }));
}
