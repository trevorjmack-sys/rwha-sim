// ── Sim bridge ────────────────────────────────────────────────────────────────
// Connects D1 player/lines data → sim engine types → simulateGame().
// Runs inside a Cloudflare Worker (SSR) only.

import type { D1Database }  from '@cloudflare/workers-types';
import type { Team, Skater, Goalie, Lines } from '$engine/types';
import { simulateGame }     from '$engine/sim';
import { generateLines }    from '$engine/lines';
import type { PlayerRow, TeamLinesRow } from './db';

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
      if (parsed) return parsed;
    }
    // Default: auto-generate from OV
    return generateLines(team);
  };

  const homeTeam = buildTeam(homeData.meta.name, homeData.meta.gm_name, homeData.players);
  const awayTeam = buildTeam(awayData.meta.name, awayData.meta.gm_name, awayData.players);

  const [homeLines, awayLines] = await Promise.all([
    loadLines(gameRow.home_team_id, homeTeam),
    loadLines(gameRow.away_team_id, awayTeam),
  ]);

  // 4. Run the sim
  const seed = Math.floor(Math.random() * 0x7fffffff);
  const box  = simulateGame(homeTeam, awayTeam, { seed, gameId, homeLines, awayLines });

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

  // D1 batch — all writes in one round-trip
  await db.batch(stmts);

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
