// ── RWHA Salary Cap Constants ─────────────────────────────────────────────────
// Source: RWHA forum post, July 2025.
// Formula: NHL value × (32 ÷ 22) = NHL value × 1.46
//   NHL Cap:   $95.5M  → RWHA Cap:   $139M
//   NHL Floor: $70.6M  → RWHA Floor: $103M

export const NHL_TEAMS  = 32;
export const RWHA_TEAMS = 22;
export const CAP_FACTOR = NHL_TEAMS / RWHA_TEAMS;         // 1.4545...
export const CAP_FACTOR_DISPLAY = '1.46';                 // rounded as used in forum

export const NHL_CAP    = 95_500_000;
export const NHL_FLOOR  = 70_600_000;

// Official RWHA figures (rounded, as announced)
export const RWHA_CAP   = 139_000_000;
export const RWHA_FLOOR = 103_000_000;

/** Format a dollar amount as $X.XXM or $XXX,XXX */
export function fmtCap(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  return '$' + n.toLocaleString('en-US');
}

/** Format cap space: +$X.XXM or -$X.XXM */
export function fmtSpace(n: number): string {
  const abs = Math.abs(n);
  const fmt = abs >= 1_000_000
    ? (abs / 1_000_000).toFixed(2) + 'M'
    : abs.toLocaleString('en-US');
  return (n >= 0 ? '+$' : '-$') + fmt;
}
