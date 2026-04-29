// ── Season output formatter ───────────────────────────────────────────────────
//
// Produces a readable STHS-style text report from a SeasonResults:
//   • Standings (all 22 teams)
//   • Top-30 scoring leaders
//   • Top-20 goalie leaders (min 20 GP)

import type {
  SeasonResults, TeamSeasonRecord, SkaterSeasonStats, GoalieSeasonStats,
} from './types.ts';

const HR  = '═'.repeat(80);
const HR2 = '─'.repeat(80);

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}
function rpad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s;
}
function pct(p: number): string {
  return p.toFixed(3).replace(/^0/, '');
}

export function formatSeason(results: SeasonResults): string {
  const lines: string[] = [];
  const out = (s: string) => lines.push(s);

  const totalGames   = results.schedule.length;
  const totalGoals   = results.standings.reduce((s, t) => s + t.gf, 0);
  const avgGoals     = (totalGoals / totalGames).toFixed(2);

  out(HR);
  out(`  RWHA REGULAR SEASON — FINAL STANDINGS`);
  out(`  ${totalGames} games · ${totalGoals} goals · ${avgGoals} goals/game avg`);
  out(HR);

  // ── Standings ─────────────────────────────────────────────────────────────
  out(standingsHeader());
  out(HR2);
  results.standings.forEach((r, i) => out(standingsRow(r, i + 1)));
  out('');

  // ── Scoring leaders ───────────────────────────────────────────────────────
  out(HR);
  out('  SCORING LEADERS — TOP 30');
  out(HR);
  out(scoringHeader());
  out(HR2);
  results.skaterStats.slice(0, 30).forEach((s, i) => out(scoringRow(s, i + 1)));
  out('');

  // ── Goals leaders ─────────────────────────────────────────────────────────
  const goalsLeaders = [...results.skaterStats].sort((a, b) => b.g - a.g).slice(0, 10);
  out(HR);
  out('  GOALS LEADERS — TOP 10');
  out(HR);
  out(scoringHeader());
  out(HR2);
  goalsLeaders.forEach((s, i) => out(scoringRow(s, i + 1)));
  out('');

  // ── Goalie leaders ────────────────────────────────────────────────────────
  out(HR);
  out(`  GOALIE LEADERS — TOP 20 (min 20 GP)`);
  out(HR);
  out(goalieHeader());
  out(HR2);
  results.goalieStats.filter(g => g.gp >= 20).slice(0, 20).forEach((g, i) => out(goalieRow(g, i + 1)));
  out('');

  // ── Team offense / defense summary ────────────────────────────────────────
  out(HR);
  out('  TEAM SUMMARY');
  out(HR);
  out(teamSummaryHeader());
  out(HR2);
  const byGF = [...results.standings].sort((a, b) => b.gf - a.gf);
  byGF.forEach(r => out(teamSummaryRow(r)));
  out(HR);

  return lines.join('\n');
}

// ── Sub-formatters ────────────────────────────────────────────────────────────
function standingsHeader(): string {
  return '  ' +
    pad('Team', 15) +
    rpad('GP',  4) + rpad('W',  4) + rpad('L',  4) + rpad('OTL', 5) + rpad('PTS', 5) +
    rpad('GF',  5) + rpad('GA',  5) + rpad('DIFF', 6) +
    '  STREAK' + '   L10';
}

function standingsRow(r: TeamSeasonRecord, rank: number): string {
  const diff = r.diff >= 0 ? `+${r.diff}` : String(r.diff);
  const l10  = `${r.last10.w}-${r.last10.l}-${r.last10.otl}`;
  return '  ' +
    pad(`${rank}. ${r.team}`, 15) +
    rpad(String(r.gp),  4) + rpad(String(r.w),  4) + rpad(String(r.l),  4) +
    rpad(String(r.otl), 5) + rpad(String(r.pts), 5) +
    rpad(String(r.gf),  5) + rpad(String(r.ga),  5) + rpad(diff, 6) +
    `  ${pad(r.streak, 6)}  ${l10}`;
}

function scoringHeader(): string {
  return '  ' +
    rpad('#', 4) + pad('Player', 26) + pad('Team', 14) + pad('Pos', 8) +
    rpad('GP', 4) + rpad('G', 4) + rpad('A', 4) + rpad('PTS', 5) +
    rpad('+/-', 5) + rpad('PIM', 5) + rpad('SOG', 5);
}

function scoringRow(s: SkaterSeasonStats, rank: number): string {
  const pm = s.plusMinus >= 0 ? `+${s.plusMinus}` : String(s.plusMinus);
  return '  ' +
    rpad(String(rank), 4) +
    pad(s.name, 26) +
    pad(s.team.slice(0, 13), 14) +
    pad(String(s.position), 8) +
    rpad(String(s.gp),  4) + rpad(String(s.g), 4) + rpad(String(s.a), 4) +
    rpad(String(s.pts), 5) + rpad(pm, 5) + rpad(String(s.pim), 5) +
    rpad(String(s.sog), 5);
}

function goalieHeader(): string {
  return '  ' +
    rpad('#', 4) + pad('Goalie', 26) + pad('Team', 14) +
    rpad('GP', 4) + rpad('W', 4) + rpad('L', 4) + rpad('OTL', 5) +
    rpad('GA', 5) + rpad('SA', 6) + rpad('SV%', 7) + rpad('GAA', 6) + rpad('SO', 4);
}

function goalieRow(g: GoalieSeasonStats, rank: number): string {
  return '  ' +
    rpad(String(rank), 4) +
    pad(g.name, 26) +
    pad(g.team.slice(0, 13), 14) +
    rpad(String(g.gp),  4) + rpad(String(g.w), 4) + rpad(String(g.l), 4) +
    rpad(String(g.otl), 5) + rpad(String(g.ga), 5) + rpad(String(g.sa), 6) +
    rpad(pct(g.svPct), 7) + rpad(g.gaa.toFixed(2), 6) + rpad(String(g.so), 4);
}

function teamSummaryHeader(): string {
  return '  ' +
    pad('Team', 15) +
    rpad('GP', 4) + rpad('GF', 5) + rpad('GA', 5) +
    rpad('GF/G', 7) + rpad('GA/G', 7) + rpad('SH%', 7) + rpad('SV%', 7);
}

function teamSummaryRow(r: TeamSeasonRecord): string {
  const gfG  = r.gp > 0 ? (r.gf / r.gp).toFixed(2) : '0.00';
  const gaG  = r.gp > 0 ? (r.ga / r.gp).toFixed(2) : '0.00';
  return '  ' +
    pad(r.team, 15) +
    rpad(String(r.gp), 4) + rpad(String(r.gf), 5) + rpad(String(r.ga), 5) +
    rpad(gfG, 7) + rpad(gaG, 7);
}
