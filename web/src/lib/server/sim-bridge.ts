// ── Sim bridge ────────────────────────────────────────────────────────────────
// Connects D1 player/lines data → sim engine types → simulateGame().
// Runs inside a Cloudflare Worker (SSR) only.

import type { D1Database }  from '@cloudflare/workers-types';
import type { Team, Skater, Goalie, Lines } from '$engine/types';
import { simulateGame }     from '$engine/sim';
import { generateLines }    from '$engine/lines';
import { makeRng, derive }  from '$engine/rng';
import type { PlayerRow, TeamLinesRow } from './db';

// ── Injury constants ──────────────────────────────────────────────────────────
// Probability per game: 0.2% (du=99) → 1.0% (du=1).
// Formula: BASE + RANGE * (99 - du) / 98
const INJ_BASE  = 0.002;   // min injury prob per game (elite durability)
const INJ_RANGE = 0.008;   // added prob at du=1 vs du=99

// Severity tiers (weights: 50 / 30 / 15 / 5)
// games missed = uniform draw within each tier's range [min, max]
const INJ_TIERS: { w: number; min: number; max: number }[] = [
  { w: 50, min: 1,  max: 3  },   // minor
  { w: 30, min: 4,  max: 7  },   // moderate
  { w: 15, min: 8,  max: 14 },   // significant
  { w: 5,  min: 15, max: 30 },   // major
];

// ── Convert D1 rows → engine Team ────────────────────────────────────────────
function rowToSkater(r: PlayerRow): Skater {
  const attrs = JSON.parse(r.attrs);
  return {
    name:          r.name,
    position:      r.position as Skater['position'],
    jersey:        null,
    ov:            r.ov,
    age:           r.age ?? 25,
    contractYears: r.contract_yrs ?? 1,
    salary:        r.salary ?? 0,
    injured:       r.injured_games_remaining > 0,
    attrs,
  };
}

function rowToGoalie(r: PlayerRow): Goalie {
  const attrs = JSON.parse(r.attrs);
  return {
    name:          r.name,
    ov:            r.ov,
    age:           r.age ?? 25,
    contractYears: r.contract_yrs ?? 1,
    salary:        r.salary ?? 0,
    injured:       r.injured_games_remaining > 0,
    attrs,
  };
}

export function buildTeam(
  teamName: string,
  gmName: string,
  players: PlayerRow[],
): Team {
  const proSkaters  = players.filter(p => !p.is_goalie && p.roster_level === 'pro' && !p.is_scratch).map(rowToSkater);
  const proGoalies  = players.filter(p =>  p.is_goalie && p.roster_level === 'pro' && !p.is_scratch).map(rowToGoalie);
  const farmSkaters = players.filter(p => !p.is_goalie && p.roster_level === 'farm').map(rowToSkater);
  const farmGoalies = players.filter(p =>  p.is_goalie && p.roster_level === 'farm').map(rowToGoalie);

  return {
    name: teamName,
    gm: gmName,
    farmName: '',
    proOverall: 0,
    proMorale: 0,
    farmOverall: 0,
    farmMorale: 0,
    proSkaters,
    proGoalies,
    farmSkaters,
    farmGoalies,
  };
}

// ── Parse stored lines JSON → engine Lines ────────────────────────────────────
function parseStoredLines(linesJson: string, players: PlayerRow[]): Lines | null {
  try {
    // linesJson shape: { forwards: [[lw_id, c_id, rw_id], ...x4], defense: [[ld_id, rd_id], ...x3], starter_id, backup_id, toi }
    const data = JSON.parse(linesJson) as {
      forwards: [number, number, number][];
      defense: [number, number][];
      starter_id: number;
      backup_id: number;
      toi?: { forwards: [number,number,number,number]; defense: [number,number,number] };
    };

    const byId = new Map(players.map(p => [p.id, p]));
    const getSkater = (id: number): Skater => rowToSkater(byId.get(id)!);
    const getGoalie = (id: number): Goalie => rowToGoalie(byId.get(id)!);

    return {
      forwards: data.forwards.slice(0, 4).map(([lw, c, rw]) => ({
        lw: getSkater(lw), c: getSkater(c), rw: getSkater(rw),
      })) as Lines['forwards'],
      defense: data.defense.slice(0, 3).map(([ld, rd]) => ({
        ld: getSkater(ld), rd: getSkater(rd),
      })) as Lines['defense'],
      starter: getGoalie(data.starter_id),
      backup:  getGoalie(data.backup_id),
      toi: data.toi ?? { forwards: [20, 17, 14, 9], defense: [24, 21, 15] },
    };
  } catch {
    return null;  // fall back to computer lines
  }
}

