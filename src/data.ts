// ── Data loading ─────────────────────────────────────────────────────────────
//
// Reads `data/rwha.json` (a snapshot of the live rwha-stats-site `data.js`)
// and produces a clean `League` object with typed `Skater` / `Goalie` /
// `Team` records.
//
// In Phase 3 (webapp), this loader will be replaced by a D1 query layer.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import type {
  RawData, RawTeam, RawSkater, RawGoalie,
  League, Team, Skater, Goalie, Position,
  SkaterAttrs, GoalieAttrs,
} from './types.ts';

// Resolve `data/rwha.json` relative to this file (works from any CWD)
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, '..', 'data', 'rwha.json');

// ── Parsers ──────────────────────────────────────────────────────────────────
function n(s: string | undefined): number {
  // Permissive number parse — empty string / undefined → 0
  if (!s) return 0;
  const v = Number(s);
  return Number.isFinite(v) ? v : 0;
}

function parseSalary(raw: string): number {
  // "$12,600,000" → 12600000
  if (!raw) return 0;
  return n(raw.replace(/[^0-9]/g, ''));
}

function cleanName(raw: string): string {
  // Names occasionally carry trailing tags like "(R)" (rookie) or "(C)" (captain).
  // Keep them off the pretty-printed name; we can re-derive later if needed.
  return raw.replace(/\s*\([RCAU]\)\s*$/, '').trim();
}

function parseSkater(r: RawSkater): Skater {
  const attrs: SkaterAttrs = {
    ck: n(r.ck), fg: n(r.fg), di: n(r.di), sk: n(r.sk), st: n(r.st),
    en: n(r.en), du: n(r.du), ph: n(r.ph), fo: n(r.fo), pa: n(r.pa),
    sc: n(r.sc), df: n(r.df), ps: n(r.ps), ex: n(r.ex), ld: n(r.ld),
    po: n(r.po), mo: n(r.mo),
  };
  return {
    name: cleanName(r.nm),
    position: r.p as Position,
    jersey: r.n ? n(r.n) : null,
    ov: n(r.ov),
    age: n(r.age),
    contractYears: n(r.c),
    salary: parseSalary(r.sal),
    injured: !!r.ij,
    attrs,
  };
}

function parseGoalie(r: RawGoalie): Goalie {
  const attrs: GoalieAttrs = {
    sk: n(r.sk), du: n(r.du), en: n(r.en), sz: n(r.sz), ag: n(r.ag),
    rb: n(r.rb), sc: n(r.sc), hs: n(r.hs), rt: n(r.rt), ph: n(r.ph),
    ps: n(r.ps), ex: n(r.ex), ld: n(r.ld), po: n(r.po), mo: n(r.mo),
  };
  return {
    name: cleanName(r.nm),
    ov: n(r.ov),
    age: n(r.age),
    contractYears: n(r.c),
    salary: parseSalary(r.sal),
    injured: !!r.ij,
    attrs,
  };
}

function parseTeam(raw: RawTeam): Team {
  return {
    name: raw.n,
    gm: raw.gm,
    farmName: raw.fn,
    proOverall: n(raw.po),
    proMorale: n(raw.pm),
    farmOverall: n(raw.fo),
    farmMorale: n(raw.fm),
    proSkaters:  raw.ps.map(parseSkater),
    proGoalies:  raw.pg.map(parseGoalie),
    farmSkaters: (raw.fs ?? []).map(parseSkater),
    farmGoalies: (raw.fg ?? []).map(parseGoalie),
  };
}

// ── Public API ───────────────────────────────────────────────────────────────
export function loadLeague(path: string = DATA_PATH): League {
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as RawData;
  const teams = new Map<string, Team>();
  for (const [key, value] of Object.entries(raw)) {
    teams.set(key, parseTeam(value));
  }
  return { teams };
}

export function getTeam(league: League, name: string): Team {
  // Case-insensitive lookup so `npm run sim bunnies vs gladiators` works
  const exact = league.teams.get(name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  for (const [k, v] of league.teams) {
    if (k.toLowerCase() === lower) return v;
  }
  throw new Error(
    `Unknown team "${name}". Known teams: ${[...league.teams.keys()].sort().join(', ')}`,
  );
}
