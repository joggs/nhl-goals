import { useCallback, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SpoilerGate } from "../lib/spoilers";
import { useData } from "../lib/data";
import { rangeBounds, useFilteredGoals, useGoalFilter } from "../lib/filters";
import { FilterBar } from "../components/FilterBar";
import { Face, Flag, GoalCard, TeamLogo } from "../components/ui";
import { ShotMap } from "../components/ShotMap";
import { fmtDate } from "../lib/util";

interface Row { id: number; points: number; goals: number; assists: number; ppg: number; shg: number; gwg: number; hat: number; en: number }
type SortKey = "points" | "goals" | "assists" | "ppg" | "shg" | "gwg" | "hat" | "en";

const COLUMNS: { key: SortKey; label: string; title: string }[] = [
  { key: "points", label: "P", title: "Points (goals + assists)" },
  { key: "goals", label: "G", title: "Goals" },
  { key: "assists", label: "A", title: "Assists" },
  { key: "ppg", label: "PPG", title: "Power-play goals" },
  { key: "shg", label: "SHG", title: "Short-handed goals" },
  { key: "gwg", label: "GWG", title: "Game-winning goals" },
  { key: "hat", label: "HAT", title: "Hat tricks" },
  { key: "en", label: "EN", title: "Empty-net goals" },
];

export function tally(goals: ReturnType<typeof useFilteredGoals>): Row[] {
  const m = new Map<number, Row>();
  const row = (id: number) => {
    let r = m.get(id);
    if (!r) { r = { id, points: 0, goals: 0, assists: 0, ppg: 0, shg: 0, gwg: 0, hat: 0, en: 0 }; m.set(id, r); }
    return r;
  };
  for (const g of goals) {
    const r = row(g.scorer.id);
    r.goals++; r.points++;
    if (g.strength === "PP") r.ppg++;
    if (g.strength === "SH") r.shg++;
    if (g.tags.includes("gwg")) r.gwg++;
    if (g.tags.includes("hattrick")) r.hat++;
    if (g.emptyNet) r.en++;
    for (const a of g.assists) { const ar = row(a.id); ar.assists++; ar.points++; }
  }
  return [...m.values()];
}

export function Players() {
  const { players, loading } = useData();
  const [f, set] = useGoalFilter({ range: "season" });
  // Nationality and name search select players, not goals: filtering goals by scorer would cut assists off.
  const goals = useFilteredGoals({ ...f, nat: [], q: "" });
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "points", dir: -1 });
  const [n, setN] = useState(50);
  const rows = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return tally(goals).filter((r) => {
      const p = players[r.id];
      if (f.nat.length && !f.nat.includes(p?.nat ?? "?")) return false;
      return !q || (p?.n ?? "").toLowerCase().includes(q);
    });
  }, [goals, players, f.nat, f.q]);
  const table = useMemo(() => {
    const { key, dir } = sort;
    return [...rows].sort((a, b) => dir * (a[key] - b[key]) || b.points - a.points || b.goals - a.goals || (players[a.id]?.n ?? "").localeCompare(players[b.id]?.n ?? ""));
  }, [rows, sort, players]);
  const leaders = (key: SortKey) => [...rows].sort((a, b) => b[key] - a[key] || b.points - a.points || b.goals - a.goals).filter((r) => r[key] > 0).slice(0, 5);
  const click = (key: SortKey) => { setSort((s) => (s.key === key ? { key, dir: (-s.dir) as 1 | -1 } : { key, dir: -1 })); setN(50); };
  return (
    <section>
      <div className="row between"><h1>Scoring leaders</h1><span className="muted">{rows.length} players · {goals.length} goals</span></div>
      <FilterBar f={f} set={set} hide={["natrole"]} />
      {loading ? <div className="spinner" /> : (
        <>
          <div className="cols">
            {([["points", "Points"], ["goals", "Goals"], ["assists", "Assists"]] as const).map(([key, title]) => (
              <div key={key}>
                <h3>{title}</h3>
                {leaders(key).map((r, i) => {
                  const p = players[r.id];
                  return (
                    <Link key={r.id} to={`/player/${r.id}`} className="leader">
                      <span className="rank">{i + 1}</span><Face id={r.id} size={28} />
                      <span className="leader-name"><Flag code={p?.nat} /> {p?.n ?? r.id}</span>
                      {p?.t && <TeamLogo abbrev={p.t} size={18} />}
                      <b>{r[key]}</b>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
          <table className="table sortable">
            <thead>
              <tr>
                <th>#</th><th>Player</th><th>Team</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} title={c.title} aria-sort={sort.key === c.key ? (sort.dir === -1 ? "descending" : "ascending") : "none"}>
                    <button className={`th-sort${sort.key === c.key ? " on" : ""}`} onClick={() => click(c.key)}>
                      {c.label}{sort.key === c.key && <span aria-hidden="true">{sort.dir === -1 ? " ▼" : " ▲"}</span>}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.slice(0, n).map((r, i) => {
                const p = players[r.id];
                return (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td><Link to={`/player/${r.id}`} className="pl"><Face id={r.id} size={30} /> <Flag code={p?.nat} /> {p?.n ?? r.id}</Link></td>
                    <td>{p?.t && <TeamLogo abbrev={p.t} size={22} />}</td>
                    {COLUMNS.map((c) => <td key={c.key}>{c.key === sort.key || c.key === "points" ? <b>{r[c.key]}</b> : r[c.key]}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
      {n < table.length && <button className="more" onClick={() => setN(n + 50)}>Show more</button>}
    </section>
  );
}

export function PlayerPage() {
  const { id } = useParams();
  const pid = Number(id);
  const { players, goals: all, loading, manifest, gameById, anchor } = useData();
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
  const pick = useCallback((sh: { player: number; game: number }) => {
    if (sh.player !== pid) return false;
    const [a, b] = rangeBounds(f.range, anchor, f.from, f.to);
    const d = gameById.get(sh.game)?.date;
    return !!d && d >= a && d <= b;
  }, [pid, f.range, f.from, f.to, anchor, gameById]);
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
          <div><h3>Goal map</h3><ShotMap goals={scored} pick={pick} /></div>
        </div>
      )}
      <div className="row">
        <button className={`chip${tab === "goals" ? " on" : ""}`} onClick={() => setTab("goals")}>Goals ({scored.length})</button>
        <button className={`chip${tab === "assists" ? " on" : ""}`} onClick={() => setTab("assists")}>Assists ({assisted.length})</button>
      </div>
      {shown.length === 0 && <p className="empty">Nothing in this range.</p>}
      {shown.map((g) => <div key={g.id}><small className="muted">{fmtDate(g.date)}</small><GoalCard goal={g} minimap /></div>)}
    </section>
  );
}
