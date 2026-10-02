// Data model shared by the build pipeline and the web app.
export type Strength = "EV" | "PP" | "SH";

export interface Person { id: number; name: string }

export interface Goal {
  id: string;            // `${gameId}-${eventId}`
  gameId: number;
  date: string;          // NHL game date (ET), YYYY-MM-DD
  period: number;
  periodType: "REG" | "OT";
  time: string;          // mm:ss in period
  team: string;          // scoring team abbrev
  against: string;       // opposing team abbrev
  scorer: Person;
  assists: Person[];
  goalie?: Person;       // goalie in net (undefined = empty net)
  strength: Strength;
  skaters: string;       // e.g. "5v4"
  emptyNet: boolean;
  penaltyShot: boolean;
  ownGoal: boolean;
  shotType?: string;
  x?: number; y?: number; // normalised: attacking net is at x=+89
  distance?: number;      // feet to the net
  zone?: string;          // human location, e.g. "the slot"
  away: number; home: number; // score after the goal
  seasonGoal?: number;    // scorer's season goal number
  gameGoal: number;       // scorer's goal number in this game
  clip?: number;          // Brightcove id of the highlight
  clipUrl?: string;
  text: string;           // "McDavid scores from the slot with a wrist shot ..."
  tags: string[];         // gwg, otwinner, hattrick, shorthanded, powerplay, emptynet, penaltyshot, go-ahead, tying, ...
}

export interface TeamSide {
  abbrev: string; name: string; score: number; sog?: number;
}

export interface Star { id: number; name: string; team: string; star: number; pos?: string }

export interface Game {
  id: number;
  season: number;
  type: 2 | 3;           // regular season / playoffs
  date: string;
  start: string;         // ISO UTC
  state: string;         // FUT | LIVE | CRIT | OFF | FINAL
  finished: boolean;
  venue?: string;
  away: TeamSide;
  home: TeamSide;
  lastPeriod: "REG" | "OT" | "SO";
  otPeriods: number;
  periodsLabel?: string;
  goals: Goal[];
  stars: Star[];
  shotsByPeriod?: { period: number; away: number; home: number }[];
  recapClip?: number;     // ~5 min recap (Brightcove id)
  condensedClip?: number; // ~10 min condensed game
}

export interface PlayerInfo {
  n: string;       // name
  nat?: string;    // nationality code (ISO-3)
  pos?: string;
  t?: string;      // latest team
  h?: string;      // headshot path after /mugs/nhl/
}

export interface TeamInfo { abbrev: string; name: string; division?: string; conference?: string }

export interface Manifest {
  updated: string;
  seasons: { id: number; label: string; games: number; goals: number }[];
  currentSeason: number;
  countries: Record<string, string>; // code -> name
}

export interface StandingRow {
  abbrev: string; name: string; division: string; conference: string;
  gp: number; w: number; l: number; otl: number; pts: number; gf: number; ga: number; streak?: string;
  divRank: number;  // 1-8 within the division
  wc: number;       // wild-card position in the conference (1, 2), 0 = not in a wild-card spot
  row: number;      // regulation + overtime wins
  ptsPct: number;   // points percentage, 0-1
  l10: string;      // "W-L-OTL" over the last ten games
}

export interface PlayoffTeam { abbrev: string; name: string; seed: string; wins: number }
export interface PlayoffGame {
  id: number; num: number; start: string; // ISO UTC
  away: string; home: string; awayScore?: number; homeScore?: number;
  ot?: number;       // overtime periods played
  final: boolean; optional: boolean; // optional = only played if the series is still alive
}
export interface PlayoffSeries {
  letter: string;    // A-O, the NHL's own series letter
  round: number;     // 1-4
  title: string;
  top?: PlayoffTeam; bottom?: PlayoffTeam; // undefined until the earlier round decides it
  winner?: string;   // abbrev
  games: PlayoffGame[];
}
export interface PlayoffBracket { season: number; series: PlayoffSeries[] }

/** NHL EDGE puck/player tracking leaderboards (top 10 per board and position group). */
export type EdgePos = "all" | "F" | "D";
export type EdgeBoardId = "speed" | "shot" | "distance" | "zone";
export interface EdgeEntry {
  id: number; name: string; team: string; pos: string;
  h?: string;       // headshot path after /mugs/nhl/
  value: number;    // mph, miles or percent, depending on the board
  sub?: string;     // secondary stat, preformatted
  when?: string;    // "2026-01-31 NJD @ OTT" for single-game records
}
export interface EdgeStat { value: number; rank: number; avg?: number }
export type EdgeTeamMetric = "shotSpeed" | "burst22" | "speed" | "distance" | "zoneOff" | "zoneDef" | "shots" | "shootPct";
export type EdgeTeam = Record<EdgeTeamMetric, EdgeStat>;
export interface EdgeData { season: number; boards: Record<EdgeBoardId, Record<EdgePos, EdgeEntry[]>>; teams: Record<string, EdgeTeam> }

/**
 * Every shot attempt of a season, flattened to save space. Ten numbers per shot:
 * [game index, player id, team index, x, y, kind, strength, period, seconds into period, shot type index (-1 = unknown)]
 * where x/y are normalised (attacking net at x=+89), kind is 0 saved, 1 missed, 2 blocked, 3 goal and strength is
 * 0 even, 1 power play, 2 short-handed. Period 4+ is overtime.
 */
export interface ShotFile { season: number; teams: string[]; games: number[]; types: string[]; shots: number[] }
