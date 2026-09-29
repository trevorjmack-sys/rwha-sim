// ── rwha.net roster sync ──────────────────────────────────────────────────────
//
// Pulls current rosters from rwha.net's public JSON API and applies them to D1
// in place, so a season in progress keeps its games, stats and lines:
//
//   • existing players are updated (ratings, OV, contract, pro/farm, team)
//   • players traded between teams keep their player id → their stats survive
//   • new players are inserted
//   • players no longer on any rwha.net roster are hidden (is_active = 0),
//     never deleted, so their historical stat lines still resolve
//   • personal players added via the admin CSV import are never touched
//     unless rwha.net lists them too
//   • renamed teams are renamed (matched by rwha.net's permanent team number)
//
// Runs automatically when the last successful sync is older than SYNC_INTERVAL
// (triggered from hooks.server.ts), or on demand from the admin page.

import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';

const RWHA_BASE      = 'http://rwha.net';
export const SYNC_INTERVAL_MS = 48 * 60 * 60 * 1000;   // every two days
const RETRY_AFTER_MS = 60 * 60 * 1000;                 // after a failed attempt
const LOCK_MS        = 5 * 60 * 1000;

// ── rwha.net API shapes (only the fields we use) ─────────────────────────────
interface RwhaLeague {
  teams: { number: number; name: string }[];
}
interface RwhaPlayer {
  id: number;
  kind: 'skater' | 'goalie';
  name: string;
  positions: string[];
  jersey?: string | number | null;
  age?: number | null;
  ovr: number;
  salary?: number | null;
  contract?: number | null;
  nhl_id?: string | number | null;
  ratings: Record<string, number>;
}
interface RwhaTeam {
  rosters: { pro?: RwhaPlayer[]; scratch?: RwhaPlayer[]; farm?: RwhaPlayer[] };
}

export interface SyncSummary {
  teams: number;
  players: number;
  updated: number;
  added: string[];
  moved: string[];
  removed: string[];
  renamed: string[];
  linesReset: string[];
  purged?: number;
  headshots?: number;
}

// ── Schema ────────────────────────────────────────────────────────────────────
// Adds the columns/table the sync needs. Safe to run repeatedly; cached per
// isolate so it costs one round-trip per cold start.
let schemaReady: Promise<void> | null = null;

export function ensureSchema(db: D1Database): Promise<void> {
  if (!schemaReady) {
    schemaReady = doEnsureSchema(db).catch(err => {
      schemaReady = null;           // retry on the next request
      throw err;
    });
  }
  return schemaReady;
}

async function doEnsureSchema(db: D1Database) {
  const cols = async (table: string) =>
    new Set((await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>()).results.map(c => c.name));

  const playerCols = await cols('players');
  const teamCols   = await cols('teams');
  const stmts: D1PreparedStatement[] = [];

  if (!playerCols.has('is_active'))     stmts.push(db.prepare(`ALTER TABLE players ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`));
  if (!playerCols.has('rwha_id'))       stmts.push(db.prepare(`ALTER TABLE players ADD COLUMN rwha_id INTEGER`));
  if (!playerCols.has('is_personal'))   stmts.push(db.prepare(`ALTER TABLE players ADD COLUMN is_personal INTEGER NOT NULL DEFAULT 0`));
  if (!playerCols.has('nhl_id'))        stmts.push(db.prepare(`ALTER TABLE players ADD COLUMN nhl_id INTEGER`));
  if (!playerCols.has('jersey_number')) stmts.push(db.prepare(`ALTER TABLE players ADD COLUMN jersey_number INTEGER`));
  if (!playerCols.has('nhl_lookup_at')) stmts.push(db.prepare(`ALTER TABLE players ADD COLUMN nhl_lookup_at INTEGER`));
  if (!teamCols.has('rwha_number'))     stmts.push(db.prepare(`ALTER TABLE teams ADD COLUMN rwha_number INTEGER`));

  stmts.push(db.prepare(`
    CREATE TABLE IF NOT EXISTS roster_sync (
      id              INTEGER PRIMARY KEY CHECK (id = 1),
      last_success_at INTEGER,
      last_attempt_at INTEGER,
      locked_until    INTEGER,
      last_summary    TEXT,
      last_error      TEXT
    )`));
  stmts.push(db.prepare(`INSERT OR IGNORE INTO roster_sync (id) VALUES (1)`));
  stmts.push(db.prepare(`CREATE INDEX IF NOT EXISTS idx_players_rwha ON players(rwha_id)`));

  await db.batch(stmts);
}

