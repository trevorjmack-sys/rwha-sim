// ── Schedule generator ────────────────────────────────────────────────────────
//
// Produces a balanced 82-game regular-season schedule for the RWHA.
//
// The math: 22 teams × 82 games ÷ 2 = 902 total games.
// With 231 unique pairs (C(22,2)), 902 games means some pairs play 3 times
// and some play 4 times. Each team must play exactly 19 four-game opponents
// and 2 three-game opponents (19×4 + 2×3 = 82).
//
// We designate the 22 "three-game" pairs as a Hamiltonian cycle through all
// teams (0→1→2→...→21→0). This gives every team exactly 2 three-game
// opponents and guarantees perfect home/away balance (41H + 41A each):
//
//   4-game pairs:  2 home + 2 away at each venue (209 × 4 = 836 games)
//   3-game pairs:  in the cycle, each team alternates being the "2H side"
//                  (one neighbour gets 2H+1A, the other gets 1H+2A), so
//                  every team contributes 3H + 3A from its two 3-game
//                  opponents.  3H + 38H = 41H, 3A + 38A = 41A.  ✓
//
// Games are then seeded-shuffled and distributed across 26 weeks.

import type { ScheduledGame } from './types.ts';
import { makeRng } from './rng.ts';

export const SEASON_WEEKS = 26;

export function generateSchedule(
  teamNames: string[],
  seed = 1,
): ScheduledGame[] {
  const n   = teamNames.length;   // 22
  const rng = makeRng(seed);

  // ── Designate 3-game pairs via a Hamiltonian cycle ────────────────────────
  // The cycle is 0→1→2→...→(n-1)→0.  For each directed edge i→j, team i
  // gets the "2H" side of the 3-game series (2 home, 1 away) and team j
  // gets 1 home, 2 away.  Because each team is both a "from" node and a
  // "to" node exactly once in the cycle, every team ends up with 3H+3A from
  // its two 3-game opponents.  Combined with 38H+38A from 4-game opponents
  // that's exactly 41H + 41A.
  //
  // cycleHome: canonical pair key "min|max" → the team that gets 2H.
  const cycleHome = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const from = i, to = (i + 1) % n;
    const key  = `${Math.min(from, to)}|${Math.max(from, to)}`;
    cycleHome.set(key, from);   // 'from' = the 2H team for this 3-game pair
  }

  // ── Build game list ───────────────────────────────────────────────────────
  const matchups: [number, number][] = [];

  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const key = `${a}|${b}`;
      const home2 = cycleHome.get(key);  // defined iff this is a 3-game pair
      if (home2 !== undefined) {
        // 3-game pair — use cycle direction for the 2H assignment
        const away1 = home2 === a ? b : a;
        matchups.push([home2, away1]);
        matchups.push([home2, away1]);
        matchups.push([away1, home2]);
      } else {
        // 4-game pair — 2H + 2A for each side
        matchups.push([a, b]);
        matchups.push([a, b]);
        matchups.push([b, a]);
        matchups.push([b, a]);
      }
    }
  }

  // Sanity: verify every team has exactly 82 games scheduled
  const gpCheck = new Array<number>(n).fill(0);
  for (const [h, a] of matchups) { gpCheck[h]!++; gpCheck[a]!++; }
  for (let i = 0; i < n; i++) {
    if (gpCheck[i] !== 82) {
      throw new Error(
        `Schedule bug: ${teamNames[i]} has ${gpCheck[i]} games, expected 82`,
      );
    }
  }

  // ── Fisher-Yates shuffle ──────────────────────────────────────────────────
  for (let i = matchups.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [matchups[i], matchups[j]] = [matchups[j]!, matchups[i]!];
  }

  // ── Assign to weeks (1–26) ────────────────────────────────────────────────
  // ~34–35 games per week. Each team plays ~3.15 games/week on average.
  const total        = matchups.length;                          // 902
  const gamesPerWeek = Math.ceil(total / SEASON_WEEKS);          // 35

  return matchups.map(([hi, ai], idx) => ({
    gameId:   idx + 1,
    week:     Math.min(SEASON_WEEKS, Math.floor(idx / gamesPerWeek) + 1),
    homeTeam: teamNames[hi]!,
    awayTeam: teamNames[ai]!,
  }));
}
