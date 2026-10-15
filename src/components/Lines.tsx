import { Link } from "react-router-dom";
import type { GoalieLine, LineUnit, LineupSlot, SkaterLine, TeamLines } from "../../shared/types";
import { useData } from "../lib/data";
import { useLines, useLineups, useSeasonStats } from "../lib/player";
import { fmtDate, fmtTime, ordinal, surname } from "../lib/util";
import { Face, Flag, TeamLogo } from "./ui";

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const keyOf = (ids: number[]) => [...ids].sort((a, b) => a - b).join(",");

type Heat = "fire" | "hot" | "cold" | "";
/** Form over the last five games played: points per game, point streak, and a temperature. */
function formOf(f?: [number, number][]) {
  const last = (f ?? []).slice(-5);
  const pts = last.reduce((s, [g, a]) => s + g + a, 0);
  let streak = 0;
  for (let i = (f ?? []).length - 1; i >= 0 && f![i][0] + f![i][1] > 0; i--) streak++;
  const ppg = last.length ? pts / last.length : 0;
  const heat: Heat = !last.length ? "" : ppg >= 1.2 ? "fire" : ppg >= 0.6 || streak >= 3 ? "hot" : pts === 0 && last.length >= 4 ? "cold" : "";
  return { last, pts, streak, heat };
}
const HEAT_ICON: Record<Heat, string> = { fire: "🔥", hot: "🔥", cold: "🧊", "": "" };
const HEAT_LABEL: Record<Heat, string> = { fire: "On fire", hot: "Hot", cold: "Ice cold", "": "" };

/** A unit's temperature from its players' points over their last five games. */
function unitHeat(pts: number, players: number) {
  const ppg = players ? pts / (players * 5) : 0;
  const label = ppg >= 0.8 ? "On fire" : ppg >= 0.5 ? "Hot" : ppg >= 0.25 ? "Warm" : ppg > 0 ? "Cool" : "Ice cold";
  return { pct: Math.min(100, (ppg / 1) * 100), label };
}

interface Ctx { lines?: TeamLines; skaters: Record<string, SkaterLine>; goalies: Record<string, GoalieLine> }

function Token({ slot, ctx }: { slot: LineupSlot | { id: number; name?: string; pos?: string; gtd?: boolean; injury?: string }; ctx: Ctx }) {
  const { players } = useData();
  const id = slot.id;
  const p = id ? players[id] : undefined;
  const name = p?.n ?? slot.name ?? "";
  const s = id ? ctx.skaters[id] : undefined;
  const f = formOf(id ? ctx.lines?.form[id] : undefined);
  const body = (
    <>
      <span className="tk-face">{id ? <Face id={id} size={54} /> : <span className="face ph" style={{ width: 54, height: 54 }} />}{f.heat && <i className={`tk-heat ${f.heat}`} title={HEAT_LABEL[f.heat]}>{HEAT_ICON[f.heat]}</i>}</span>
      <b className="tk-name"><Flag code={p?.nat} /> {surname(name)}</b>
      {s ? <small className="tk-pts"><b>{s.p}</b> P · {s.g}G {s.a}A</small> : <small className="tk-pts muted">–</small>}
      {s && <small className="muted">{mmss(s.toi)} TOI</small>}
      <span className="pips" title={`Last ${f.last.length} games: ${f.pts} points${f.streak >= 2 ? ` · ${f.streak}-game point streak` : ""}`}>
        {f.last.map(([g, a], i) => <i key={i} className={`pip p${Math.min(3, g + a)}${g ? " g" : ""}`} />)}
      </span>
      {(slot.gtd || slot.injury) && <small className="tk-flag">{slot.gtd ? "Game-time decision" : injury(slot.injury)}</small>}
    </>
  );
  return id ? <Link to={`/player/${id}`} className={`tk ${f.heat}`}>{body}</Link> : <span className="tk">{body}</span>;
}

const INJURY: Record<string, string> = { ir: "Injured reserve", ltir: "Long-term IR", dtd: "Day-to-day", out: "Out" };
const injury = (s?: string) => (s ? INJURY[s.toLowerCase()] ?? s : undefined);

function UnitStats({ unit, label }: { unit?: LineUnit; label: string }) {
  if (!unit || unit.toi < 60) return <small className="muted">{label}: new combination, under a minute together at 5-on-5 this season</small>;
  const share = unit.gf + unit.ga ? unit.gf / (unit.gf + unit.ga) : 0.5;
  return (
    <small className="unit-stats" title={`${label}: ${mmss(unit.toi)} together at 5-on-5 in ${unit.gp} games`}>
      {label}: <b>{mmss(unit.toi)}</b> together · {unit.gp} GP · GF <b>{unit.gf}</b>–<b>{unit.ga}</b> GA
      <span className="gf-bar"><i style={{ width: `${share * 100}%` }} /></span>
    </small>
  );
}