// ── Status (for the admin page) ──────────────────────────────────────────────
export interface SyncStatus {
  lastSuccessAt: number | null;
  lastAttemptAt: number | null;
  lastSummary: SyncSummary | null;
  lastError: string | null;
}

export async function getSyncStatus(db: D1Database): Promise<SyncStatus> {
  await ensureSchema(db);
  const row = await db.prepare(`SELECT * FROM roster_sync WHERE id = 1`).first<{
    last_success_at: number | null; last_attempt_at: number | null;
    last_summary: string | null; last_error: string | null;
  }>();
  let summary: SyncSummary | null = null;
  try { summary = row?.last_summary ? JSON.parse(row.last_summary) : null; } catch { /* ignore */ }
  return {
    lastSuccessAt: row?.last_success_at ?? null,
    lastAttemptAt: row?.last_attempt_at ?? null,
    lastSummary:   summary,
    lastError:     row?.last_error ?? null,
  };
}

// ── Automatic trigger ─────────────────────────────────────────────────────────
/** Starts a sync in the background if one is due. Never throws. */
export async function maybeAutoSync(db: D1Database, waitUntil: (p: Promise<unknown>) => void) {
  try {
    await ensureSchema(db);
    const row = await db.prepare(`SELECT last_success_at, last_attempt_at FROM roster_sync WHERE id = 1`)
      .first<{ last_success_at: number | null; last_attempt_at: number | null }>();
    const now = Date.now();
    const due = !row?.last_success_at || now - row.last_success_at > SYNC_INTERVAL_MS;
    const recentlyTried = row?.last_attempt_at && now - row.last_attempt_at < RETRY_AFTER_MS;
    if (due && !recentlyTried) waitUntil(syncRosters(db).catch(() => undefined));
  } catch {
    /* never break a page load over the sync */
  }
}

// ── Sync ──────────────────────────────────────────────────────────────────────
export async function syncRosters(
  db: D1Database,
  fetchJson: (path: string) => Promise<unknown> = defaultFetchJson,
): Promise<SyncSummary> {
  await ensureSchema(db);

  // Claim the lock atomically so two requests can't sync at once.
  const now = Date.now();
  const claim = await db.prepare(`
    UPDATE roster_sync SET locked_until = ?, last_attempt_at = ?
    WHERE id = 1 AND (locked_until IS NULL OR locked_until < ?)
  `).bind(now + LOCK_MS, now, now).run();
  if (!claim.meta.changes) throw new Error('A roster sync is already running');

  try {
    const summary = await applySync(db, fetchJson);
    // Headshots: fill in missing NHL ids (never fails the roster sync).
    try { summary.headshots = (await fillNhlIds(db, 25)).matched; } catch { /* next time */ }
    await db.prepare(`
      UPDATE roster_sync SET last_success_at = ?, last_summary = ?, last_error = NULL, locked_until = NULL
      WHERE id = 1
    `).bind(Date.now(), JSON.stringify(summary)).run();
    return summary;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.prepare(`UPDATE roster_sync SET last_error = ?, locked_until = NULL WHERE id = 1`)
      .bind(msg.slice(0, 500)).run();
    throw err;
  }
}

async function defaultFetchJson(path: string): Promise<unknown> {
  const res = await fetch(RWHA_BASE + path, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`rwha.net ${path} → HTTP ${res.status}`);
  return res.json();
}

