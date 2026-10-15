import { useCallback, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { SpoilerGate } from "../lib/spoilers";
import { useData } from "../lib/data";
import { rangeBounds, useFilteredGoals, useGoalFilter } from "../lib/filters";
import { InjuryBadge } from "../components/InjuryNews";
import { FilterBar } from "../components/FilterBar";
import { Chip, Face, Flag, GoalCard, PlaylistModal, TeamLogo, Watermark } from "../components/ui";
import { NewsRow } from "../components/NewsList";
import { usePlayerNews, useSeasonStats } from "../lib/player";
import { ShotMap } from "../components/ShotMap";
import { fmtDate, shortName, signed } from "../lib/util";

interface Row { id: number; points: number; goals: number; assists: number; ppg: number; shg: number; gwg: number; hat: number; en: number; pm: number }
type SortKey = "points" | "goals" | "assists" | "ppg" | "shg" | "gwg" | "hat" | "en" | "pm";

const COLUMNS: { key: SortKey; label: string; title: string }[] = [
  { key: "points", label: "P", title: "Points (goals + assists)" },
  { key: "goals", label: "G", title: "Goals" },
  { key: "assists", label: "A", title: "Assists" },
  { key: "ppg", label: "PPG", title: "Power-play goals" },
  { key: "shg", label: "SHG", title: "Short-handed goals" },
  { key: "gwg", label: "GWG", title: "Game-winning goals" },
  { key: "hat", label: "HAT", title: "Hat tricks" },
  { key: "en", label: "EN", title: "Empty-net goals" },
  { key: "pm", label: "+/-", title: "Plus/minus over the whole regular season (NHL stats): not affected by the date filters" },
];

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

export function tally(goals: ReturnType<typeof useFilteredGoals>): Row[] {
  const m = new Map<number, Row>();
  const row = (id: number) => {
    let r = m.get(id);
    if (!r) { r = { id, points: 0, goals: 0, assists: 0, ppg: 0, shg: 0, gwg: 0, hat: 0, en: 0, pm: 0 }; m.set(id, r); }
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

const POS_GROUPS: { id: string; label: string; codes: string[] }[] = [
  { id: "", label: "All skaters", codes: [] }, { id: "F", label: "Forwards", codes: ["C", "L", "R"] },
  { id: "C", label: "Centres", codes: ["C"] }, { id: "W", label: "Wingers", codes: ["L", "R"] }, { id: "D", label: "Defencemen", codes: ["D"] },
];

export function Players() {
  const { players, loading, season } = useData();
  const [f, set] = useGoalFilter({ range: "season" });
  // Position and rookie filters live in the URL next to the goal filters.
  const [sp, setSp] = useSearchParams();
  const pos = POS_GROUPS.find((g) => g.id === sp.get("pos")) ?? POS_GROUPS[0];
  const rookie = sp.get("rookie") === "1";
  const setParam = (k: string, v?: string) => { const q = new URLSearchParams(sp); if (v) q.set(k, v); else q.delete(k); setSp(q, { replace: true }); };
  const st = useSeasonStats(season);
  const rookies = useMemo(() => new Set(st?.rs?.rookies ?? []), [st]);
  // Nationality and name search select players, not goals: filtering goals by scorer would cut assists off.
  const goals = useFilteredGoals({ ...f, nat: [], q: "" });
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "points", dir: -1 });
  const [n, setN] = useState(50);
  /** Nationality, name, position and rookie filters: they pick players, never goals. */
  const picks = useCallback((id: number | string) => {
    const p = players[id];
    const q = f.q.trim().toLowerCase();
    if (f.nat.length && !f.nat.includes(p?.nat ?? "?")) return false;
    if (q && !(p?.n ?? "").toLowerCase().includes(q)) return false;
    if (pos.codes.length ? !pos.codes.includes(p?.pos ?? "") : p?.pos === "G") return false;
    return !rookie || rookies.has(Number(id));
  }, [players, f.nat, f.q, pos, rookie, rookies]);
  const rows = useMemo(() => tally(goals).filter((r) => picks(r.id)).map((r) => ({ ...r, pm: st?.rs?.skaters[r.id]?.pm ?? 0 })), [goals, picks, st]);
  const table = useMemo(() => {
    const { key, dir } = sort;
    return [...rows].sort((a, b) => dir * (a[key] - b[key]) || b.points - a.points || b.goals - a.goals || (players[a.id]?.n ?? "").localeCompare(players[b.id]?.n ?? ""));
  }, [rows, sort, players]);
  const leaders = (key: SortKey) => [...rows].sort((a, b) => b[key] - a[key] || b.points - a.points || b.goals - a.goals).filter((r) => r[key] > 0).slice(0, 5);
  // Ice time and plus/minus are the NHL's own season numbers, so they ignore the date filters; the player filters still apply.
  const seasonTop = useMemo(() => {
    const sk = Object.entries(st?.rs?.skaters ?? {});
    const minGp = Math.max(1, Math.round(Math.max(0, ...sk.map(([, s]) => s.gp)) / 2));
    const eligible = sk.filter(([id, s]) => s.gp >= minGp && picks(id));
    return {
      toi: [...eligible].sort((a, b) => b[1].toi - a[1].toi).slice(0, 5).map(([id, s]) => ({ id, v: mmss(s.toi) })),
      pm: [...eligible].sort((a, b) => b[1].pm - a[1].pm || a[1].gp - b[1].gp).slice(0, 5).map(([id, s]) => ({ id, v: signed(s.pm) })),
    };
  }, [st, picks]);
  const click = (key: SortKey) => { setSort((s) => (s.key === key ? { key, dir: (-s.dir) as 1 | -1 } : { key, dir: -1 })); setN(50); };
  return (
    <section>
      <div className="row between"><h1>Scoring leaders{pos.id || rookie ? <small className="muted"> · {rookie ? "Rookie " : ""}{pos.id ? pos.label.toLowerCase() : rookie ? "skaters" : ""}</small> : null}</h1><span className="muted">{rows.length} players · {goals.length} goals</span></div>
      <div className="row">
        {POS_GROUPS.map((g) => <Chip key={g.id} active={pos.id === g.id} onClick={() => setParam("pos", g.id)}>{g.label}</Chip>)}
        <Chip active={rookie} onClick={() => setParam("rookie", rookie ? undefined : "1")} title="Players in their rookie season (NHL definition)">Rookies</Chip>
      </div>
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
                      <span className="leader-name" title={p?.n}><Flag code={p?.nat} /> {p?.n ? shortName(p.n) : r.id}</span>
                      {p?.t && <TeamLogo abbrev={p.t} size={18} />}
                      <b>{r[key]}</b>
                    </Link>
                  );
                })}
              </div>
            ))}
            {([["toi", "Ice time", "Average time on ice per game, regular season (NHL stats; at least half the games)"], ["pm", "Plus/minus", "Regular season (NHL stats; at least half the games)"]] as const).map(([key, title, tip]) => seasonTop[key].length > 0 && (
              <div key={key}>
                <h3 title={tip}>{title}</h3>
                {seasonTop[key].map(({ id, v }, i) => {
                  const p = players[id];
                  return (
                    <Link key={id} to={`/player/${id}`} className="leader">
                      <span className="rank">{i + 1}</span><Face id={Number(id)} size={28} />
                      <span className="leader-name" title={p?.n}><Flag code={p?.nat} /> {p?.n ? shortName(p.n) : id}</span>
                      {p?.t && <TeamLogo abbrev={p.t} size={18} />}
                      <b>{v}</b>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="table-scroll"><table className="table sortable">
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
                    {COLUMNS.map((c) => { const v = c.key === "pm" ? (st?.rs?.skaters[r.id] ? signed(r.pm) : "–") : r[c.key]; return <td key={c.key}>{c.key === sort.key || c.key === "points" ? <b>{v}</b> : v}</td>; })}
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </>
      )}
      {n < table.length && <button className="more" onClick={() => setN(n + 50)}>Show more</button>}
    </section>
  );
}

type Tab = "overview" | "goals" | "assists" | "shots";
const LATEST = 5;

const pct = (x: number, digits = 1) => (x * 100).toFixed(digits);

/** Official season totals, regular season and playoffs. Not affected by the filters: it is the NHL's own line. */
function SeasonLine({ pid, goalie }: { pid: number; goalie: boolean }) {
  const { season, manifest } = useData();
  const st = useSeasonStats(season);
  if (!st) return null;
  const label = manifest.seasons.find((s) => s.id === season)?.label ?? String(season);
  const rows = ([["Regular season", st.rs], ["Playoffs", st.po]] as const).map(([name, f]) => [name, goalie ? f?.goalies[pid] : f?.skaters[pid]] as const).filter(([, l]) => l);
  if (!rows.length) return null;
  const head = goalie ? ["GP", "W", "L", "OTL", "GAA", "SV%", "SO"] : ["GP", "G", "A", "P", "+/-", "PPP", "SOG", "S%", "TOI"];
  const cells = (l: any): (string | number)[] => goalie
    ? [l.gp, l.w, l.l, l.otl, l.gaa.toFixed(2), l.svp.toFixed(3).replace(/^0/, ""), l.so]
    : [l.gp, l.g, l.a, l.p, l.pm > 0 ? `+${l.pm}` : l.pm, l.ppp, l.s, l.s ? pct(l.g / l.s) : "–", mmss(l.toi)];
  const bold = goalie ? [4, 5] : [3];
  return (
    <div className="table-scroll statline">
      <table className="table">
        <thead><tr><th>{label}</th>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map(([name, l]) => (
          <tr key={name}><td>{name}</td>{cells(l).map((c, i) => <td key={i}>{bold.includes(i) ? <b>{c}</b> : c}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

/** A slice of the scoring table around the player, same order and filters as the Scoring leaders page. */
function PointsRace({ pid, goals, query }: { pid: number; goals: ReturnType<typeof useFilteredGoals>; query: string }) {
  const { players, manifest } = useData();
  const table = useMemo(() => tally(goals).sort((a, b) => b.points - a.points || b.goals - a.goals || (players[a.id]?.n ?? "").localeCompare(players[b.id]?.n ?? "")), [goals, players]);
  const i = table.findIndex((r) => r.id === pid);
  const nat = players[pid]?.nat;
  const qs = (extra?: string) => { const q = new URLSearchParams(query); q.delete("tab"); if (extra) q.set("nat", extra); const s = q.toString(); return s ? `?${s}` : ""; };
  if (i < 0) return <div><h3>Points race</h3><p className="muted">No points in this range.</p></div>;
  const from = Math.max(0, Math.min(i - 2, table.length - 5)), slice = table.slice(from, from + 5);
  const countrymen = nat ? table.filter((r) => players[r.id]?.nat === nat) : [];
  const row = (r: Row, rank: number) => {
    const p = players[r.id];
    return (
      <Link key={r.id} to={`/player/${r.id}`} className={`leader${r.id === pid ? " me" : ""}`}>
        <span className="rank">{rank}</span><Face id={r.id} size={26} />
        <span className="leader-name" title={p?.n}><Flag code={p?.nat} /> {p?.n ? shortName(p.n) : r.id}</span>
        {p?.t && <TeamLogo abbrev={p.t} size={18} />}
        <small className="muted race-ga">{r.goals}+{r.assists}</small><b>{r.points}</b>
      </Link>
    );
  };
  return (
    <div className="race">
      <h3>Points race</h3>
      {from > 0 && <>{row(table[0], 1)}<div className="race-gap" aria-hidden="true">⋯</div></>}
      {slice.map((r, k) => row(r, from + k + 1))}
      <p className="muted race-foot">
        {nat && countrymen.length > 1 && <><Link to={`/players${qs(nat)}`}>#{countrymen.findIndex((r) => r.id === pid) + 1} of {countrymen.length} from {manifest.countries[nat] ?? nat}</Link> · </>}
        <Link to={`/players${qs()}`}>Full table</Link>
      </p>
    </div>
  );
}

function PlayerNews({ pid }: { pid: number }) {
  const { news } = useData();
  const live = usePlayerNews(pid);
  const items = (live ?? (live === null ? news.filter((n) => n.players.includes(pid)) : [])).slice(0, 6);
  return (
    <div className="news">
      <h3>News</h3>
      {live === undefined ? <div className="spinner small" /> : items.length ? <ul>{items.map((n) => <NewsRow key={n.id} n={n} day />)}</ul> : <p className="muted">No stories on NHL.com.</p>}
    </div>
  );
}

export function PlayerPage() {
  const { id } = useParams();
  const pid = Number(id);
  const { players, loading, manifest, gameById, anchor } = useData();
  const p = players[pid];
  const [f, set] = useGoalFilter({ range: "season" });
  const [sp, setSp] = useSearchParams();
  const tab = (["goals", "assists", "shots"].includes(sp.get("tab") ?? "") ? sp.get("tab") : "overview") as Tab;
  const setTab = (t: Tab) => { const q = new URLSearchParams(sp); if (t === "overview") q.delete("tab"); else q.set("tab", t); setSp(q, { replace: true }); };
  const mine = useFilteredGoals({ ...f, player: undefined });
  const scored = mine.filter((g) => g.scorer.id === pid);
  const assisted = mine.filter((g) => g.assists.some((a) => a.id === pid));
  const [playAll, setPlayAll] = useState<typeof scored>();
  const stats = useMemo(() => {
    const count = (fn: (g: (typeof scored)[number]) => string | undefined) => {
      const m = new Map<string, number>();
      for (const g of scored) { const k = fn(g); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    return { shots: count((g) => g.shotType), zones: count((g) => g.zone), vs: count((g) => g.against) };
  }, [scored]);
  const pick = useCallback((sh: { player: number; game: number }) => {
    if (sh.player !== pid || (f.type && String(sh.game).slice(4, 6) !== f.type)) return false;
    const [a, b] = rangeBounds(f.range, anchor, f.from, f.to);
    const d = gameById.get(sh.game)?.date;
    return !!d && d >= a && d <= b;
  }, [pid, f.type, f.range, f.from, f.to, anchor, gameById]);
  if (loading) return <div className="spinner" />;
  const name = p?.n ?? scored[0]?.scorer.name ?? `Player ${pid}`;
  const goalie = p?.pos === "G";
  const list = tab === "assists" ? assisted : scored;
  const bar = (rows: [string, number][]) => rows.slice(0, 6).map(([k, v]) => (
    <div key={k} className="bar"><span>{k}</span><i style={{ width: `${(v / rows[0][1]) * 100}%` }} /><b>{v}</b></div>
  ));
  const goalList = (goals: typeof scored) => goals.map((g) => <div key={g.id}><small className="muted">{fmtDate(g.date)}</small><GoalCard goal={g} minimap /></div>);
  const playButton = (goals: typeof scored, what: string) => {
    const n = goals.filter((g) => g.clip).length;
    return n > 1 && <button className="chip" onClick={() => setPlayAll(goals)} title={`Play every ${what} in range, newest first`}>▶ Play all {n}</button>;
  };
  return (
    <section>
      <div className="profile">
        {p?.t && <Watermark abbrev={p.t} side="right" />}
        <Face id={pid} size={96} />
        <div>
          <h1>{name}</h1>
          <InjuryBadge player={pid} />
          <p className="muted"><Flag code={p?.nat} /> {p?.nat ? manifest.countries[p.nat] ?? p.nat : "Unknown"} · {p?.pos} {p?.t && <>· <TeamLogo abbrev={p.t} size={18} /> {p.t}</>}</p>
          <p><b>{scored.length}</b> goals · <b>{assisted.length}</b> assists in range · <b>{scored.filter((g) => g.strength === "PP").length}</b> PP · <b>{scored.filter((g) => g.tags.includes("gwg")).length}</b> GWG</p>
        </div>
      </div>
      <SeasonLine pid={pid} goalie={goalie} />
      <FilterBar f={{ ...f, player: undefined }} set={set} hide={["nat", "team"]} />
      <div className="row">
        <Chip active={tab === "overview"} onClick={() => setTab("overview")}>Overview</Chip>
        <Chip active={tab === "goals"} onClick={() => setTab("goals")}>Goals ({scored.length})</Chip>
        <Chip active={tab === "assists"} onClick={() => setTab("assists")}>Assists ({assisted.length})</Chip>
        {scored.length > 0 && <Chip active={tab === "shots"} onClick={() => setTab("shots")}>Shot profile</Chip>}
      </div>
      {tab === "overview" && (
        <div className="ov">
          {(!goalie || scored.length > 0) && <div>
            <div className="row between">
              <h3>Latest goals</h3>
              {playButton(scored, "goal")}
            </div>
            {scored.length === 0 && <p className="muted">No goals in this range.</p>}
            {goalList(scored.slice(0, LATEST))}
            {scored.length > LATEST && <button className="more" onClick={() => setTab("goals")}>All {scored.length} goals</button>}
          </div>}
          <div className="ov-side">
            {!goalie && <PointsRace pid={pid} goals={mine} query={sp.toString()} />}
            <PlayerNews pid={pid} />
          </div>
        </div>
      )}
      {tab === "shots" && scored.length > 0 && (
        <div className="cols">
          <div><h3>Shot types</h3>{bar(stats.shots)}</div>
          <div><h3>Where from</h3>{bar(stats.zones)}</div>
          <div><h3>Against</h3>{bar(stats.vs)}</div>
          <div><h3>Goal map</h3><ShotMap goals={scored} pick={pick} /></div>
        </div>
      )}
      {(tab === "goals" || tab === "assists") && (
        <>
          {list.length > 0 && <div className="row between"><h3>{tab === "goals" ? "Goals" : "Assists"}</h3>{playButton(list, tab === "goals" ? "goal" : "assisted goal")}</div>}
          {list.length === 0 && <p className="empty">Nothing in this range.</p>}
          {goalList(list.slice(0, 60))}
        </>
      )}
      {playAll && <PlaylistModal goals={playAll} onClose={() => setPlayAll(undefined)} />}
    </section>
  );
}
