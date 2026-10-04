import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { Goal } from "../../shared/types";
import { useData } from "./data";
import { addDays } from "./util";
import { useFavorites } from "./favorites";

export type Range = "today" | "yesterday" | "week" | "month" | "season" | "custom";
export const RANGES: { id: Range; label: string }[] = [
  { id: "today", label: "Latest day" }, { id: "yesterday", label: "Day before" },
  { id: "week", label: "7 days" }, { id: "month", label: "30 days" }, { id: "season", label: "Season" },
];

export function rangeBounds(range: Range, anchor: string, from?: string, to?: string): [string, string] {
  switch (range) {
    case "today": return [anchor, anchor];
    case "yesterday": return [addDays(anchor, -1), addDays(anchor, -1)];
    case "week": return [addDays(anchor, -6), anchor];
    case "month": return [addDays(anchor, -29), anchor];
    case "custom": return [from ?? "0000", to ?? "9999"];
    default: return ["0000", "9999"];
  }
}

export interface GoalFilter {
  range: Range; from?: string; to?: string;
  nat: string[]; natRole: "scorer" | "assist" | "either"; team: string[]; against: string[]; player?: number; q: string;
  strength: string[]; tags: string[]; period: string[]; mine: boolean; sort: string; type: string;
}

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

/** All goal filters live in the URL, so every view is shareable/bookmarkable. */
export function useGoalFilter(defaults: Partial<GoalFilter> = {}) {
  const [sp, setSp] = useSearchParams();
  const f: GoalFilter = {
    range: (sp.get("range") as Range) ?? defaults.range ?? "week",
    from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined,
    nat: sp.has("nat") ? list(sp.get("nat")) : defaults.nat ?? [],
    natRole: sp.get("by") === "assist" ? "assist" : sp.get("by") === "either" ? "either" : sp.get("by") === "scorer" ? "scorer" : defaults.natRole ?? "scorer",
    team: list(sp.get("team")), against: list(sp.get("against")),
    player: sp.get("player") ? Number(sp.get("player")) : defaults.player,
    q: sp.get("q") ?? "", strength: list(sp.get("str")), tags: list(sp.get("tag")), period: list(sp.get("per")),
    mine: sp.get("mine") === "1", sort: sp.get("sort") ?? defaults.sort ?? "new", type: sp.get("type") ?? "",
  };
  const set = (patch: Partial<GoalFilter>) => {
    const next = new URLSearchParams(sp);
    const put = (k: string, v: string | undefined) => (v ? next.set(k, v) : next.delete(k));
    const m = { ...f, ...patch };
    put("range", m.range === (defaults.range ?? "week") ? undefined : m.range);
    put("from", m.range === "custom" ? m.from : undefined); put("to", m.range === "custom" ? m.to : undefined);
    if (patch.nat) next.set("nat", m.nat.join(",")); // keep explicit empty to override defaults
    put("team", m.team.join(",")); put("against", m.against.join(","));
    put("player", m.player ? String(m.player) : undefined); put("q", m.q);
    put("str", m.strength.join(",")); put("tag", m.tags.join(",")); put("per", m.period.join(","));
    put("by", m.natRole === (defaults.natRole ?? "scorer") ? undefined : m.natRole);
    put("mine", m.mine ? "1" : undefined); put("sort", m.sort === (defaults.sort ?? "new") ? undefined : m.sort);
    put("type", m.type);
    setSp(next, { replace: true });
  };
  return [f, set] as const;
}

export function useFilteredGoals(f: GoalFilter): Goal[] {
  const { goals, players, anchor } = useData();
  const { teams: favs } = useFavorites();
  return useMemo(() => {
    const [a, b] = rangeBounds(f.range, anchor, f.from, f.to);
    const q = f.q.trim().toLowerCase();
    const out = goals.filter((g) => {
      if (g.date < a || g.date > b) return false;
      if (f.type && String(g.gameId).slice(4, 6) !== f.type) return false;
      if (f.nat.length) {
        const has = (id: number) => f.nat.includes(players[id]?.nat ?? "?");
        const scored = has(g.scorer.id), assisted = g.assists.some((a) => has(a.id));
        if (!(f.natRole === "scorer" ? scored : f.natRole === "assist" ? assisted : scored || assisted)) return false;
      }
      if (f.team.length && !f.team.includes(g.team)) return false;
      if (f.against.length && !f.against.includes(g.against)) return false;
      if (f.player && g.scorer.id !== f.player && !g.assists.some((x) => x.id === f.player)) return false;
      if (f.mine && favs.length && !favs.includes(g.team) && !favs.includes(g.against)) return false;
      if (f.strength.length && !f.strength.includes(g.strength)) return false;
      if (f.period.length && !f.period.includes(g.periodType === "OT" ? "OT" : String(g.period))) return false;
      if (f.tags.length && !f.tags.every((t) => g.tags.includes(t))) return false;
      if (q && !(g.scorer.name.toLowerCase().includes(q) || g.assists.some((x) => x.name.toLowerCase().includes(q)) || (g.goalie?.name.toLowerCase().includes(q)))) return false;
      return true;
    });
    const key = (g: Goal) => `${g.date}${String(g.gameId)}${String(g.period).padStart(2, "0")}${g.time.padStart(5, "0")}`;
    switch (f.sort) {
      case "old": return out.sort((x, y) => key(x).localeCompare(key(y)));
      case "dist": return out.sort((x, y) => (y.distance ?? 0) - (x.distance ?? 0));
      case "close": return out.sort((x, y) => (x.distance ?? 999) - (y.distance ?? 999));
      default: return out.sort((x, y) => key(y).localeCompare(key(x)));
    }
  }, [goals, players, f, favs, anchor]);
}
