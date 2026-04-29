// ── Core domain types ────────────────────────────────────────────────────────
//
// We mirror the shape of the existing rwha-stats-site `data.js` for inputs,
// then expose a clean, typed surface (`Skater`, `Goalie`, `Team`) for the rest
// of the engine.
//
// Source schema (from RWHA_DATA[teamName]):
//   ps: pro skaters    pg: pro goalies
//   fs: farm skaters   fg: farm goalies
//
// Skater attribute keys:
//   ck fg di sk st en du ph fo pa sc df ps ex ld po mo ov
// Goalie attribute keys:
//   sk du en sz ag rb sc hs rt ph ps ex ld po mo ov

export type Position =
  | 'C' | 'L' | 'R' | 'D' | 'G'
  | 'C/L' | 'C/R' | 'L/R' | 'C/L/R' | 'L/D' | 'R/D';

// ── Raw shapes (strings, exactly as they appear in data.js) ──────────────────
export interface RawSkater {
  n?: string;          // jersey number (sometimes blank)
  nm: string;          // name (may include "(R)" / "(C)" tags)
  p: Position;         // position
  con: string;         // condition (100 = healthy)
  ij: string;          // injury status (empty string when healthy)
  // STHS skater attributes
  ck: string; fg: string; di: string; sk: string; st: string;
  en: string; du: string; ph: string; fo: string; pa: string;
  sc: string; df: string; ps: string; ex: string; ld: string;
  po: string; mo: string;
  ov: string;          // overall
  ta: string;          // trade asset?
  sp: string;          // suspension?
  age: string;
  c: string;           // contract years remaining
  sal: string;         // formatted salary, e.g. "$12,600,000"
}

export interface RawGoalie {
  nm: string;
  p: 'G';
  con: string;
  ij: string;
  // STHS goalie attributes
  sk: string; du: string; en: string; sz: string; ag: string;
  rb: string; sc: string; hs: string; rt: string; ph: string;
  ps: string; ex: string; ld: string; po: string; mo: string;
  ov: string;
  ta: string;
  sp: string;
  age: string;
  c: string;
  sal: string;
}

export interface RawTeam {
  n: string;           // team name
  gm: string;          // GM name
  fn: string;          // farm team name
  pm: string;          // pro morale
  po: string;          // pro overall
  fm: string;          // farm morale
  fo: string;          // farm overall
  ps: RawSkater[];     // pro skaters
  pg: RawGoalie[];     // pro goalies
  fs: RawSkater[];     // farm skaters
  fg: RawGoalie[];     // farm goalies
}

export interface RawData {
  [teamName: string]: RawTeam;
}

// ── Parsed shapes (typed numbers, used by the sim engine) ────────────────────
export interface SkaterAttrs {
  ck: number; fg: number; di: number; sk: number; st: number;
  en: number; du: number; ph: number; fo: number; pa: number;
  sc: number; df: number; ps: number; ex: number; ld: number;
  po: number; mo: number;
}

export interface GoalieAttrs {
  sk: number; du: number; en: number; sz: number; ag: number;
  rb: number; sc: number; hs: number; rt: number; ph: number;
  ps: number; ex: number; ld: number; po: number; mo: number;
}

export interface Skater {
  name: string;
  position: Position;
  jersey: number | null;
  ov: number;
  age: number;
  contractYears: number;
  salary: number;             // dollars (parsed)
  injured: boolean;
  attrs: SkaterAttrs;
}

export interface Goalie {
  name: string;
  ov: number;
  age: number;
  contractYears: number;
  salary: number;
  injured: boolean;
  attrs: GoalieAttrs;
}

export interface Team {
  name: string;
  gm: string;
  farmName: string;
  proOverall: number;
  proMorale: number;
  farmOverall: number;
  farmMorale: number;
  proSkaters: Skater[];
  proGoalies: Goalie[];
  farmSkaters: Skater[];
  farmGoalies: Goalie[];
}

export interface League {
  teams: Map<string, Team>;
}

// ── Lines ────────────────────────────────────────────────────────────────────
// A team's set lines for a game. In Phase 1 we generate these automatically
// from roster OV / position; later, GMs will override via the webapp.
export interface ForwardLine {
  lw: Skater;
  c: Skater;
  rw: Skater;
}

export interface DefensePair {
  ld: Skater;
  rd: Skater;
}