/** `foot` replaces the line and pair numbers (special teams); null leaves the footer out. */
function Unit({ title, fwd, def, ctx, find, foot }: { title: string; fwd: (LineupSlot | { id: number })[]; def: (LineupSlot | { id: number })[]; ctx: Ctx; find: (ids: (number | undefined)[]) => LineUnit | undefined; foot?: React.ReactNode }) {
  const members = [...fwd, ...def].map((s) => s.id).filter((x): x is number => !!x);
  const pts = members.reduce((s, id) => s + formOf(ctx.lines?.form[id]).pts, 0);
  const h = unitHeat(pts, members.length);
  return (
    <article className="unit">
      <header>
        <h3>{title}</h3>
        <span className="heat" title={`${pts} points by these players in their last five games`}>
          <span className="heat-bar"><i style={{ width: `${Math.max(4, h.pct)}%` }} /></span> {h.label} · {pts} pts last 5
        </span>
      </header>
      <div className={`ice${def.length ? "" : " solo"}`}>
        <div className="ice-row f">{fwd.map((s, i) => <Token key={s.id ?? i} slot={s} ctx={ctx} />)}</div>
        {def.length > 0 && <div className="ice-row d">{def.map((s, i) => <Token key={s.id ?? i} slot={s} ctx={ctx} />)}</div>}
      </div>
      {foot === undefined ? (
        <footer>
          {fwd.length > 0 && <UnitStats unit={find(fwd.map((s) => s.id))} label="Line" />}
          {def.length > 0 && <UnitStats unit={find(def.map((s) => s.id))} label="Pair" />}
        </footer>
      ) : foot && <footer>{foot}</footer>}
    </article>
  );
}

function Faces({ ids }: { ids: (number | undefined)[] }) {
  const { players } = useData();
  return <span className="faces">{ids.map((id, i) => (id ? <Link key={i} to={`/player/${id}`} title={players[id]?.n}><Face id={id} size={30} /></Link> : <span key={i} className="face ph" style={{ width: 30, height: 30 }} />))}</span>;
}

