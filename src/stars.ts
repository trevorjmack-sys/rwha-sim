// ── Star scoring ──────────────────────────────────────────────────────────────
//
// Shared by the per-game three stars (sim.ts) and the weekly three stars on
// the site's home page. Leans into goals, assists and fights — a Gordie Howe
// hat trick (goal + assist + fight in the same game) is worth more than a
// plain two-goal night, and a Michigan goal gets its own bonus.

export const STAR_WEIGHTS = {
  goal:     3,
  assist:   2,
  fight:    2,
  fightWin: 1,
  gordieHowe: 4,   // bonus on top of the goal, assist and fight themselves
  michigan: 3,
} as const;

export interface StarLine {
  g: number;
  a: number;
  fights: number;
  fightWins: number;
  gordieHowes: number;
  michigans: number;
}

export function starScore(s: StarLine): number {
  const w = STAR_WEIGHTS;
  return s.g * w.goal + s.a * w.assist + s.fights * w.fight + s.fightWins * w.fightWin
       + s.gordieHowes * w.gordieHowe + s.michigans * w.michigan;
}

/** Sort best-first: star score, then goals, then points. */
export function compareStars(a: StarLine, b: StarLine): number {
  return starScore(b) - starScore(a) || b.g - a.g || (b.g + b.a) - (a.g + a.a);
}

/** Short blurb, e.g. "1-1-2 · fight W · GORDIE HOWE" or "2-0-2 · MICHIGAN". */
export function starBlurb(s: StarLine): string {
  const parts = [`${s.g}-${s.a}-${s.g + s.a}`];
  if (s.fights > 0) {
    const label = s.fights === 1 ? 'fight' : `${s.fights} fights`;
    parts.push(s.fightWins > 0 ? `${label} (${s.fightWins}W)` : label);
  }
  if (s.gordieHowes > 0) parts.push(s.gordieHowes > 1 ? `${s.gordieHowes}× GORDIE HOWE` : 'GORDIE HOWE');
  if (s.michigans > 0)   parts.push(s.michigans > 1 ? `${s.michigans}× MICHIGAN` : 'MICHIGAN');
  return parts.join(' · ');
}
