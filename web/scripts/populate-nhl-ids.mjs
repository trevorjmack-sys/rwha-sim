#!/usr/bin/env node
/**
 * populate-nhl-ids.mjs
 *
 * Pulls all 32 NHL team rosters from the NHL web API, builds a name→id map,
 * then matches against players in the D1 database and writes nhl_id back.
 *
 * Usage (from web/ directory):
 *   node scripts/populate-nhl-ids.mjs
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

const DB      = 'rwha-sim';
const SEASON  = '20242025';

const NHL_TEAMS = [
  'ANA','BOS','BUF','CAR','CBJ','CGY','CHI','COL','DAL','DET',
  'EDM','FLA','LAK','MIN','MTL','NJD','NSH','NYI','NYR','OTT',
  'PHI','PIT','SEA','SJS','STL','TBL','TOR','UTA','VAN','VGK',
  'WPG','WSH',
];

// ── Normalise a name for fuzzy matching ───────────────────────────────────────
function norm(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[''.\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── 1. Build NHL name → id map from all team rosters ─────────────────────────
console.log('Fetching all 32 NHL team rosters…');
const nhlMap = new Map(); // norm(firstName lastName) → nhlId

await Promise.all(NHL_TEAMS.map(async abbrev => {
  try {
    const url = `https://api-web.nhle.com/v1/roster/${abbrev}/${SEASON}`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) { console.log(`  WARN: ${abbrev} → HTTP ${res.status}`); return; }
    const data = await res.json();
    for (const group of ['forwards', 'defensemen', 'goalies']) {
      for (const p of (data[group] ?? [])) {
        const key = norm(`${p.firstName.default} ${p.lastName.default}`);
        nhlMap.set(key, p.id);
        // Also index "firstname lastname" without accents for matching
        const altKey = norm(p.firstName.default) + ' ' + norm(p.lastName.default);
        nhlMap.set(altKey, p.id);
      }
    }
  } catch (e) {
    console.log(`  ERR: ${abbrev} — ${e.message}`);
  }
}));

console.log(`NHL map built: ${nhlMap.size} entries from 32 rosters.\n`);

// ── 2. Fetch players from D1 ──────────────────────────────────────────────────
console.log('Fetching players from D1…');
const raw = execSync(
  `npx wrangler d1 execute ${DB} --remote --json --command "SELECT id, name FROM players WHERE nhl_id IS NULL"`,
  { cwd: process.cwd(), maxBuffer: 20 * 1024 * 1024 }
).toString();

const players = JSON.parse(raw)[0]?.results ?? [];
console.log(`Found ${players.length} players without nhl_id.\n`);
if (players.length === 0) { console.log('Nothing to do.'); process.exit(0); }

// ── 3. Match each player ──────────────────────────────────────────────────────
const updates = [];
const missed  = [];

for (const p of players) {
  const key = norm(p.name);
  if (nhlMap.has(key)) {
    updates.push({ dbId: p.id, nhlId: nhlMap.get(key) });
  } else {
    missed.push(p.name);
  }
}

console.log(`Matched: ${updates.length}/${players.length}  |  Missed: ${missed.length}`);
if (missed.length) {
  console.log('\nMissed players (likely prospects / retired):');
  missed.forEach(n => console.log('  ' + n));
}

if (updates.length === 0) {
  console.log('\nNo matches — nothing to write.');
  process.exit(0);
}

// ── 4. Write updates to D1 ────────────────────────────────────────────────────
console.log(`\nWriting ${updates.length} updates to D1…`);
const sql = updates
  .map(u => `UPDATE players SET nhl_id = ${u.nhlId} WHERE id = ${u.dbId};`)
  .join('\n');

const tmpFile = '/tmp/nhl_ids_update.sql';
writeFileSync(tmpFile, sql);

execSync(
  `npx wrangler d1 execute ${DB} --remote --file ${tmpFile}`,
  { cwd: process.cwd(), stdio: 'inherit' }
);

try { unlinkSync(tmpFile); } catch {}
console.log('\nDone! Re-run to catch newly added players.');
