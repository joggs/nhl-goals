import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SpoilerGate } from "../lib/spoilers";
import { useData } from "../lib/data";
import { RANGES, rangeBounds, useGoalFilter } from "../lib/filters";
import { Chip, Face, Flag } from "../components/ui";

export default function Nations() {
  const { goals, players, manifest, anchor, loading } = useData();
  const [f, set] = useGoalFilter({ range: "month" });
  const navigate = useNavigate();
  const rows = useMemo(() => {
    const [a, b] = rangeBounds(f.range, anchor, f.from, f.to);
    const m = new Map<string, { n: number; people: Map<number, number> }>();
    const add = (id: number) => {
      const nat = players[id]?.nat ?? "?";
      const r = m.get(nat) ?? { n: 0, people: new Map() };
      r.n++; r.people.set(id, (r.people.get(id) ?? 0) + 1);
      m.set(nat, r);
    };
    for (const g of goals) {
      if (g.date < a || g.date > b) continue;
      if (f.natRole !== "assist") add(g.scorer.id);
      if (f.natRole !== "scorer") g.assists.forEach((x) => add(x.id));
    }
    return [...m.entries()].map(([nat, r]) => {
      const top = [...r.people.entries()].sort((x, y) => y[1] - x[1])[0];
      return { nat, goals: r.n, scorers: r.people.size, top };
    }).sort((x, y) => y.goals - x.goals);
  }, [goals, players, f.range, f.from, f.to, f.natRole, anchor]);
  const max = rows[0]?.goals ?? 1;
  const total = rows.reduce((a, r) => a + r.goals, 0);
  return (
    <section>
      <div className="row between"><h1>{f.natRole === "scorer" ? "Goals" : f.natRole === "assist" ? "Assists" : "Points"} by nationality</h1><span className="muted">{total} {f.natRole === "scorer" ? "goals" : f.natRole === "assist" ? "assists" : "points"}</span></div>
      <div className="row">
        {RANGES.map((r) => <Chip key={r.id} active={f.range === r.id} onClick={() => set({ range: r.id })}>{r.label}</Chip>)}
        <span className="sep" />
        {([["scorer", "Goals"], ["assist", "Assists"], ["either", "Points"]] as const).map(([r, l]) => <Chip key={r} active={f.natRole === r} onClick={() => set({ natRole: r })}>{l}</Chip>)}
      </div>
      {loading ? <div className="spinner" /> : (
        <div className="nations">
          {rows.map((r) => (
            <Link key={r.nat} to={`/goals?nat=${r.nat}${f.natRole === "scorer" ? "" : `&by=${f.natRole}`}&range=${f.range}${f.range === "custom" ? `&from=${f.from}&to=${f.to}` : ""}`} className="nation">
              <span className="big-flag"><Flag code={r.nat === "?" ? undefined : r.nat} /></span>
              <div className="nation-main">
                <b>{manifest.countries[r.nat] ?? (r.nat === "?" ? "Unknown" : r.nat)}</b>
                <div className="meter"><i style={{ width: `${(r.goals / max) * 100}%` }} /></div>
                <small>{r.scorers} {f.natRole === "scorer" ? "scorers" : "players"} · {((r.goals / total) * 100).toFixed(1)}%</small>
              </div>
              <div className="nation-top">{r.top && (
                <span role="link" tabIndex={0} title={players[r.top[0]]?.n}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/player/${r.top[0]}`); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); navigate(`/player/${r.top[0]}`); } }}>
                  <Face id={r.top[0]} size={32} /><small>{players[r.top[0]]?.n} ({r.top[1]})</small>
                </span>
              )}</div>
              <span className="nation-goals">{r.goals}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
