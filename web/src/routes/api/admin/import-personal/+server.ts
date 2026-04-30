// POST /api/admin/import-personal
// Body: { csvUrl: string }
// Auth: commissioner only
//
// Fetches a published Google Sheet CSV with 22 personal player rows,
// clears any existing is_personal=1 players, inserts the new ones.
//
// Expected CSV headers (case-insensitive):
//   team,name,position,age,ov,ck,fg,di,sk,st,en,du,ph,fo,pa,sc,df,ps,ex,ld,po,mo

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getActiveSeasonId } from '$lib/server/db';

const PERSONAL_SALARY = 8_500_000;

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  return lines.slice(1)
    .filter(l => l.trim())
    .map(line => {
      // Simple CSV parse (handles quoted fields)
      const values: string[] = [];
      let cur = '', inQuote = false;
      for (const ch of line) {
        if (ch === '"') { inQuote = !inQuote; continue; }
        if (ch === ',' && !inQuote) { values.push(cur.trim()); cur = ''; continue; }
        cur += ch;
      }
      values.push(cur.trim());

      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
    });
}

function num(v: string | undefined, fallback = 50): number {
  const n = parseInt(v ?? '', 10);
  return isNaN(n) ? fallback : n;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export const POST: RequestHandler = async ({ request, locals, platform }) => {
  if (!locals.user?.isCommissioner) throw error(403, 'Commissioner access required');

  const db = platform?.env.DB;
  if (!db) throw error(500, 'Database not available');

  let csvUrl: string;
  try {
    const body = await request.json() as { csvUrl?: string };
    if (!body.csvUrl?.startsWith('https://')) throw new Error('bad url');
    csvUrl = body.csvUrl;
  } catch {
    throw error(400, 'Provide { csvUrl: "https://..." }');
  }

  // ── Fetch the sheet ─────────────────────────────────────────────────────────
  let csvText: string;
  try {
    const res = await fetch(csvUrl, { headers: { 'User-Agent': 'RWHA-Sim/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    csvText = await res.text();
  } catch (e) {
    throw error(502, `Could not fetch CSV: ${(e as Error).message}`);
  }

  const rows = parseCsv(csvText);
  if (rows.length === 0) throw error(400, 'CSV is empty or malformed');

  // ── Resolve team IDs ────────────────────────────────────────────────────────
  const seasonId = await getActiveSeasonId(db);
  if (!seasonId) throw error(400, 'No active season');

  const { results: teams } = await db
    .prepare('SELECT id, name FROM teams WHERE season_id = ?')
    .bind(seasonId)
    .all<{ id: number; name: string }>();

  const teamMap = new Map(teams.map(t => [t.name.toLowerCase(), t.id]));

  // ── Validate rows ───────────────────────────────────────────────────────────
  const errors: string[] = [];
  const inserts: {
    teamId: number; name: string; position: string; age: number;
    ov: number; attrs: string;
  }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const lineNum = i + 2; // 1-indexed, +1 for header

    const teamId = teamMap.get((r.team ?? '').toLowerCase());
    if (!teamId) { errors.push(`Row ${lineNum}: unknown team "${r.team}"`); continue; }

    const name = (r.name ?? '').trim();
    if (!name) { errors.push(`Row ${lineNum}: missing name`); continue; }

    const position = (r.position ?? 'C').trim().toUpperCase();

    const attrs = JSON.stringify({
      ck: num(r.ck), fg: num(r.fg), di: num(r.di),
      sk: num(r.sk), st: num(r.st), en: num(r.en),
      du: num(r.du), ph: num(r.ph), fo: num(r.fo),
      pa: num(r.pa), sc: num(r.sc), df: num(r.df),
      ps: num(r.ps), ex: num(r.ex), ld: num(r.ld),
      po: num(r.po), mo: num(r.mo),
    });

    inserts.push({ teamId, name, position, age: num(r.age, 25), ov: num(r.ov, 75), attrs });
  }

  if (errors.length > 0) throw error(400, errors.join('\n'));

  // ── Write to D1 atomically ──────────────────────────────────────────────────
  const stmts = [
    // Clear old personal players for this season's teams
    db.prepare(`
      DELETE FROM players
      WHERE is_personal = 1
        AND team_id IN (SELECT id FROM teams WHERE season_id = ?)
    `).bind(seasonId),

    // Insert new personal players
    ...inserts.map(p =>
      db.prepare(`
        INSERT INTO players
          (team_id, name, position, is_goalie, ov, attrs, age, salary,
           roster_level, is_scratch, injured_games_remaining,
           suspended_games_remaining, is_personal)
        VALUES (?, ?, ?, 0, ?, ?, ?, ?, 'pro', 0, 0, 0, 1)
      `).bind(p.teamId, p.name, p.position, p.ov, p.attrs, p.age, PERSONAL_SALARY)
    ),
  ];

  await db.batch(stmts);

  return json({ ok: true, imported: inserts.length });
};
