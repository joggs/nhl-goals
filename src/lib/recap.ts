import type { Game, Goal } from "../../shared/types";
import { periodLabel } from "./util";

const last = (n: string) => n.split(" ").slice(1).join(" ") || n;

function multi(game: Game): string[] {
  const c = new Map<number, { n: string; k: number }>();
  for (const g of game.goals) {
    const e = c.get(g.scorer.id) ?? { n: last(g.scorer.name), k: 0 };
    e.k++; c.set(g.scorer.id, e);
  }
  return [...c.values()].filter((e) => e.k >= 2).sort((a, b) => b.k - a.k)
    .map((e) => (e.k >= 3 ? `${e.n} had a hat trick` : `${e.n} scored twice`));
}

export function headline(game: Game): string {
  const { home, away } = game;
  if (!game.finished) return `${away.name} at ${home.name}`;
  const w = home.score > away.score ? home : away, l = w === home ? away : home;
  const how = game.lastPeriod === "SO" ? " in a shootout" : game.lastPeriod === "OT" ? " in overtime" : "";
  return `${w.name} beat ${l.name} ${w.score}–${l.score}${how}`;
}

export function shortRecap(game: Game): string {
  if (!game.finished) return game.goals.length ? `${game.goals.length} goals so far.` : "Not started.";
  const bits: string[] = [headline(game) + "."];
  const gwg = game.goals.find((g) => g.tags.includes("gwg"));
  if (gwg) bits.push(`${last(gwg.scorer.name)} scored the winner ${gwg.periodType === "OT" ? "in overtime" : `in the ${periodLabel(gwg)} period`} at ${gwg.time}.`);
  else if (game.lastPeriod === "SO") bits.push("Decided in the shootout.");
  const m = multi(game);
  if (m.length) bits.push(m.slice(0, 2).join(", ") + ".");
  const en = game.goals.filter((g) => g.emptyNet).length;
  if (en) bits.push(`${en} empty-net goal${en > 1 ? "s" : ""}.`);
  if (!game.goals.length) bits.push("No goals.");
  return bits.join(" ");
}

export interface PeriodBlock { label: string; goals: Goal[] }

export function byPeriod(game: Game): PeriodBlock[] {
  const map = new Map<string, PeriodBlock>();
  for (const g of game.goals) {
    const label = periodLabel(g);
    const b = map.get(label) ?? { label: label === "OT" || /OT/.test(label) ? label : `${label} period`, goals: [] };
    b.goals.push(g); map.set(label, b);
  }
  return [...map.values()];
}
