import type { Game, Goal } from "../../shared/types";

export const ordinal = (n: number) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);
export const periodLabel = (g: Pick<Goal, "period" | "periodType">) =>
  g.periodType === "OT" ? (g.period > 4 ? `${g.period - 3}OT` : "OT") : ordinal(g.period);
export const logo = (abbrev: string) => `https://assets.nhle.com/logos/nhl/svg/${abbrev}_light.svg`;
export const headshot = (path?: string) => (path ? `https://assets.nhle.com/mugs/nhl/${path}` : undefined);

export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function gameStatus(g: Game): string {
  if (g.finished) return g.periodsLabel ? `Final/${g.periodsLabel}` : "Final";
  if (g.state === "LIVE" || g.state === "CRIT") return "Live";
  return fmtTime(g.start);
}

export const surname = (full: string) => full.split(" ").slice(1).join(" ") || full;
export const winner = (g: Game) => (!g.finished ? undefined : g.home.score > g.away.score ? g.home : g.away);
