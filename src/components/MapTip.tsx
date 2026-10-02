import { useState } from "react";
import type { Game, Goal } from "../../shared/types";
import type { Shot } from "../lib/shots";
import { fmtDate, periodLabel } from "../lib/util";

export interface Tip { key?: string; x: number; y: number; flip: boolean; head: string; lines: string[] }

const KIND = ["Saved", "Missed", "Blocked", "Goal"] as const;
const STRENGTH = ["", " · power play", " · short-handed"] as const;
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
const per = (p: number) => (p <= 3 ? `P${p}` : p === 4 ? "OT" : `${p - 3}OT`);
const against = (game: Game | undefined, team: string) =>
  game ? `${fmtDate(game.date, { day: "numeric", month: "short" })} ${game.home.abbrev === team ? "vs" : "@"} ${game.home.abbrev === team ? game.away.abbrev : game.home.abbrev}` : "";

/** Hover card for a shot dot. `withGame` adds date and opponent, which the single-game map doesn't need. */
export function shotTip(s: Shot, name: string, game?: Game, withGame = false): { head: string; lines: string[] } {
  return {
    head: name,
    lines: [
      `${KIND[s.kind]}${s.type ? ` · ${s.type} shot` : ""}`,
      `${per(s.period)} ${mmss(s.sec)}${STRENGTH[s.strength]}`,
      ...(withGame && game ? [against(game, s.team)] : []),
    ],
  };
}

export function goalTip(g: Goal, game?: Game, withGame = false): { head: string; lines: string[] } {
  return {
    head: `⚽ ${g.scorer.name}`,
    lines: [
      `Goal${g.shotType ? ` · ${g.shotType} shot` : ""}${g.distance !== undefined ? ` · ${g.distance} ft` : ""}`,
      `${periodLabel(g)} ${g.time}${STRENGTH[g.strength === "PP" ? 1 : g.strength === "SH" ? 2 : 0]}${g.emptyNet ? " · empty net" : ""}`,
      g.assists.length ? `Assists: ${g.assists.map((a) => a.name).join(", ")}` : "Unassisted",
      ...(game ? [`${game.away.abbrev} ${g.away} – ${g.home} ${game.home.abbrev}`] : []),
      ...(withGame && game ? [against(game, g.team)] : []),
      ...(g.clip && !withGame ? ["Click to watch"] : []),
    ],
  };
}

/** Put `tip-host` on the positioned element that wraps the map; `at(...)` returns a mouse handler for a dot. */
export function useMapTip() {
  const [tip, setTip] = useState<Tip>();
  const at = (t: { head: string; lines: string[] }, key?: string) => (e: React.MouseEvent<Element>) => {
    const box = e.currentTarget.closest(".tip-host")!.getBoundingClientRect();
    setTip({ key, x: e.clientX - box.left, y: e.clientY - box.top, flip: e.clientX - box.left > box.width * 0.55, ...t });
  };
  return { tip, at, hide: () => setTip(undefined) };
}

export function MapTip({ tip }: { tip?: Tip }) {
  if (!tip) return null;
  return <div className={`map-tip${tip.flip ? " flip" : ""}`} style={{ left: tip.x, top: tip.y }}><b>{tip.head}</b>{tip.lines.map((l, i) => <span key={i}>{l}</span>)}</div>;
}
