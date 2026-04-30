// ── D1 query helpers ──────────────────────────────────────────────────────────
// Thin wrappers around D1 that return typed results. Keep queries here so
// routes stay clean. These run inside Cloudflare Workers (SSR) only — never
// call from client-side code.

import type { D1Database } from '@cloudflare/workers-types';

// ── Row shapes (what D1 returns) ─────────────────────────────────────────────
export interface TeamRow {
  id: number;
  season_id: number;
  name: string;
  gm_name: string;
  gm_email: string;
  farm_name: string | null;
  is_commissioner: number;
}

export interface PlayerRow {
  id: number;
  team_id: number;
  name: string;
  position: string;
  is_goalie: number;
  ov: number;
  attrs: string;           // JSON
  age: number | null;
  contract_yrs: number | null;
  salary: number | null;
  roster_level: 'pro' | 'farm';
  is_scratch: number;
  injured_games_remaining: number;
  suspended_games_remaining: number;
}

export interface GameRow {
  id: number;
  season_id: number;
  week: number;
  home_team_id: number;
  away_team_id: number;
  home_name: string;
  away_name: string;
  status: 'scheduled' | 'complete';
  played_at: string | null;
}

export interface ResultRow {
  id: number;
  game_id: number;
  home_goals: number;
  away_goals: number;
  final_label: string;
  home_sog: number;
  away_sog: number;
  box_score_json: string;
  simulated_at: string;
  sim_seed: number;
}

export interface TeamLinesRow {
  id: number;
  team_id: number;
  use_computer_lines: number;
  lines_json: string | null;
  updated_at: string | null;
}

// ── Standings helper ──────────────────────────────────────────────────────────
export interface StandingsRow {
  team_id: number;
  team_name: string;
  gp: number;
  w: number;
  l: number;
  otl: number;
  pts: number;
  gf: number;
  ga: number;
}

/** Pull current standings by aggregating game_results. */
export async function getStandings(db: D1Database, seasonId: number): Promise<StandingsRow[]> {
  const { results } = await db.prepare(`
    SELECT
      t.id   AS team_id,
      t.name AS team_name,
      COUNT(sg.id)                                                      AS gp,
      COALESCE(SUM(CASE
        WHEN sg.home_team_id = t.id AND r.home_goals > r.away_goals THEN 1
        WHEN sg.away_team_id = t.id AND r.away_goals > r.home_goals THEN 1
        ELSE 0 END), 0)                                                 AS w,
      COALESCE(SUM(CASE
        WHEN r.final_label = 'FINAL' AND (
          (sg.home_team_id = t.id AND r.home_goals < r.away_goals) OR
          (sg.away_team_id = t.id AND r.away_goals < r.home_goals)
        ) THEN 1 ELSE 0 END), 0)                                        AS l,
      COALESCE(SUM(CASE
        WHEN r.final_label != 'FINAL' AND (
          (sg.home_team_id = t.id AND r.home_goals < r.away_goals) OR
          (sg.away_team_id = t.id AND r.away_goals < r.home_goals)
        ) THEN 1 ELSE 0 END), 0)                                        AS otl,
      COALESCE(SUM(CASE
        WHEN sg.home_team_id = t.id AND r.home_goals > r.away_goals THEN 2
        WHEN sg.away_team_id = t.id AND r.away_goals > r.home_goals THEN 2
        WHEN r.final_label != 'FINAL' AND (
          (sg.home_team_id = t.id AND r.home_goals < r.away_goals) OR
          (sg.away_team_id = t.id AND r.away_goals < r.home_goals)
        ) THEN 1
        ELSE 0 END), 0)                                                 AS pts,
      COALESCE(SUM(CASE
        WHEN sg.home_team_id = t.id THEN r.home_goals
        ELSE r.away_goals END), 0)                                      AS gf,
      COALESCE(SUM(CASE
        WHEN sg.home_team_id = t.id THEN r.away_goals
        ELSE r.home_goals END), 0)                                      AS ga
    FROM teams t
    LEFT JOIN scheduled_games sg ON (sg.home_team_id = t.id OR sg.away_team_id = t.id)
                                 AND sg.season_id = ?
                                 AND sg.status = 'complete'
    LEFT JOIN game_results r ON r.game_id = sg.id
    WHERE t.season_id = ?
    GROUP BY t.id, t.name
    ORDER BY pts DESC, (gf - ga) DESC, gf DESC
  `).bind(seasonId, seasonId).all<StandingsRow>();
  return results;
}

