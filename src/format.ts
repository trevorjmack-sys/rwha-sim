// ── Box-score pretty-printer ─────────────────────────────────────────────────
//
// Produces an STHS-style fixed-width text box score from a `BoxScore` value.

import type {
  BoxScore, GoalEvent, PenaltyEvent, FightEvent,
  SkaterStatLine, GoalieStatLine, ThreeStar, TeamGameTotals,
} from './types.ts';

const HR = '═'.repeat(72);
const HR_THIN = '─'.repeat(72);

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}
function rpad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s;
}
function pct(p: number): string {
  return p.toFixed(3).replace(/^0/, ''); // .914
}

function periodLabel(p: number): string {
  if (p === 1) return '1st';
  if (p === 2) return '2nd';
  if (p === 3) return '3rd';
  return 'OT';
}

export function formatBoxScore(box: BoxScore): string {
  const lines: string[] = [];
  const out = (s: string) => lines.push(s);

  const homeName = box.home.team;
  const awayName = box.away.team;

  // ── Header ─────────────────────────────────────────────────────────────
  out(HR);
  out(`  ${homeName.toUpperCase()} vs ${awayName.toUpperCase()}` +
      pad('', Math.max(0, 72 - 4 - homeName.length - awayName.length - 4 - box.finalLabel.length))
      + box.finalLabel);
  out(HR);

  // ── Score table ───────────────────────────────────────────────────────
  out(scoreTable(box.home, box.away));
  out('');

  // ── Goals ─────────────────────────────────────────────────────────────
  out('GOALS');
  if (box.goals.length === 0) out('  (none)');
  for (const g of box.goals) out(formatGoal(g));
  out('');

  // ── Penalties ─────────────────────────────────────────────────────────
  out('PENALTIES');
  if (box.penalties.length === 0) out('  (none)');
  for (const p of box.penalties) out(formatPenalty(p));
  out('');

  // ── Fights ────────────────────────────────────────────────────────────
  if (box.fights.length > 0) {
    out('FIGHTS');
    for (const f of box.fights) out(formatFight(f));
    out('');
  }

  // ── Team summary line ────────────────────────────────────────────────
  out(teamSummary(box.home, box.away));
  out('');

  // ── Skaters ───────────────────────────────────────────────────────────
  out(`SKATERS — ${homeName.toUpperCase()}`);
  out(skaterHeader());
  for (const s of box.skaters.filter(s => s.team === homeName)) out(formatSkater(s));
  out('');

  out(`SKATERS — ${awayName.toUpperCase()}`);
  out(skaterHeader());
  for (const s of box.skaters.filter(s => s.team === awayName)) out(formatSkater(s));
  out('');

  // ── Goalies ───────────────────────────────────────────────────────────
  out('GOALIES');
  out(goalieHeader());
  for (const g of box.goalies) out(formatGoalie(g));
  out('');

  // ── Three stars ───────────────────────────────────────────────────────
  out('THREE STARS');
  for (const s of box.threeStars) out(formatStar(s));
  out(HR);

  return lines.join('\n');
}

// ── Sub-formatters ───────────────────────────────────────────────────────────
function scoreTable(home: TeamGameTotals, away: TeamGameTotals): string {
  const periods = Math.max(home.goalsByPeriod.length, away.goalsByPeriod.length);
  const headers: string[] = [];
  for (let i = 0; i < periods; i++) {
    headers.push(i < 3 ? `  ${i + 1}` : ' OT');
  }
  headers.push('  T');

  const top = `${pad('', 13)}${headers.join('')}    |  ${pad('SOG', 5)}${headers.join('')}`;
  const homeGoals = [...home.goalsByPeriod];
  const awayGoals = [...away.goalsByPeriod];
  while (homeGoals.length < periods) homeGoals.push(0);
  while (awayGoals.length < periods) awayGoals.push(0);

  const homeSog = [...home.sogByPeriod];
  const awaySog = [...away.sogByPeriod];
  while (homeSog.length < periods) homeSog.push(0);
  while (awaySog.length < periods) awaySog.push(0);

  const homeRow = `${pad(home.team.toUpperCase(), 13)}` +
                  homeGoals.map(n => rpad(String(n), 3)).join('') +
                  rpad(String(homeGoals.reduce((a, b) => a + b, 0)), 3) +
                  '    |  ' + pad(home.team.slice(0, 3).toUpperCase(), 5) +
                  homeSog.map(n => rpad(String(n), 3)).join('') +
                  rpad(String(homeSog.reduce((a, b) => a + b, 0)), 3);

  const awayRow = `${pad(away.team.toUpperCase(), 13)}` +
                  awayGoals.map(n => rpad(String(n), 3)).join('') +
                  rpad(String(awayGoals.reduce((a, b) => a + b, 0)), 3) +
                  '    |  ' + pad(away.team.slice(0, 3).toUpperCase(), 5) +
                  awaySog.map(n => rpad(String(n), 3)).join('') +
                  rpad(String(awaySog.reduce((a, b) => a + b, 0)), 3);

  return [top, homeRow, awayRow].join('\n');
}

