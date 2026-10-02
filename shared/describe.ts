// Turns raw play-by-play goal data into readable text ("McDavid scores from the slot ...").
// Positions are heuristics: the API only gives x/y in feet, not a named location.
import type { Strength } from "./types.js";

export const NET_X = 89;

export interface Position { x: number; y: number }

/** Normalise so that the net the shooter attacks is at +x. */
export function normalise(
  x: number, y: number, ownerIsHome: boolean, homeDefending: "left" | "right" | undefined,
): Position {
  if (!homeDefending) return { x, y };
  const homeAttacksRight = homeDefending === "left";
  const attacksRight = ownerIsHome ? homeAttacksRight : !homeAttacksRight;
  return attacksRight ? { x, y } : { x: -x, y: -y };
}

export function distanceToNet(p: Position): number {
  return Math.hypot(NET_X - p.x, p.y);
}

/** Shooter faces +x, so +y is on their left. */
export function describeLocation(p: Position, emptyNet: boolean): string {
  const dx = NET_X - p.x;
  const ay = Math.abs(p.y);
  const side = p.y > 0 ? "left" : "right";
  const dist = Math.hypot(dx, p.y);

  if (p.x < -25) return emptyNet ? "his own end" : "the defensive zone";
  if (p.x < 25) return emptyNet ? "the neutral zone" : "the neutral zone";
  if (p.x > NET_X + 1) return "behind the net";
  if (dist <= 6) return "the crease";
  if (dist <= 14 && ay <= 10) return "right in front";
  if (ay >= 17 && dist <= 24) return `a sharp angle on the ${side} side`;
  if (dist <= 22 && ay <= 12) return "the low slot";
  if (dist <= 32 && ay <= 15) return "the slot";
  if (dist <= 42 && ay <= 15) return "the high slot";
  if (dist > 42 && ay <= 22) return "the point";
  if (ay <= 32 && dist <= 42) return `the ${side} circle`;
  if (ay > 30 && dist > 35) return `the ${side} half wall`;
  return `the ${side} wing`;
}

export function shotPhrase(shotType?: string): string {
  switch (shotType) {
    case "wrist": return "with a wrist shot";
    case "snap": return "with a snap shot";
    case "slap": return "with a slap shot";
    case "backhand": return "with a backhand";
    case "tip-in": return "on a tip-in";
    case "deflected": return "on a deflection";
    case "wrap-around": return "on a wraparound";
    case "poke": return "on a poke";
    case "bat": return "batting it in";
    case "between-legs": return "through the legs";
    case "cradle": return "with a lacrosse-style move";
    default: return "";
  }
}

/** situationCode = awayGoalie, awaySkaters, homeSkaters, homeGoalie */
export function parseSituation(code: string | undefined, scorerIsHome: boolean) {
  if (!code || code.length !== 4) {
    return { strength: "EV" as Strength, skaters: "5v5", emptyNet: false };
  }
  const [ag, as, hs, hg] = code.split("").map(Number);
  const own = scorerIsHome ? hs : as;
  const opp = scorerIsHome ? as : hs;
  // Goalie pulled by the team being scored on => empty net goal.
  const oppGoalie = scorerIsHome ? ag : hg;
  const emptyNet = oppGoalie === 0;
  // The extra attacker replacing a pulled goalie is not a man advantage.
  const oppEffective = emptyNet ? opp - 1 : opp;
  let strength: Strength = "EV";
  if (own > oppEffective) strength = "PP";
  else if (own < oppEffective) strength = "SH";
  return { strength, skaters: `${own}v${opp}`, emptyNet };
}

export interface DescribeInput {
  scorerLast: string;
  scorerFull: string;
  assistLasts: string[];
  goalieLast?: string;
  teamName: string;     // "Oilers"
  opponentName: string;
  strength: Strength;
  skaters: string;
  emptyNet: boolean;
  penaltyShot: boolean;
  ownGoal: boolean;
  shotType?: string;
  location?: string;
  distance?: number;
  period: number;
  periodType: "REG" | "OT";
  time: string;
  scoreFor: number;     // scoring team score after goal
  scoreAgainst: number;
  gameGoal: number;
  seasonGoal?: number;
  isGwg: boolean;
  gameFinalTeamWon: boolean;
  isFirstOfGame: boolean;
}

export function describeGoal(g: DescribeInput): { text: string; tags: string[] } {
  const tags: string[] = [];
  let head: string;
  const shot = shotPhrase(g.shotType);

  if (g.ownGoal) {
    head = `${g.scorerLast} puts it in his own net`;
    tags.push("owngoal");
  } else if (g.penaltyShot) {
    head = `${g.scorerLast} scores on the penalty shot`;
    if (shot) head += ` ${shot}`;
    tags.push("penaltyshot");
  } else if (g.emptyNet) {
    head = `${g.scorerLast} scores into the empty net`;
    if (g.location && /zone|end/.test(g.location)) head += ` from ${g.location}`;
    tags.push("emptynet");
  } else {
    head = `${g.scorerLast} scores`;
    if (g.location) head += ` from ${g.location}`;
    if (shot) head += ` ${shot}`;
    if (g.goalieLast) head += ` past ${g.goalieLast}`;
  }

  if (g.strength === "PP") { head += " on the power play"; tags.push("powerplay"); }
  if (g.strength === "SH") { head += " shorthanded"; tags.push("shorthanded"); }
  if (g.strength === "EV" && g.skaters !== "5v5" && !g.emptyNet && !g.penaltyShot) tags.push("evenstrength-" + g.skaters);

  const parts = [head + "."];
  if (!g.ownGoal) {
    parts.push(g.assistLasts.length ? `Assisted by ${join(g.assistLasts)}.` : "Unassisted.");
  }

  const before = g.scoreFor - 1 - g.scoreAgainst;
  const after = g.scoreFor - g.scoreAgainst;
  const score = `${g.scoreFor}–${g.scoreAgainst}`;
  let ctx: string | undefined;
  if (g.isFirstOfGame) { ctx = `${g.teamName} open the scoring`; tags.push("opener"); }
  else if (after === 0) { ctx = `${g.teamName} tie it ${score}`; tags.push("tying"); }
  else if (before === 0) { ctx = `${g.teamName} take a ${score} lead`; tags.push("go-ahead"); }
  else if (before > 0) ctx = `${g.teamName} extend the lead to ${score}`;
  else ctx = `${g.teamName} cut it to ${g.scoreFor}–${g.scoreAgainst}`;
  parts.push(`${ctx}.`);

  if (g.periodType === "OT" && g.isGwg) { parts.push("Overtime winner!"); tags.push("otwinner"); }
  if (g.isGwg) tags.push("gwg");
  if (g.gameGoal === 3) { parts.push(`Hat trick for ${g.scorerLast}!`); tags.push("hattrick"); }
  else if (g.gameGoal === 2) { tags.push("multigoal"); }
  if (g.gameGoal >= 4) tags.push("hattrick");
  if (g.seasonGoal === 1) parts.push(`First of the season.`);
  if (g.distance !== undefined && g.distance >= 60 && !g.emptyNet) { tags.push("longrange"); }
  return { text: parts.join(" "), tags };
}

function join(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}
