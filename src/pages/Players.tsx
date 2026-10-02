import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SpoilerGate } from "../lib/spoilers";
import { useData } from "../lib/data";
import { useFilteredGoals, useGoalFilter } from "../lib/filters";
import { FilterBar } from "../components/FilterBar";
import { Face, Flag, GoalCard, TeamLogo } from "../components/ui";
import { fmtDate } from "../lib/util";

interface Row { id: number; goals: number; ppg: number; gwg: number; en: number; games: Set<number> }

export function tally(goals: ReturnType<typeof useFilteredGoals>): Row[] {
  const m = new Map<number, Row>();
  for (const g of goals) {
    const r = m.get(g.scorer.id) ?? { id: g.scorer.id, goals: 0, ppg: 0, gwg: 0, en: 0, games: new Set<number>() };
    r.goals++; r.games.add(g.gameId);
    if (g.strength === "PP") r.ppg++;
    if (g.tags.includes("gwg")) r.gwg++;
    if (g.emptyNet) r.en++;
    m.set(g.scorer.id, r);
  }
  return [...m.values()].sort((a, b) => b.goals - a.goals || b.gwg - a.gwg);
}

export function Players() {
  const { players, loading } = useData();
  const [f, set] = useGoalFilter({ range: "season" });
  const goals = useFilteredGoals(f);
  const table = useMemo(() => tally(goals), [goals]);
  const [n, setN] = useState(50);
  return (
    <section>
      <div className="row between"><h1>Goal scorers</h1><span className="muted">{table.length} players · {goals.length} goals</span></div>
      <FilterBar f={f} set={set} />
      {loading ? <div className="spinner" /> : (
        <table className="table">
          <thead><tr><th>#</th><th>Player</th><th>Team</th><th>G</th><th>PPG</th><th>GWG</th><th>EN</th></tr></thead>
          <tbody>
            {table.slice(0, n).map((r, i) => {
              const p = players[r.id];
              return (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td><Link to={`/player/${r.id}`} className="pl"><Face id={r.id} size={30} /> <Flag code={p?.nat} /> {p?.n ?? r.id}</Link></td>
                  <td>{p?.t && <TeamLogo abbrev={p.t} size={22} />}</td>
                  <td><b>{r.goals}</b></td><td>{r.ppg}</td><td>{r.gwg}</td><td>{r.en}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {n < table.length && <button className="more" onClick={() => setN(n + 50)}>Show more</button>}
    </section>
  );
}

export function PlayerPage() {
  const { id } = useParams();
  const pid = Number(id);
  const { players, goals: all, loading, manifest } = useData();
  const p = players[pid];
  const [f, set] = useGoalFilter({ range: "season" });
  const mine = useFilteredGoals({ ...f, player: undefined });
  const scored = mine.filter((g) => g.scorer.id === pid);
  const assisted = mine.filter((g) => g.assists.some((a) => a.id === pid));
  const [tab, setTab] = useState<"goals" | "assists">("goals");
  const stats = useMemo(() => {
    const count = (fn: (g: (typeof scored)[number]) => string | undefined) => {
      const m = new Map<string, number>();
      for (const g of scored) { const k = fn(g); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    return { shots: count((g) => g.shotType), zones: count((g) => g.zone), vs: count((g) => g.against) };
  }, [scored]);
  void all;
  if (loading) return <div className="spinner" />;
  const name = p?.n ?? scored[0]?.scorer.name ?? `Player ${pid}`;
  const list = tab === "goals" ? scored : assisted;
  const shown = list.slice(0, 60);
  const bar = (rows: [string, number][]) => rows.slice(0, 6).map(([k, v]) => (
    <div key={k} className="bar"><span>{k}</span><i style={{ width: `${(v / rows[0][1]) * 100}%` }} /><b>{v}</b></div>
  ));
  return (
    <section>
      <div className="profile">
        <Face id={pid} size={96} />
        <div>
          <h1>{name}</h1>
          <p className="muted"><Flag code={p?.nat} /> {p?.nat ? manifest.countries[p.nat] ?? p.nat : "Unknown"} · {p?.pos} {p?.t && <>· <TeamLogo abbrev={p.t} size={18} /> {p.t}</>}</p>
          <p><b>{scored.length}</b> goals · <b>{assisted.length}</b> assists in range · <b>{scored.filter((g) => g.strength === "PP").length}</b> PP · <b>{scored.filter((g) => g.tags.includes("gwg")).length}</b> GWG</p>
        </div>
      </div>
      <FilterBar f={{ ...f, player: undefined }} set={set} hide={["nat", "team"]} />
      {scored.length > 0 && (
        <div className="cols">
          <div><h3>Shot types</h3>{bar(stats.shots)}</div>
          <div><h3>Where from</h3>{bar(stats.zones)}</div>
          <div><h3>Against</h3>{bar(stats.vs)}</div>
        </div>
      )}
      <div className="row">
        <button className={`chip${tab === "goals" ? " on" : ""}`} onClick={() => setTab("goals")}>Goals ({scored.length})</button>
        <button className={`chip${tab === "assists" ? " on" : ""}`} onClick={() => setTab("assists")}>Assists ({assisted.length})</button>
      </div>
      {shown.length === 0 && <p className="empty">Nothing in this range.</p>}
      {shown.map((g) => <div key={g.id}><small className="muted">{fmtDate(g.date)}</small><GoalCard goal={g} /></div>)}
    </section>
  );
}