// ── The league's personal (joke) players ─────────────────────────────────────
// rwha.net doesn't flag them, so they're named here. The sync marks them
// is_personal = 1 (★ on rosters, Harold Snepsts' face for a headshot).
// Add a name here when a new one joins.
export const PERSONAL_PLAYERS = [
  'Manson Gluehead', 'Lee Mack', 'Velyki Hospador', 'Douche Larouche', 'Shitty-Kitty Gangbang',
  'El Burrito Peligroso', 'Todd Harkness', 'Buck Phucksalot', 'Moxie Manslammer', 'Danny Massawhip',
  'Manly Rymjob', 'Wrinkles Cumbersnatch', 'Rick Spreadum', 'Ricky Cumalot', 'Wee Kawk',
  'Nipples Tenderloin', 'Hugo Drax', 'Mulvinder Bitchtits', 'Cockring Bomber', 'Brock Knuckledunker',
  'Raccoon Willie', 'Chu Kock',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const SKATER_KEYS = ['ck','fg','di','sk','st','en','du','ph','fo','pa','sc','df','ps','ex','ld','po','mo'] as const;
const GOALIE_KEYS = ['sk','du','en','sz','ag','rb','sc','hs','rt','ph','ps','ex','ld','po','mo'] as const;

export function normName(s: string): string {
  return s
    .replace(/\s*\([A-Z]\)\s*$/, '')          // "(C)", "(A)", "(R)" tags
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function mapPosition(p: RwhaPlayer): string {
  if (p.kind === 'goalie') return 'G';
  const map: Record<string, string> = { LW: 'L', RW: 'R', LD: 'D', RD: 'D' };
  const out: string[] = [];
  for (const raw of p.positions ?? []) {
    const v = map[raw] ?? raw;
    if (!out.includes(v)) out.push(v);
  }
  return out.join('/') || 'C';
}

export function mapAttrs(p: RwhaPlayer): string {
  const keys = p.kind === 'goalie' ? GOALIE_KEYS : SKATER_KEYS;
  const r = p.ratings ?? {};
  const attrs: Record<string, number> = {};
  for (const k of keys) {
    const v = Number(r[k.toUpperCase()] ?? r[k]);
    attrs[k] = Number.isFinite(v) && v > 0 ? v : 50;
  }
  return JSON.stringify(attrs);
}

const intOrNull = (v: unknown) => {
  const n = Number(v);
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : Math.round(n);
};

// ── Core ──────────────────────────────────────────────────────────────────────
async function applySync(db: D1Database, fetchJson: (path: string) => Promise<unknown>): Promise<SyncSummary> {
  // 1. Fetch everything first; bail before touching D1 if anything looks off.
  const league = await fetchJson('/auth/league.php') as RwhaLeague;
  if (!Array.isArray(league?.teams) || league.teams.length < 16) {
    throw new Error(`rwha.net returned ${league?.teams?.length ?? 0} teams — aborting`);
  }

  const remote: { number: number; name: string; players: { p: RwhaPlayer; level: 'pro' | 'farm'; scratch: boolean }[] }[] = [];
  for (const t of league.teams) {
    const data = await fetchJson(`/auth/team.php?n=${t.number}&roster=1`) as RwhaTeam;
    const r = data?.rosters ?? {};
    const players = [
      ...(r.pro     ?? []).map(p => ({ p, level: 'pro'  as const, scratch: false })),
      ...(r.scratch ?? []).map(p => ({ p, level: 'pro'  as const, scratch: true  })),
      ...(r.farm    ?? []).map(p => ({ p, level: 'farm' as const, scratch: false })),
    ].filter(x => x.p && x.p.name && (x.p.kind === 'skater' || x.p.kind === 'goalie'));
    if (players.length < 15) {
      throw new Error(`rwha.net returned only ${players.length} players for ${t.name} — aborting`);
    }
    remote.push({ number: t.number, name: t.name, players });
  }

  // 2. Load current D1 state for the active season.
  const season = await db.prepare(`SELECT id FROM seasons WHERE status = 'active' ORDER BY id DESC LIMIT 1`)
    .first<{ id: number }>();
  if (!season) throw new Error('No active season');

  const { results: teams } = await db.prepare(`SELECT id, name, rwha_number FROM teams WHERE season_id = ?`)
    .bind(season.id).all<{ id: number; name: string; rwha_number: number | null }>();

  const { results: players } = await db.prepare(`
    SELECT id, team_id, name, is_goalie, roster_level, is_scratch, is_active, is_personal, rwha_id
    FROM players WHERE team_id IN (SELECT id FROM teams WHERE season_id = ?)
  `).bind(season.id).all<{
    id: number; team_id: number; name: string; is_goalie: number; roster_level: string; is_scratch: number;
    is_active: number; is_personal: number; rwha_id: number | null;
  }>();

  const summary: SyncSummary = {
    teams: 0, players: 0, updated: 0,
    added: [], moved: [], removed: [], renamed: [], linesReset: [], purged: 0,
  };
  const stmts: D1PreparedStatement[] = [];
  const teamNameById = new Map(teams.map(t => [t.id, t.name]));

  // 3. Match teams: permanent rwha.net number first, then name.
  const teamIdByNumber = new Map<number, number>();
  const usedTeams = new Set<number>();
  for (const rt of remote) {
    const match =
      teams.find(t => t.rwha_number === rt.number) ??
      teams.find(t => t.rwha_number == null && !usedTeams.has(t.id) && t.name.toLowerCase() === rt.name.toLowerCase());
    if (!match) continue;                           // unknown team — skip rather than guess
    usedTeams.add(match.id);
    teamIdByNumber.set(rt.number, match.id);
    if (match.name !== rt.name || match.rwha_number !== rt.number) {
      stmts.push(db.prepare(`UPDATE teams SET name = ?, rwha_number = ? WHERE id = ?`).bind(rt.name, rt.number, match.id));
      if (match.name !== rt.name) {
        summary.renamed.push(`${match.name} → ${rt.name}`);
        teamNameById.set(match.id, rt.name);
      }
    }
  }
  // Renamed teams that have never synced can't match by number or name, so
  // pair each leftover rwha.net team with the leftover D1 team whose roster
  // overlaps it most (needs a clear majority of shared player names).
  const namesByTeam = new Map<number, Set<string>>();
  for (const p of players) {
    if (!p.is_active) continue;
    if (!namesByTeam.has(p.team_id)) namesByTeam.set(p.team_id, new Set());
    namesByTeam.get(p.team_id)!.add(normName(p.name));
  }
  for (const rt of remote) {
    if (teamIdByNumber.has(rt.number)) continue;
    const names = rt.players.map(x => normName(x.p.name));
    let best: { id: number; overlap: number } | null = null;
    for (const t of teams) {
      if (usedTeams.has(t.id)) continue;
      const set = namesByTeam.get(t.id) ?? new Set();
      const overlap = names.filter(n => set.has(n)).length;
      if (!best || overlap > best.overlap) best = { id: t.id, overlap };
    }
    if (!best || best.overlap < Math.max(8, names.length * 0.5)) continue;
    const match = teams.find(t => t.id === best!.id)!;
    usedTeams.add(match.id);
    teamIdByNumber.set(rt.number, match.id);
    stmts.push(db.prepare(`UPDATE teams SET name = ?, rwha_number = ? WHERE id = ?`).bind(rt.name, rt.number, match.id));
    if (match.name !== rt.name) {
      summary.renamed.push(`${match.name} → ${rt.name}`);
      teamNameById.set(match.id, rt.name);
    }
  }

  if (teamIdByNumber.size < remote.length - 2) {
    throw new Error(`Only matched ${teamIdByNumber.size} of ${remote.length} teams — aborting`);
  }
  summary.teams = teamIdByNumber.size;

  // 4. Match players: rwha id → same-team name → unique league-wide name.
  //    rwha.net numbers skaters and goalies separately, so the id is only
  //    unique together with the player type. Active rows win over hidden ones.
  const idKey = (isGoalie: number, id: number) => `${isGoalie ? 'g' : 's'}:${id}`;
  const byRwhaId = new Map<string, (typeof players)[number]>();
  for (const p of [...players].sort((a, b) => a.is_active - b.is_active)) {
    if (p.rwha_id != null) byRwhaId.set(idKey(p.is_goalie, p.rwha_id), p);
  }
  const claimed  = new Set<number>();
  const byName   = new Map<string, typeof players>();
  for (const p of players) {
    if (p.rwha_id != null) continue;
    const k = normName(p.name);
    byName.set(k, [...(byName.get(k) ?? []), p]);
  }

  const personalNames = new Set(PERSONAL_PLAYERS.map(normName));
  const seenIds = new Set<number>();
  for (const rt of remote) {
    const teamId = teamIdByNumber.get(rt.number);
    if (teamId == null) continue;

    for (const { p, level, scratch } of rt.players) {
      summary.players++;
      const isGoalie = p.kind === 'goalie' ? 1 : 0;
      const personal = personalNames.has(normName(p.name)) ? 1 : 0;
      const fields = {
        name: p.name.trim(), position: mapPosition(p), attrs: mapAttrs(p),
        ov: intOrNull(p.ovr) ?? 50, age: intOrNull(p.age), contract: intOrNull(p.contract),
        salary: intOrNull(p.salary), nhlId: intOrNull(p.nhl_id),
      };

      let existing = byRwhaId.get(idKey(isGoalie, p.id));
      if (!existing) {
        const cands = (byName.get(normName(p.name)) ?? []).filter(c => !claimed.has(c.id) && c.is_goalie === isGoalie);
        existing = cands.find(c => c.team_id === teamId) ?? (cands.length === 1 ? cands[0] : undefined);
      }

      if (existing && !seenIds.has(existing.id)) {
        claimed.add(existing.id);
        seenIds.add(existing.id);
        if (existing.team_id !== teamId) {
          summary.moved.push(`${fields.name} (${teamNameById.get(existing.team_id)} → ${teamNameById.get(teamId)})`);
        } else if (!existing.is_active) {
          summary.added.push(`${fields.name} (${teamNameById.get(teamId)}, returning)`);
        }
        // Keep the GM's scratch choice unless the player changed team or level.
        const keepScratch = existing.team_id === teamId && existing.roster_level === level && existing.is_active;
        const isScratch = level === 'farm' ? 0 : keepScratch ? existing.is_scratch : scratch ? 1 : 0;
        stmts.push(db.prepare(`
          UPDATE players SET team_id = ?, name = ?, position = ?, is_goalie = ?, ov = ?, attrs = ?,
                 age = ?, contract_yrs = ?, salary = ?, roster_level = ?, is_scratch = ?,
                 rwha_id = ?, is_active = 1,
                 is_personal = CASE WHEN ? = 1 THEN 1 ELSE is_personal END,
                 -- NHL id: rwha.net's if it has one; else keep one our own lookup
                 -- found (nhl_lookup_at set); anything else is stale — clear it
                 -- so the headshot lookup finds the right one.
                 nhl_id = CASE WHEN ? IS NOT NULL THEN ?
                               WHEN nhl_lookup_at IS NOT NULL THEN nhl_id
                               ELSE NULL END
          WHERE id = ?
        `).bind(teamId, fields.name, fields.position, isGoalie, fields.ov, fields.attrs,
                fields.age, fields.contract, fields.salary, level, isScratch,
                p.id, personal, fields.nhlId, fields.nhlId, existing.id));
        summary.updated++;
      } else {
        const jersey = intOrNull(p.jersey);
        stmts.push(db.prepare(`
          INSERT INTO players (team_id, name, position, is_goalie, ov, attrs, age, contract_yrs, salary,
                               roster_level, is_scratch, rwha_id, nhl_id, jersey_number, is_active, is_personal)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `).bind(teamId, fields.name, fields.position, isGoalie, fields.ov, fields.attrs,
                fields.age, fields.contract, fields.salary, level, scratch && level === 'pro' ? 1 : 0,
                p.id, fields.nhlId, jersey && jersey > 0 ? jersey : null, personal));
        summary.added.push(`${fields.name} (${teamNameById.get(teamId)})`);
      }
    }
  }

  // 5. Hide players who are no longer on any rwha.net roster (never personal ones).
  for (const p of players) {
    // Only for teams we matched — an unmatched team is left alone entirely.
    if (p.is_active && !p.is_personal && !seenIds.has(p.id) && usedTeams.has(p.team_id)) {
      stmts.push(db.prepare(`UPDATE players SET is_active = 0 WHERE id = ?`).bind(p.id));
      summary.removed.push(`${p.name} (${teamNameById.get(p.team_id)})`);
    }
  }

  // 6. Apply in chunks (D1 runs each batch as a transaction).
  for (let i = 0; i < stmts.length; i += 100) {
    await db.batch(stmts.slice(i, i + 100));
  }

  // 6b. Hidden players with no game stats serve no purpose — delete them.
  const purge = await db.prepare(`
    DELETE FROM players
    WHERE is_active = 0
      AND team_id IN (SELECT id FROM teams WHERE season_id = ?)
      AND id NOT IN (SELECT player_id FROM skater_game_stats)
      AND id NOT IN (SELECT player_id FROM goalie_game_stats)
  `).bind(season.id).run();
  summary.purged = purge.meta.changes ?? 0;

  // 7. GM-set lines that now reference a player who left the team fall back
  //    to computer lines (the saved lines are kept for the GM to edit).
  const { results: custom } = await db.prepare(`
    SELECT tl.team_id, tl.lines_json FROM team_lines tl
    JOIN teams t ON t.id = tl.team_id
    WHERE t.season_id = ? AND tl.use_computer_lines = 0 AND tl.lines_json IS NOT NULL
  `).bind(season.id).all<{ team_id: number; lines_json: string }>();
  for (const row of custom) {
    const { results: roster } = await db.prepare(`SELECT id FROM players WHERE team_id = ? AND is_active = 1`)
      .bind(row.team_id).all<{ id: number }>();
    const onTeam = new Set(roster.map(r => r.id));
    let ids: number[] = [];
    try {
      const l = JSON.parse(row.lines_json);
      ids = [...(l.forwards ?? []).flat(), ...(l.defense ?? []).flat(), l.starter_id, l.backup_id]
        .filter((x: unknown) => typeof x === 'number');
    } catch { /* unreadable lines → reset */ }
    if (ids.length === 0 || ids.some(id => !onTeam.has(id))) {
      await db.prepare(`UPDATE team_lines SET use_computer_lines = 1 WHERE team_id = ?`).bind(row.team_id).run();
      summary.linesReset.push(teamNameById.get(row.team_id) ?? String(row.team_id));
    }
  }

  return summary;
}

// ── NHL ids for headshots ─────────────────────────────────────────────────────
//
// Roster pages show photos from puckpedia.com keyed by NHL player id. rwha.net
// only supplies that id for some players, so we look the rest up:
//   1. one request for the NHL's full active-player list (covers most), then
//   2. a per-name search for the leftovers (prospects, recently retired),
//      capped by `budget` so a single Worker request stays under Cloudflare's
//      subrequest limit. Players we can't find (e.g. the league's personal
//      players) aren't retried for two weeks.

const NHL_SEARCH = 'https://search.d3.nhle.com/api/v1/search/player?culture=en-us';
const LOOKUP_RETRY_MS = 14 * 24 * 60 * 60 * 1000;

interface NhlPlayer { playerId: string | number; name: string; positionCode: string; lastSeasonId?: string | null }

const NICKNAMES: string[][] = [
  ['thomas', 'tom', 'tommy'], ['michael', 'mike', 'mikey'], ['jacob', 'jake'], ['joshua', 'josh'],
  ['nicholas', 'nicolas', 'nick', 'nic', 'nico'], ['alexander', 'alexandre', 'alex', 'sasha'],
  ['matthew', 'matt', 'matty'], ['zachary', 'zach', 'zack'], ['christopher', 'chris'],
  ['samuel', 'sam'], ['mitchell', 'mitch'], ['daniel', 'dan', 'danny'], ['william', 'will', 'bill'],
  ['benjamin', 'ben'], ['jonathan', 'jon'], ['joseph', 'joe', 'joey'], ['anthony', 'tony'],
  ['maxim', 'max', 'maxime'], ['evgeni', 'evgeny', 'evgenii'], ['alexei', 'aleksei', 'alexey'],
  ['yegor', 'egor'], ['dmitri', 'dmitry'], ['cameron', 'cam'], ['patrick', 'pat'],
  ['robert', 'rob', 'bobby'], ['timothy', 'tim'], ['edward', 'eddie'], ['jeffrey', 'jeff'],
];

function firstNamesCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a))) return true;
  return NICKNAMES.some(g => g.includes(a) && g.includes(b));
}

