import { useMemo } from "react";
import { Link } from "react-router-dom";
import { SpoilerGate } from "../lib/spoilers";
import { useData } from "../lib/data";
import { RANGES, rangeBounds, useGoalFilter } from "../lib/filters";
import { Chip, Face, Flag } from "../components/ui";

export default function Nations() {
  const { goals, players, manifest, anchor, loading } = useData();
  const [f, set] = useGoalFilter({ range: "month" });
  const rows = useMemo(() => {
    const [a, b] = rangeBounds(f.range, anchor, f.from, f.to);
    const m = new Map<string, { goals: number; scorers: Map<number, number>; games: Set<number> }>();
    for (const g of goals) {
      if (g.date < a || g.date > b) continue;
      const nat = players[g.scorer.id]?.nat ?? "?";
      const r = m.get(nat) ?? { goals: 0, scorers: new Map(), games: new Set() };
      r.goals++; r.games.add(g.gameId); r.scorers.set(g.scorer.id, (r.scorers.get(g.scorer.id) ?? 0) + 1);
      m.set(nat, r);
    }
    return [...m.entries()].map(([nat, r]) => {
      const top = [...r.scorers.entries()].sort((x, y) => y[1] - x[1])[0];
      return { nat, goals: r.goals, scorers: r.scorers.size, top };
    }).sort((x, y) => y.goals - x.goals);
  }, [goals, players, f.range, f.from, f.to, anchor]);
  const max = rows[0]?.goals ?? 1;
  const total = rows.reduce((a, r) => a + r.goals, 0);
  return (
    <section>
      <div className="row between"><h1>Goals by nationality</h1><span className="muted">{total} goals</span></div>
      <div className="row">{RANGES.map((r) => <Chip key={r.id} active={f.range === r.id} onClick={() => set({ range: r.id })}>{r.label}</Chip>)}</div>
      {loading ? <div className="spinner" /> : (
        <div className="nations">
          {rows.map((r) => (
            <Link key={r.nat} to={`/goals?nat=${r.nat}&range=${f.range}${f.range === "custom" ? `&from=${f.from}&to=${f.to}` : ""}`} className="nation">
              <span className="big-flag"><Flag code={r.nat === "?" ? undefined : r.nat} /></span>
              <div className="nation-main">
                <b>{manifest.countries[r.nat] ?? (r.nat === "?" ? "Unknown" : r.nat)}</b>
                <div className="meter"><i style={{ width: `${(r.goals / max) * 100}%` }} /></div>
                <small>{r.scorers} scorers · {((r.goals / total) * 100).toFixed(1)}%</small>
              </div>
              <div className="nation-top">{r.top && <><Face id={r.top[0]} size={32} /><small>{players[r.top[0]]?.n} ({r.top[1]})</small></>}</div>
              <span className="nation-goals">{r.goals}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
