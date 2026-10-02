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
}
