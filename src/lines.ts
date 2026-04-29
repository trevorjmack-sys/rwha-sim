// ── Auto-generated lines (Phase 1) ───────────────────────────────────────────
//
// Until the GM webapp ships (Phase 3), we generate sensible default lines
// straight from the roster. The rule is: for each position slot, pick the
// highest-OV available player who is eligible for that position. Multi-position
// players (e.g. "C/L") are eligible for any of their listed positions.

import type {
  Team, Skater, Goalie, Lines, ForwardLine, DefensePair, Position,
} from './types.ts';

const DEFAULT_FWD_TOI: [number, number, number, number] = [20, 17, 14, 9];
const DEFAULT_DEF_TOI: [number, number, number]        = [24, 21, 15];

function eligibleFor(slot: 'C' | 'L' | 'R' | 'D', skater: Skater): boolean {
  const positions = skater.position.split('/') as Position[];
  return positions.includes(slot as Position);
}

/** Pick the highest-OV unused skater eligible for `slot`, or `null`. */
function takeBest(
  pool: Skater[],
  used: Set<Skater>,
  slot: 'C' | 'L' | 'R' | 'D',
): Skater | null {
  for (const s of pool) {
    if (used.has(s)) continue;
    if (!eligibleFor(slot, s)) continue;
    used.add(s);
    return s;
  }
  return null;
}

export function generateLines(team: Team): Lines {
  // Pro skaters only (farm = depth, not a Phase 1 concern)
  const skaters = team.proSkaters
    .filter(s => !s.injured)
    .sort((a, b) => b.ov - a.ov);

  const forwards = skaters.filter(s => /[CLR]/.test(s.position) && !/D/.test(s.position));
  const defense  = skaters.filter(s => s.position.includes('D'));

  // Two-pass forward placement.
  //
  //   Pass 1 (strict): for each forward by OV desc, place them in the first
  //     open slot among their listed positions. e.g. a "C/L" player goes to
  //     C if there's a C slot open, else L.
  //
  //   Pass 2 (flex): any forward still unplaced fills any remaining empty slot
  //     regardless of listed position. This handles teams with imbalanced
  //     position depth (e.g. a roster heavy on C and L will deploy someone
  //     on their off-wing for a 4th-line RW slot).
  //
  // GMs will override these defaults via the webapp UI in Phase 3.
  const slots = {
    C: [null, null, null, null] as (Skater | null)[],
    L: [null, null, null, null] as (Skater | null)[],
    R: [null, null, null, null] as (Skater | null)[],
  };
  const placed = new Set<Skater>();

  for (const f of forwards) {
    const positions = f.position
      .split('/')
      .filter((p): p is 'C' | 'L' | 'R' => p === 'C' || p === 'L' || p === 'R');
    for (const p of positions) {
      const idx = slots[p].findIndex(x => x === null);
      if (idx >= 0) {
        slots[p][idx] = f;
        placed.add(f);
        break;
      }
    }
  }

  for (const f of forwards) {
    if (placed.has(f)) continue;
    for (const k of ['L', 'C', 'R'] as const) {
      const idx = slots[k].findIndex(x => x === null);
      if (idx >= 0) {
        slots[k][idx] = f;
        placed.add(f);
        break;
      }
    }
  }

  const lines: ForwardLine[] = [];
  for (let i = 0; i < 4; i++) {
    const c = slots.C[i], lw = slots.L[i], rw = slots.R[i];
    if (!c || !lw || !rw) {
      throw new Error(
        `Cannot build forward line ${i + 1} for ${team.name} — missing ` +
        `${!c ? 'C ' : ''}${!lw ? 'LW ' : ''}${!rw ? 'RW' : ''}`.trim() +
        ` (${forwards.length} forwards available)`,
      );
    }
    lines.push({ c, lw, rw });
  }

  // Defense pairs: top 6 by OV, paired sequentially
  const dUsed = new Set<Skater>();
  const dPicks: Skater[] = [];
  for (let i = 0; i < 6; i++) {
    const pick = takeBest(defense, dUsed, 'D');
    if (!pick) throw new Error(`Not enough D-men for ${team.name}`);
    dPicks.push(pick);
  }
  const pairs: DefensePair[] = [
    { ld: dPicks[0]!, rd: dPicks[1]! },
    { ld: dPicks[2]!, rd: dPicks[3]! },
    { ld: dPicks[4]!, rd: dPicks[5]! },
  ];

  // Goalies: starter = highest OV, backup = next
  const goalies = [...team.proGoalies]
    .filter(g => !g.injured)
    .sort((a, b) => b.ov - a.ov);
  if (goalies.length < 2) {
    throw new Error(`Need at least 2 healthy goalies for ${team.name}`);
  }
  const starter: Goalie = goalies[0]!;
  const backup:  Goalie = goalies[1]!;

  return {
    forwards: lines as [ForwardLine, ForwardLine, ForwardLine, ForwardLine],
    defense:  pairs as [DefensePair, DefensePair, DefensePair],
    starter,
    backup,
    toi: {
      forwards: DEFAULT_FWD_TOI,
      defense:  DEFAULT_DEF_TOI,
    },
  };
}