const kindOf = (pos: string) => pos === 'G' ? 'G' : pos.includes('D') && !/[CLR]/.test(pos) ? 'D' : 'F';

/** Best NHL match for one of our players among `cands`, or null. Exported for tests. */
export function matchNhl(name: string, ourPos: string, cands: NhlPlayer[]): NhlPlayer | null {
  const want = kindOf(ourPos);
  const ours = normName(name).split(' ');
  const sameKind = cands.filter(c => kindOf(c.positionCode) === want ||
    // RWHA sometimes lists D-men as forwards and vice versa; goalies never mix
    (want !== 'G' && kindOf(c.positionCode) !== 'G'));
  const newest = (list: NhlPlayer[]) =>
    [...list].sort((x, y) => Number(y.lastSeasonId ?? 0) - Number(x.lastSeasonId ?? 0))[0] ?? null;

  const exact = sameKind.filter(c => normName(c.name) === ours.join(' '));
  const exactSamePos = exact.filter(c => kindOf(c.positionCode) === want);
  if (exactSamePos.length === 1) return exactSamePos[0]!;
  if (exactSamePos.length > 1) return newest(exactSamePos);
  if (exact.length === 1) return exact[0]!;

  // Same last name(s), compatible first name (Matt/Matthew, Tommy/Thomas…).
  const loose = sameKind.filter(c => {
    const theirs = normName(c.name).split(' ');
    return theirs.slice(1).join(' ') === ours.slice(1).join(' ') &&
           firstNamesCompatible(theirs[0]!, ours[0]!) && kindOf(c.positionCode) === want;
  });
  return loose.length === 1 ? loose[0]! : null;
}