/** Get scheduled games for a given week, with team names joined. */
export async function getWeekGames(db: D1Database, seasonId: number, week: number): Promise<GameRow[]> {
  const { results } = await db.prepare(`
    SELECT
      sg.id, sg.season_id, sg.week,
      sg.home_team_id, sg.away_team_id,
      h.name AS home_name, a.name AS away_name,
      sg.status, sg.played_at
    FROM scheduled_games sg
    JOIN teams h ON h.id = sg.home_team_id
    JOIN teams a ON a.id = sg.away_team_id
    WHERE sg.season_id = ? AND sg.week = ?
    ORDER BY sg.id
  `).bind(seasonId, week).all<GameRow>();
  return results;
}

/** Get the current active season id (highest id with status != 'complete'). */
export async function getActiveSeasonId(db: D1Database): Promise<number | null> {
  const row = await db.prepare(`
    SELECT id FROM seasons WHERE status != 'complete' ORDER BY id DESC LIMIT 1
  `).first<{ id: number }>();
  return row?.id ?? null;
}

/** Get the current week (highest week with at least one 'complete' game,
 *  or week 1 if no games played yet). */
export async function getCurrentWeek(db: D1Database, seasonId: number): Promise<number> {
  const row = await db.prepare(`
    SELECT MAX(week) AS w FROM scheduled_games
    WHERE season_id = ? AND status = 'complete'
  `).bind(seasonId).first<{ w: number | null }>();
  return row?.w ?? 1;
}

/** Get a game result (box score) by game id. */
export async function getGameResult(db: D1Database, gameId: number): Promise<ResultRow | null> {
  return db.prepare(`
    SELECT * FROM game_results WHERE game_id = ?
  `).bind(gameId).first<ResultRow>();
}

/** Get all players for a team. */
export async function getTeamPlayers(db: D1Database, teamId: number): Promise<PlayerRow[]> {
  const { results } = await db.prepare(`
    SELECT * FROM players WHERE team_id = ? ORDER BY is_goalie, ov DESC
  `).bind(teamId).all<PlayerRow>();
  return results;
}

/** Get current lines for a team. */
export async function getTeamLines(db: D1Database, teamId: number): Promise<TeamLinesRow | null> {
  return db.prepare(`
    SELECT * FROM team_lines WHERE team_id = ?
  `).bind(teamId).first<TeamLinesRow>();
}

/** Scoring leaders: top N skaters by points this season. */
export async function getScoringLeaders(db: D1Database, seasonId: number, limit = 30) {
  const { results } = await db.prepare(`
    SELECT
      p.id, p.name, p.position, t.name AS team_name,
      COUNT(DISTINCT sgs.game_id) AS gp,
      SUM(sgs.g)  AS g,
      SUM(sgs.a)  AS a,
      SUM(sgs.g + sgs.a) AS pts,
      SUM(sgs.plus_minus) AS plus_minus,
      SUM(sgs.pim) AS pim,
      SUM(sgs.sog) AS sog
    FROM skater_game_stats sgs
    JOIN players p ON p.id = sgs.player_id
    JOIN teams   t ON t.id = sgs.team_id
    JOIN scheduled_games sg ON sg.id = sgs.game_id AND sg.season_id = ?
    WHERE p.is_goalie = 0
    GROUP BY p.id, p.name, p.position, t.name
    ORDER BY pts DESC, g DESC
    LIMIT ?
  `).bind(seasonId, limit).all();
  return results;
}

/** All weeks that have at least one completed game. */
export async function getPlayedWeeks(db: D1Database, seasonId: number): Promise<number[]> {
  const { results } = await db.prepare(`
    SELECT DISTINCT week FROM scheduled_games
    WHERE season_id = ? AND status = 'complete'
    ORDER BY week
  `).bind(seasonId).all<{ week: number }>();
  return results.map(r => r.week);
}

/** Games for a week, with results joined where available. */
export interface WeekResultRow {
  id: number;
  week: number;
  home_name: string;
  away_name: string;
  status: string;
  home_goals: number | null;
  away_goals: number | null;
  final_label: string | null;
  home_sog: number | null;
  away_sog: number | null;
}