export function TeamLinesView({ abbrev }: { abbrev: string }) {
  const { season, manifest, games, players } = useData();
  const file = useLines(season);
  const lineups = useLineups();
  const st = useSeasonStats(season);
  if (file === undefined || lineups === undefined || st === undefined) return <div className="spinner" />;
  const lines = file?.teams[abbrev];
  const current = season === manifest.currentSeason;
  const lu = current ? lineups[abbrev] : undefined;
  const ctx: Ctx = { lines, skaters: { ...st.po?.skaters, ...st.rs?.skaters }, goalies: { ...st.po?.goalies, ...st.rs?.goalies } };
  const known = [...(lines?.combos ?? []), ...(lines?.fwd ?? []), ...(lines?.def ?? []), ...(lines?.pp ?? []), ...(lines?.topFwd ?? []), ...(lines?.topDef ?? [])];
  const find = (ids: (number | undefined)[]) => (ids.every(Boolean) ? known.find((u) => keyOf(u.ids) === keyOf(ids as number[])) : undefined);
  const next = games.filter((g) => (g.state === "FUT" || g.state === "PRE") && (g.home.abbrev === abbrev || g.away.abbrev === abbrev)).sort((a, b) => a.start.localeCompare(b.start))[0];

  if (!lu && !lines) return <p className="empty">No line data for this season.</p>;
  const g = lu?.groups ?? {};
  const units = lu
    ? [1, 2, 3, 4].map((n) => ({ fwd: g[`f${n}`] ?? [], def: g[`d${n}`] ?? [] })).filter((u) => u.fwd.length || u.def.length)
    : [0, 1, 2, 3].map((i) => ({ fwd: (lines!.fwd[i]?.ids ?? []).map((id) => ({ id })), def: (lines!.def[i]?.ids ?? []).map((id) => ({ id })) })).filter((u) => u.fwd.length || u.def.length);
  type Slot = LineupSlot | { id: number };
  const pp: Slot[][] = lu ? [g.pp1, g.pp2].filter((u): u is LineupSlot[] => !!u?.length) : (lines?.pp ?? []).map((u) => u.ids.map((id) => ({ id })));
  const pk: Slot[][] = lu ? [g.pk1, g.pk2].filter((u): u is LineupSlot[] => !!u?.length) : [];
  /** Special-teams units drawn like the lines: forwards up front, defencemen behind. */
  const split = (u: Slot[]) => ({ fwd: u.filter((s) => !s.id || players[s.id]?.pos !== "D"), def: u.filter((s) => !!s.id && players[s.id]?.pos === "D") });
  const ppFoot = (u: Slot[]) => {
    const st = find(u.map((s) => s.id));
    return !st || st.toi < 60
      ? <small className="muted">New unit, under a minute together on the power play this season</small>
      : <small className="unit-stats">On the power play: <b>{mmss(st.toi)}</b> together · {st.gp} GP · <b>{st.gf}</b> goals</small>;
  };
  const goalies = lu ? (g.g ?? []).map((s) => s.id) : [lines?.goalie];
  const out = [...(g.ir ?? []).map((s) => ({ id: s.id, name: s.name, why: injury(s.injury) ?? "Injured" })), ...(lines?.scratches ?? []).filter((id) => !(g.ir ?? []).some((s) => s.id === id)).map((id) => ({ id, name: players[id]?.n ?? String(id), why: "Scratched last game" }))];
  const iceTime = Object.entries(ctx.skaters).filter(([id]) => players[id]?.t === abbrev).sort((a, b) => b[1].toi - a[1].toi).slice(0, 12);
  const maxToi = iceTime[0]?.[1].toi ?? 1;

  return (
    <div className="lines">
      <p className="lines-src muted">
        {lu ? (
          <>Projected line-up{next && <> for <b>{next.home.abbrev === abbrev ? "vs" : "@"} <TeamLogo abbrev={next.home.abbrev === abbrev ? next.away.abbrev : next.home.abbrev} size={16} /> {next.home.abbrev === abbrev ? next.away.abbrev : next.home.abbrev}</b> · {fmtDate(next.date)} {fmtTime(next.start)}</>}
            {" "}· from <a href={lu.url} target="_blank" rel="noreferrer">DailyFaceoff</a>{lu.reporter && <> via {lu.sourceUrl ? <a href={lu.sourceUrl} target="_blank" rel="noreferrer">{lu.reporter}</a> : lu.reporter}</>} · updated {fmtDate(lu.updated.slice(0, 10), { day: "numeric", month: "short" })}</>
        ) : lines && <>As deployed in the latest game, {lines.home ? "vs" : "@"} {lines.opp} · {fmtDate(lines.date)}</>}
        <br />Numbers together come from NHL shift charts: time on the ice at the same time at 5-on-5 this season, and the goals for and against meanwhile.
      </p>
      <div className="lines-grid">
        <div className="units">
          {units.map((u, i) => <Unit key={i} title={`${ordinal(i + 1)} line`} fwd={u.fwd} def={u.def} ctx={ctx} find={find} />)}
          {pp.map((u, i) => <Unit key={`pp${i}`} title={`Power play ${i + 1}`} {...split(u)} ctx={ctx} find={find} foot={ppFoot(u)} />)}
          {pk.map((u, i) => <Unit key={`pk${i}`} title={`Penalty kill ${i + 1}`} {...split(u)} ctx={ctx} find={find} foot={null} />)}
        </div>
        <aside className="lines-side">
          <div>
            <h3>In goal</h3>
            {goalies.filter((id): id is number => !!id).map((id, i) => {
              const s = ctx.goalies[id];
              return (
                <Link key={id} to={`/player/${id}`} className="leader">
                  <Face id={id} size={34} /><span className="leader-name">{players[id]?.n ?? id}{i === 0 && goalies.length > 1 && <small className="muted"> · projected starter</small>}</span>
                  {s && <small className="muted">{s.svp.toFixed(3).replace(/^0/, "")} · {s.gaa.toFixed(2)} · {s.w}-{s.l}-{s.otl}</small>}
                </Link>
              );
            })}
            {lines?.goalie && <p className="muted small-note">Played last game: {players[lines.goalie]?.n}</p>}
          </div>
          {out.length > 0 && (
            <div>
              <h3>Out</h3>
              {out.map((o, i) => (
                <div key={i} className="out-row">{o.id ? <Link to={`/player/${o.id}`}>{o.name}</Link> : o.name} <small className="muted">{o.why}</small></div>
              ))}
            </div>
          )}
          {iceTime.length > 0 && (
            <div>
              <h3>Most ice time <small className="muted">per game</small></h3>
              {iceTime.map(([id, s]) => (
                <Link key={id} to={`/player/${id}`} className="toi-row">
                  <span>{surname(players[id]?.n ?? id)} <small className="muted">{players[id]?.pos}</small></span>
                  <span className="toi-bar"><i style={{ width: `${(s.toi / maxToi) * 100}%` }} /></span>
                  <b>{mmss(s.toi)}</b>
                </Link>
              ))}
            </div>
          )}
          {lines && lines.topFwd.length > 0 && (
            <div>
              <h3>Most used this season</h3>
              {([["Lines", lines.topFwd.slice(0, 4)], ["Pairs", lines.topDef.slice(0, 3)]] as const).map(([label, list]) => list.length > 0 && (
                <div key={label}>
                  <h4 className="infolabel">{label}</h4>
                  {list.map((u) => (
                    <div key={keyOf(u.ids)} className="used-row">
                      <Faces ids={u.ids} />
                      <span className="used-names">{u.ids.map((id, i) => <span key={id}>{i > 0 && " – "}<Link to={`/player/${id}`}>{surname(players[id]?.n ?? String(id))}</Link></span>)}</span>
                      <small className="muted">{mmss(u.toi)} · {u.gf}–{u.ga}</small>
                    </div>
                  ))}
                </div>
              ))}
              <p className="muted small-note">5-on-5 time together, goals for–against.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