export async function fillNhlIds(
  db: D1Database,
  budget: number,
  fetchJson: (url: string) => Promise<unknown> = async url => {
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`NHL search → HTTP ${r.status}`);
    return r.json();
  },
): Promise<{ matched: number; checked: number; remaining: number }> {
  await ensureSchema(db);
  const now = Date.now();
  const { results: todo } = await db.prepare(`
    SELECT p.id, p.name, p.position FROM players p
    JOIN teams t ON t.id = p.team_id
    JOIN seasons s ON s.id = t.season_id AND s.status = 'active'
    WHERE p.is_active = 1 AND p.nhl_id IS NULL AND p.is_personal = 0
      AND (p.nhl_lookup_at IS NULL OR p.nhl_lookup_at < ?)
    ORDER BY p.nhl_lookup_at IS NOT NULL, p.id
  `).bind(now - LOOKUP_RETRY_MS).all<{ id: number; name: string; position: string }>();
  if (todo.length === 0 || budget < 1) return { matched: 0, checked: 0, remaining: todo.length };

  const found = new Map<number, number>();   // our player id → NHL id
  const checked = new Set<number>();

  // 1. The full active list, one request.
  const active = await fetchJson(`${NHL_SEARCH}&limit=5000&q=*&active=true`) as NhlPlayer[];
  let used = 1;
  const byLast = new Map<string, NhlPlayer[]>();
  for (const p of active) {
    const last = normName(p.name).split(' ').slice(1).join(' ');
    byLast.set(last, [...(byLast.get(last) ?? []), p]);
  }
  const leftovers: typeof todo = [];
  for (const p of todo) {
    const last = normName(p.name).split(' ').slice(1).join(' ');
    const m = matchNhl(p.name, p.position, byLast.get(last) ?? []);
    if (m) { found.set(p.id, Number(m.playerId)); checked.add(p.id); }
    else leftovers.push(p);
  }

  // 2. Per-name searches for the rest, within budget.
  for (const p of leftovers) {
    if (used >= budget) break;
    used++;
    checked.add(p.id);
    try {
      const hits = await fetchJson(`${NHL_SEARCH}&limit=20&q=${encodeURIComponent(p.name)}`) as NhlPlayer[];
      const m = matchNhl(p.name, p.position, hits);
      if (m) found.set(p.id, Number(m.playerId));
    } catch { /* try again on a later run */ checked.delete(p.id); }
  }

  const stmts: D1PreparedStatement[] = [];
  for (const id of checked) {
    const nhl = found.get(id);
    stmts.push(nhl
      ? db.prepare(`UPDATE players SET nhl_id = ?, nhl_lookup_at = ? WHERE id = ?`).bind(nhl, now, id)
      : db.prepare(`UPDATE players SET nhl_lookup_at = ? WHERE id = ?`).bind(now, id));
  }
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));

  return { matched: found.size, checked: checked.size, remaining: todo.length - checked.size };
}