export async function getWeekResults(
  db: D1Database,
  seasonId: number,
  week: number,
): Promise<WeekResultRow[]> {
  const { results } = await db.prepare(`
    SELECT
      sg.id, sg.week,
      h.name AS home_name, a.name AS away_name,
      sg.status,
      r.home_goals, r.away_goals, r.final_label,
      r.home_sog, r.away_sog
    FROM scheduled_games sg
    JOIN teams h ON h.id = sg.home_team_id
    JOIN teams a ON a.id = sg.away_team_id
    LEFT JOIN game_results r ON r.game_id = sg.id
    WHERE sg.season_id = ? AND sg.week = ?
    ORDER BY sg.id
  `).bind(seasonId, week).all<WeekResultRow>();
  return results;
}

/** Single game with team names + result (for box score page). */
export interface GameDetailRow {
  id: number;
  week: number;
  home_team_id: number;
  away_team_id: number;
  home_name: string;
  away_name: string;
  status: string;
  home_goals: number | null;
  away_goals: number | null;
  final_label: string | null;
  home_sog: number | null;
  away_sog: number | null;
  box_score_json: string | null;
  sim_seed: number | null;
  simulated_at: string | null;
}

export async function getGameDetail(
  db: D1Database,
  gameId: number,
): Promise<GameDetailRow | null> {
  return db.prepare(`
    SELECT
      sg.id, sg.week, sg.home_team_id, sg.away_team_id,
      h.name AS home_name, a.name AS away_name,
      sg.status,
      r.home_goals, r.away_goals, r.final_label,
      r.home_sog, r.away_sog, r.box_score_json,
      r.sim_seed, r.simulated_at
    FROM scheduled_games sg
    JOIN teams h ON h.id = sg.home_team_id
    JOIN teams a ON a.id = sg.away_team_id
    LEFT JOIN game_results r ON r.game_id = sg.id
    WHERE sg.id = ?
  `).bind(gameId).first<GameDetailRow>();
}

/** Toggle scratch status for a player (must belong to teamId). */
export async function updateScratch(
  db: D1Database,
  playerId: number,
  teamId: number,
  scratch: boolean,
): Promise<void> {
  await db.prepare(`
    UPDATE players SET is_scratch = ? WHERE id = ? AND team_id = ?
  `).bind(scratch ? 1 : 0, playerId, teamId).run();
}

/** Upsert team lines config. */
export async function updateTeamLines(
  db: D1Database,
  teamId: number,
  useComputer: boolean,
  linesJson: string | null,
): Promise<void> {
  await db.prepare(`
    INSERT INTO team_lines (team_id, use_computer_lines, lines_json, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(team_id) DO UPDATE SET
      use_computer_lines = excluded.use_computer_lines,
      lines_json         = excluded.lines_json,
      updated_at         = excluded.updated_at
  `).bind(teamId, useComputer ? 1 : 0, linesJson).run();
}

/** Goalie leaders: top N goalies by SV%, minimum 10 GP. */
export async function getGoalieLeaders(db: D1Database, seasonId: number, limit = 20) {
  const { results } = await db.prepare(`
    SELECT
      p.id, p.name, t.name AS team_name,
      COUNT(DISTINCT ggs.game_id) AS gp,
      SUM(CASE WHEN ggs.decision = 'W'  THEN 1 ELSE 0 END) AS w,
      SUM(CASE WHEN ggs.decision = 'L'  THEN 1 ELSE 0 END) AS l,
      SUM(CASE WHEN ggs.decision = 'OT' THEN 1 ELSE 0 END) AS otl,
      SUM(ggs.goals_against)  AS ga,
      SUM(ggs.shots_against)  AS sa,
      ROUND(
        CAST(SUM(ggs.shots_against) - SUM(ggs.goals_against) AS REAL) /
        NULLIF(SUM(ggs.shots_against), 0),
        4
      ) AS sv_pct,
      ROUND(CAST(SUM(ggs.goals_against) AS REAL) / NULLIF(COUNT(DISTINCT ggs.game_id), 0), 2) AS gaa,
      SUM(CASE WHEN ggs.goals_against = 0 AND ggs.shots_against > 0 THEN 1 ELSE 0 END) AS so
    FROM goalie_game_stats ggs
    JOIN players p ON p.id = ggs.player_id
    JOIN teams   t ON t.id = ggs.team_id
    JOIN scheduled_games sg ON sg.id = ggs.game_id AND sg.season_id = ?
    WHERE p.is_goalie = 1
    GROUP BY p.id, p.name, t.name
    HAVING gp >= 10
    ORDER BY sv_pct DESC
    LIMIT ?
  `).bind(seasonId, limit).all();
  return results;
}
