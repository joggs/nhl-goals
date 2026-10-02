import { useSyncExternalStore } from "react";
import type { Game } from "../../shared/types";

// Spoiler mode: results, scorers and goal texts stay hidden until revealed, per game.
// Default is ON; reveals are remembered in localStorage.
const MODE = "spoilerMode", REV = "spoilerRevealed", PAGES = "spoilerPages";
const readRev = (): number[] => { try { return JSON.parse(localStorage.getItem(REV) ?? "[]"); } catch { return []; } };
const snap = () => JSON.stringify({ on: localStorage.getItem(MODE) !== "0", rev: readRev(), pages: sessionStorage.getItem(PAGES) === "1" });
let cur = snap();
const subs = new Set<() => void>();
const emit = () => { cur = snap(); subs.forEach((f) => f()); };
window.addEventListener("storage", emit);

export function useSpoilers() {
  const raw = useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => cur);
  const s = JSON.parse(raw) as { on: boolean; rev: number[]; pages: boolean };
  const rev = new Set(s.rev);
  return {
    on: s.on,
    pagesOk: !s.on || s.pages,
    /** True when this game's result must be hidden. Games not yet played hide nothing. */
    hidden: (g?: Pick<Game, "id" | "state" | "finished">) =>
      s.on && !!g && (g.finished || g.state === "LIVE" || g.state === "CRIT") && !rev.has(g.id),
    setOn: (on: boolean) => { localStorage.setItem(MODE, on ? "1" : "0"); emit(); },
    reveal: (ids: number[]) => { localStorage.setItem(REV, JSON.stringify([...new Set([...readRev(), ...ids])].slice(-1500))); emit(); },
    hideAgain: () => { localStorage.setItem(REV, "[]"); sessionStorage.removeItem(PAGES); emit(); },
    allowPages: () => { sessionStorage.setItem(PAGES, "1"); emit(); },
  };
}

/** Wraps aggregate pages (stats, nations, highlights) that leak results by their very numbers. */
export function SpoilerGate({ children }: { children: React.ReactNode }) {
  const sp = useSpoilers();
  if (sp.pagesOk) return <>{children}</>;
  return (
    <div className="gate">
      <div className="gate-icon">🙈</div>
      <h2>Spoiler mode is on</h2>
      <p className="muted">This page is built from scores and goals, so it reveals results across all games.</p>
      <button className="chip on" onClick={sp.allowPages}>Show anyway</button>
    </div>
  );
}