function formatGoal(g: GoalEvent): string {
  const period = pad(periodLabel(g.period), 4);
  const time = pad(g.time, 7);
  const team = pad(g.team.slice(0, 3).toUpperCase(), 5);
  const strength = pad(g.strength, 4);
  const scorer = pad(g.scorer + (g.scorerSeasonGoals !== undefined ? ` (${g.scorerSeasonGoals})` : ''), 28);
  const assists = g.assists.length > 0 ? `from ${g.assists.join(', ')}` : 'unassisted';
  const tag = g.gameWinner ? '   ★ GWG' : g.emptyNet ? '  [EN]' : '';
  return `  ${period}${time}${team}${strength}${scorer}${assists}${tag}`;
}

function formatPenalty(p: PenaltyEvent): string {
  const period = pad(periodLabel(p.period), 4);
  const time = pad(p.time, 7);
  const team = pad(p.team.slice(0, 3).toUpperCase(), 5);
  const player = pad(p.player, 22);
  const inf = pad(p.infraction, 18);
  const mins = `${p.minutes}:00`;
  return `  ${period}${time}${team}${player}${inf}${mins}`;
}

function formatFight(f: FightEvent): string {
  const period = pad(periodLabel(f.period), 4);
  const time = pad(f.time, 7);
  const result = f.outcome === 'draw' ? 'draw' : `${f.outcome === 'home' ? f.homePlayer : f.awayPlayer} wins`;
  return `  ${period}${time}${f.homePlayer} vs. ${f.awayPlayer} — ${result}`;
}

function teamSummary(home: TeamGameTotals, away: TeamGameTotals): string {
  const labelW = 14;
  const teamW = 8;
  const fmtPair = (label: string, h: string, a: string) =>
    `${pad(label, labelW)}${home.team.slice(0,3).toUpperCase()}: ${pad(h, teamW)}${away.team.slice(0,3).toUpperCase()}: ${a}`;

  const lines: string[] = [];
  lines.push(fmtPair('POWER PLAY', `${home.ppGoals}/${home.ppOpps}`, `${away.ppGoals}/${away.ppOpps}`));
  lines.push(fmtPair(
    'FACEOFFS',
    `${home.faceoffsWon}/${home.faceoffsTotal} (${Math.round(home.faceoffsWon / Math.max(1, home.faceoffsTotal) * 100)}%)`,
    `${away.faceoffsWon}/${away.faceoffsTotal} (${Math.round(away.faceoffsWon / Math.max(1, away.faceoffsTotal) * 100)}%)`,
  ));
  lines.push(fmtPair('HITS',   String(home.hits),   String(away.hits)));
  lines.push(fmtPair('BLOCKS', String(home.blocks), String(away.blocks)));
  lines.push(fmtPair('PIM',    String(home.pim),    String(away.pim)));
  return lines.join('\n');
}

function skaterHeader(): string {
  return '  ' + pad('Player (Slot)', 30)
    + rpad('G', 3) + rpad('A', 3) + rpad('P', 3)
    + rpad('+/-', 5) + rpad('SOG', 5) + rpad('HIT', 5)
    + rpad('BLK', 5) + rpad('PIM', 5) + '  TOI';
}

function formatSkater(s: SkaterStatLine): string {
  const slotLabel = `(${s.lineSlot})`;
  const namePart = `${s.name}, ${s.position} ${slotLabel}`;
  return '  ' + pad(namePart, 30)
    + rpad(String(s.g), 3) + rpad(String(s.a), 3)
    + rpad(String(s.g + s.a), 3)
    + rpad(s.plusMinus >= 0 ? `+${s.plusMinus}` : String(s.plusMinus), 5)
    + rpad(String(s.sog), 5)
    + rpad(String(s.hits), 5)
    + rpad(String(s.blocks), 5)
    + rpad(String(s.pim), 5)
    + '  ' + s.toi;
}

function goalieHeader(): string {
  return '  ' + pad('Goalie', 30)
    + rpad('Dec', 4) + rpad('SA', 4) + rpad('GA', 4)
    + rpad('SV%', 6) + '  TOI';
}

function formatGoalie(g: GoalieStatLine): string {
  return '  ' + pad(`${g.name} (${g.team.slice(0,3).toUpperCase()})`, 30)
    + rpad(g.decision, 4)
    + rpad(String(g.shotsAgainst), 4)
    + rpad(String(g.goalsAgainst), 4)
    + rpad(pct(g.savePct), 6)
    + '  ' + g.toi;
}

function formatStar(s: ThreeStar): string {
  const stars = '★'.repeat(s.rank).padEnd(4, ' ');
  return `  ${stars} ${pad(s.player + ` (${s.team.slice(0,3).toUpperCase()})`, 35)}${s.blurb}`;
}