export interface Lines {
  forwards: [ForwardLine, ForwardLine, ForwardLine, ForwardLine]; // L1..L4
  defense: [DefensePair, DefensePair, DefensePair];               // D1..D3
  starter: Goalie;
  backup: Goalie;
  // Default minutes per line slot. Sum to ~60 per skater pos group.
  // Phase 1 uses fixed defaults; Phase 3 lets GMs override.
  toi: {
    forwards: [number, number, number, number]; // minutes per forward line
    defense: [number, number, number];          // minutes per D pair
  };
}

// ── Box-score / game-result types ────────────────────────────────────────────
export type Strength = 'EV' | 'PP' | 'SH' | 'EN' | 'PS' | 'SO';

export interface GoalEvent {
  period: number;     // 1, 2, 3 = regulation; 4 = OT; 5 = SO (logical)
  time: string;       // "MM:SS" within the period
  team: string;       // team name
  scorer: string;
  assists: string[];  // 0-2 names
  strength: Strength;
  scorerSeasonGoals?: number; // optional flavor; "(24)" in the box score
  emptyNet?: boolean;
  gameWinner?: boolean;
}

export interface PenaltyEvent {
  period: number;
  time: string;
  team: string;
  player: string;
  infraction: string;
  minutes: number;    // 2 = minor, 5 = major, 10 = misconduct
}

export interface FightEvent {
  period: number;
  time: string;
  homePlayer: string;
  awayPlayer: string;
  outcome: 'home' | 'away' | 'draw';
}

export interface SkaterStatLine {
  name: string;
  position: Position;
  team: string;
  lineSlot: string;   // e.g. "L1", "D2"
  g: number;
  a: number;
  plusMinus: number;
  sog: number;
  hits: number;
  blocks: number;
  pim: number;
  toi: string;        // "MM:SS"
}

export interface GoalieStatLine {
  name: string;
  team: string;
  decision: 'W' | 'L' | 'OT' | '-';
  shotsAgainst: number;
  goalsAgainst: number;
  savePct: number;    // 0-1
  toi: string;        // "MM:SS"
}

export interface TeamGameTotals {
  team: string;
  goalsByPeriod: number[]; // [P1, P2, P3, OT?]
  sogByPeriod: number[];
  ppGoals: number;
  ppOpps: number;
  faceoffsWon: number;
  faceoffsTotal: number;
  hits: number;
  blocks: number;
  pim: number;
}

export interface ThreeStar {
  rank: 1 | 2 | 3;
  player: string;
  team: string;
  blurb: string;      // e.g. "2-1-3, GWG"
}

export interface BoxScore {
  gameId: number;
  week: number;
  home: TeamGameTotals;
  away: TeamGameTotals;
  finalLabel: 'FINAL' | 'FINAL / OT' | 'FINAL / SO';
  goals: GoalEvent[];
  penalties: PenaltyEvent[];
  fights: FightEvent[];
  skaters: SkaterStatLine[];
  goalies: GoalieStatLine[];
  threeStars: [ThreeStar, ThreeStar, ThreeStar];
}

// ── Schedule types ────────────────────────────────────────────────────────────
export interface ScheduledGame {
  gameId: number;
  week: number;         // 1-based week number within the season
  homeTeam: string;
  awayTeam: string;
}

// ── Season-level stat accumulation ───────────────────────────────────────────
export interface TeamSeasonRecord {
  team: string;
  gp: number;
  w: number;
  l: number;
  otl: number;           // OT loss (1 point)
  pts: number;           // W×2 + OTL×1
  gf: number;
  ga: number;
  diff: number;          // GF - GA
  streak: string;        // e.g. "W3", "L1", "OT2"
  last10: { w: number; l: number; otl: number };
}

export interface SkaterSeasonStats {
  name: string;
  team: string;
  position: string;
  gp: number;
  g: number;
  a: number;
  pts: number;
  plusMinus: number;
  pim: number;
  sog: number;
  hits: number;
  blocks: number;
  ppg: number;           // power-play goals (Phase 2: 0 until PP is modeled)
}

export interface GoalieSeasonStats {
  name: string;
  team: string;
  gp: number;
  w: number;
  l: number;
  otl: number;
  ga: number;
  sa: number;
  gaa: number;           // goals-against average
  svPct: number;
  so: number;            // shutouts
}

export interface SeasonResults {
  schedule: ScheduledGame[];
  standings: TeamSeasonRecord[];
  skaterStats: SkaterSeasonStats[];
  goalieStats: GoalieSeasonStats[];
}