// ── Main: simulate one game, return BoxScore + write to D1 ───────────────────
export interface RunGameResult {
  gameId: number;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  finalLabel: string;
  boxScore: object;
  seed: number;
}

export async function runGame(
  db: D1Database,
  gameId: number,
  seasonId: number,
): Promise<RunGameResult> {
  // 1. Load the scheduled game
  const gameRow = await db
    .prepare('SELECT * FROM scheduled_games WHERE id = ? AND season_id = ?')
    .bind(gameId, seasonId)
    .first<{ id: number; home_team_id: number; away_team_id: number; status: string }>();

  if (!gameRow)  throw new Error(`Game ${gameId} not found`);
  if (gameRow.status === 'complete') throw new Error(`Game ${gameId} already played`);

  // 2. Load both teams' players + GM names
  const loadTeam = async (teamId: number) => {
    const teamMeta = await db
      .prepare('SELECT name, gm_name FROM teams WHERE id = ?')
      .bind(teamId)
      .first<{ name: string; gm_name: string }>();
    const { results: players } = await db
      .prepare('SELECT * FROM players WHERE team_id = ?')
      .bind(teamId)
      .all<PlayerRow>();
    return { meta: teamMeta!, players };
  };

  const [homeData, awayData] = await Promise.all([
    loadTeam(gameRow.home_team_id),
    loadTeam(gameRow.away_team_id),
  ]);

  // 3. Load lines (stored or computer-generated)
  const loadLines = async (teamId: number, team: Team): Promise<Lines> => {
    const linesRow = await db
      .prepare('SELECT * FROM team_lines WHERE team_id = ?')
      .bind(teamId)
      .first<TeamLinesRow>();

    if (linesRow && !linesRow.use_computer_lines && linesRow.lines_json) {
      const parsed = parseStoredLines(linesRow.lines_json, homeData.players.concat(awayData.players));
      if (parsed) {
        // Stored lines may not have PP/PK units yet — auto-generate them if absent
        if (!parsed.pp || !parsed.pk) {
          const autoLines = generateLines(team);
          if (!parsed.pp) parsed.pp = autoLines.pp;
          if (!parsed.pk) parsed.pk = autoLines.pk;
        }
        return parsed;
      }
    }
    // Default: auto-generate from OV (always includes PP/PK)
    return generateLines(team);
  };

  const homeTeam = buildTeam(homeData.meta.name, homeData.meta.gm_name, homeData.players);
  const awayTeam = buildTeam(awayData.meta.name, awayData.meta.gm_name, awayData.players);

  const [homeLines, awayLines] = await Promise.all([
    loadLines(gameRow.home_team_id, homeTeam),
    loadLines(gameRow.away_team_id, awayTeam),
  ]);

  // 4. Load rivalry level between these two teams (0 if none)
  const rivalryRow = await db
    .prepare(`
      SELECT level FROM rivalries
      WHERE (team_a_id = ? AND team_b_id = ?) OR (team_a_id = ? AND team_b_id = ?)
    `)
    .bind(gameRow.home_team_id, gameRow.away_team_id,
          gameRow.away_team_id, gameRow.home_team_id)
    .first<{ level: number }>();
  const rivalryLevel = rivalryRow?.level ?? 0;

  // 5. Run the sim
  const seed = Math.floor(Math.random() * 0x7fffffff);
  const box  = simulateGame(homeTeam, awayTeam, { seed, gameId, homeLines, awayLines, rivalryLevel });

  const homeGoals = box.home.goalsByPeriod.reduce((s, n) => s + n, 0);
  const awayGoals = box.away.goalsByPeriod.reduce((s, n) => s + n, 0);
  const homeSog   = box.home.sogByPeriod.reduce((s, n) => s + n, 0);
  const awaySog   = box.away.sogByPeriod.reduce((s, n) => s + n, 0);
  const now       = new Date().toISOString();

  // 5. Write results to D1 in a batch
  const stmts = [
    // game_results
    db.prepare(`
      INSERT INTO game_results (game_id, home_goals, away_goals, final_label, home_sog, away_sog, box_score_json, sim_seed, simulated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(gameId, homeGoals, awayGoals, box.finalLabel, homeSog, awaySog, JSON.stringify(box), seed, now),

    // Mark game complete
    db.prepare(`UPDATE scheduled_games SET status = 'complete', played_at = ? WHERE id = ?`)
      .bind(now, gameId),
  ];

  // skater_game_stats
  for (const s of box.skaters) {
    const player = [...homeData.players, ...awayData.players]
      .find(p => p.name === s.name && !p.is_goalie);
    if (!player) continue;
    const teamId = s.team === homeData.meta.name ? gameRow.home_team_id : gameRow.away_team_id;
    stmts.push(db.prepare(`
      INSERT INTO skater_game_stats (game_id, player_id, team_id, g, a, plus_minus, sog, hits, blocks, pim, toi)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(gameId, player.id, teamId, s.g, s.a, s.plusMinus, s.sog, s.hits, s.blocks, s.pim, s.toi));
  }

  // goalie_game_stats
  for (const g of box.goalies) {
    const player = [...homeData.players, ...awayData.players]
      .find(p => p.name === g.name && p.is_goalie);
    if (!player) continue;
    const teamId = g.team === homeData.meta.name ? gameRow.home_team_id : gameRow.away_team_id;
    stmts.push(db.prepare(`
      INSERT INTO goalie_game_stats (game_id, player_id, team_id, decision, shots_against, goals_against, toi)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(gameId, player.id, teamId, g.decision, g.shotsAgainst, g.goalsAgainst, g.toi));
  }

  // D1 batch 1 — game results + per-player stats
  await db.batch(stmts);

  // D1 batch 2 — injury tick-downs + new injury rolls (separate to stay under D1's 100-stmt limit)
  const playedSkaterNames = new Set(box.skaters.map(s => s.name));
  const playedGoalieNames = new Set(box.goalies.map(g => g.name));
  const allPlayers = [...homeData.players, ...awayData.players];
  const injuryStmts = buildInjuryStmts(db, allPlayers, playedSkaterNames, playedGoalieNames, seed);
  if (injuryStmts.length > 0) await db.batch(injuryStmts);

  // D1 batch 3 — suspension tick-downs + new suspensions from game misconducts
  const suspensionStmts = buildSuspensionStmts(db, allPlayers, box.fights,
    homeData.meta.name, awayData.meta.name);
  if (suspensionStmts.length > 0) await db.batch(suspensionStmts);

  return {
    gameId,
    homeTeam: homeData.meta.name,
    awayTeam: awayData.meta.name,
    homeGoals,
    awayGoals,
    finalLabel: box.finalLabel,
    boxScore: box,
    seed,
  };
}

// ── Injury helpers ────────────────────────────────────────────────────────────

/** Injury probability for a player with this durability rating (1–99). */
function injuryProb(du: number): number {
  const clamped = Math.max(1, Math.min(99, du));
  return INJ_BASE + INJ_RANGE * (99 - clamped) / 98;
}

/**
 * Roll injury checks + tick down existing injuries after a completed game.
 * Returns D1 prepared statements to include in the batch.
 *
 * - Already-injured players on both rosters have their counter decremented by 1
 *   (so their injury naturally expires game-by-game).
 * - Players who appeared in the box score and are NOT already injured get a
 *   du-based injury check. If they roll unlucky, they sit out 1–30 games.
 *
 * Uses a sub-RNG derived from the game seed so results are reproducible.
 */
function buildInjuryStmts(
  db: D1Database,
  allPlayers: PlayerRow[],
  playedSkaterNames: Set<string>,
  playedGoalieNames: Set<string>,
  seed: number,
): ReturnType<D1Database['prepare']>[] {
  const rng   = makeRng(derive(seed, 'injuries'));
  const stmts: ReturnType<D1Database['prepare']>[] = [];
  const tierWeights = INJ_TIERS.map(t => t.w);

  for (const player of allPlayers) {
    const alreadyInjured = player.injured_games_remaining > 0;

    if (alreadyInjured) {
      // Tick down by 1 (min 0)
      const newVal = player.injured_games_remaining - 1;
      stmts.push(
        db.prepare('UPDATE players SET injured_games_remaining = ? WHERE id = ?')
          .bind(newVal, player.id),
      );
      continue;   // don't re-roll for already-injured players
    }

    // Only roll for players who actually appeared in this game
    const played = player.is_goalie
      ? playedGoalieNames.has(player.name)
      : playedSkaterNames.has(player.name);
    if (!played) continue;

    let du = 50;  // fallback if attrs missing
    try {
      const attrs = typeof player.attrs === 'string'
        ? JSON.parse(player.attrs)
        : player.attrs;
      if (typeof attrs?.du === 'number') du = attrs.du;
    } catch { /* use fallback */ }

    const prob = injuryProb(du);
    if (!rng.bool(prob)) continue;   // no injury this game

    // Pick severity tier, then a random number of games within that tier
    const tierIdx    = rng.weighted(tierWeights);
    const tier       = INJ_TIERS[tierIdx]!;
    const gamesMissed = rng.int(tier.min, tier.max);

    stmts.push(
      db.prepare('UPDATE players SET injured_games_remaining = ? WHERE id = ?')
        .bind(gamesMissed, player.id),
    );
  }

  return stmts;
}

// ── Suspension helpers ────────────────────────────────────────────────────────

/**
 * Process game misconducts from fights into 1-game suspensions.
 * Also tick down any existing suspensions by 1 for players who played today.
 */
function buildSuspensionStmts(
  db: D1Database,
  allPlayers: PlayerRow[],
  fights: import('$engine/types').FightEvent[],
  homeTeamName: string,
  _awayTeamName: string,
): ReturnType<D1Database['prepare']>[] {
  const stmts: ReturnType<D1Database['prepare']>[] = [];

  // Tick down existing suspensions for all players (min 0)
  for (const player of allPlayers) {
    if (player.suspended_games_remaining > 0) {
      const newVal = player.suspended_games_remaining - 1;
      stmts.push(
        db.prepare('UPDATE players SET suspended_games_remaining = ? WHERE id = ?')
          .bind(newVal, player.id),
      );
    }
  }

  // Issue new 1-game suspensions for game misconducts in this game
  const byName = new Map(allPlayers.map(p => [p.name, p]));

  for (const fight of fights) {
    // homeGameMisconduct → home player is ejected and suspended 1 game
    if (fight.homeGameMisconduct) {
      const player = byName.get(fight.homePlayer);
      if (player) {
        stmts.push(
          db.prepare('UPDATE players SET suspended_games_remaining = ? WHERE id = ?')
            .bind(1, player.id),
        );
      }
    }
    // awayGameMisconduct → away player is ejected
    if (fight.awayGameMisconduct) {
      const player = byName.get(fight.awayPlayer);
      if (player) {
        stmts.push(
          db.prepare('UPDATE players SET suspended_games_remaining = ? WHERE id = ?')
            .bind(1, player.id),
        );
      }
    }
  }

  // Suppress unused-var warning for homeTeamName (kept for future use)
  void homeTeamName;

  return stmts;
}

// ── Pick next N unplayed games for the current season ────────────────────────
export async function pickNextGames(
  db: D1Database,
  seasonId: number,
  count: number,
): Promise<number[]> {
  const { results } = await db
    .prepare(`
      SELECT id FROM scheduled_games
      WHERE season_id = ? AND status = 'scheduled'
      ORDER BY week, id
      LIMIT ?
    `)
    .bind(seasonId, count)
    .all<{ id: number }>();
  return results.map(r => r.id);
}
