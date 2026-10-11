import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Goal } from "../../shared/types";
import { useData } from "../lib/data";
import { byPeriod, headline, shortRecap } from "../lib/recap";
import { fmtDate, gameStatus, logo } from "../lib/util";
import { Chip, ClipPlayer, Face, Flag, GoalCard, ShootoutCard, TeamLogo } from "../components/ui";
import { GameShotMap } from "../components/GameShotMap";
import { InjuryCards, recentNews } from "../components/InjuryNews";
import { useSpoilers } from "../lib/spoilers";
import { gameVars } from "../lib/teamColors";
import { flag } from "../lib/flags";

export default function GamePage() {
  const { id } = useParams();
  const { gameById, loading, players, news } = useData();
  const [nat, setNat] = useState<string | null>(null);
  const [tab, setTab] = useState<"goals" | "assists" | "points" | "map">("goals");
  const [text, setText] = useState(false);
  const [vid, setVid] = useState<"short" | "long" | null>(null);
  const sp = useSpoilers();
  const g = gameById.get(Number(id));
  if (loading) return <div className="spinner" />;
  if (!g) return <p className="empty">Game not found. <Link to="/">Back to scores</Link></p>;
  const blocks = byPeriod(g);
  const hid = sp.hidden(g);
  const started = g.finished || g.goals.length > 0;
  const injuries = recentNews(news, { teams: [g.away.abbrev, g.home.abbrev], days: 7, until: g.finished ? g.date : undefined, latestPerPlayer: true }).slice(0, 4);
  const is = (id: number) => players[id]?.nat === nat;
  const shown = g.goals.filter((x) => !nat || (tab === "assists" ? x.assists.some((a) => is(a.id)) : is(x.scorer.id)));
  const periods = (() => {
    const keys = new Map<string, { label: string; away: number; home: number }>();
    const key = (x: Goal) => (x.periodType === "OT" ? "OT" : String(x.period));
    if (g.finished) for (const k of ["1", "2", "3"]) keys.set(k, { label: `P${k}`, away: 0, home: 0 });
    for (const x of g.goals) {
      const k = key(x), e = keys.get(k) ?? { label: k === "OT" ? "OT" : `P${k}`, away: 0, home: 0 };
      if (x.team === g.away.abbrev) e.away++; else e.home++;
      keys.set(k, e);
    }
    return [...keys.values()];
  })();
  const shownBlocks = byPeriod({ ...g, goals: shown });
  const shootout = (g.shootout ?? []).filter((x) => !nat || is(x.scorer.id));
  // Points in this game: goals + assists (shootout goals don't count), most first.
  const points = (() => {
    const m = new Map<number, { id: number; name: string; team: string; g: number; a: number }>();
    const add = (p: { id: number; name: string }, team: string, k: "g" | "a") => {
      const e = m.get(p.id) ?? { id: p.id, name: p.name, team, g: 0, a: 0 };
      e[k]++; m.set(p.id, e);
    };
    for (const x of g.goals) {
      add(x.scorer, x.ownGoal ? x.against : x.team, "g");
      for (const a of x.assists) add(a, x.team, "a");
    }
    return [...m.values()].filter((e) => !nat || is(e.id)).sort((a, b) => b.g + b.a - a.g - a.a || b.g - a.g || a.name.localeCompare(b.name));
  })();
  return (
    <section>
      <Link to={`/?date=${g.date}`} className="back">‹ {fmtDate(g.date)}</Link>
      <div className="scoreboard" style={gameVars(g.away.abbrev, g.home.abbrev)}>
        {([[g.away, 0], [g.home, 1]] as const).map(([t, i]) => {
          const sog = t.sog ?? g.shotsByPeriod?.reduce((n, p) => n + (i ? p.home : p.away), 0);
          const pp = g.goals.filter((x) => x.team === t.abbrev && x.strength === "PP").length;
          return (
            <div key={t.abbrev} className="sb-team">
              <img className="sb-logo" src={logo(t.abbrev)} alt="" aria-hidden="true" />
              <b>{t.name}</b>
              <span className="sb-abbr">{t.abbrev} · {i ? "Home" : "Away"}</span>
              {!hid && sog !== undefined && <small>{sog} shots on goal{g.finished || g.goals.length ? ` · ${pp} PP goal${pp === 1 ? "" : "s"}` : ""}</small>}
            </div>
          );
        }).flatMap((el, i) => i === 0 ? [el, (
          <div key="mid" className="sb-mid">
            <div className="sb-score">{hid ? "?" : g.away.score}<span>–</span>{hid ? "?" : g.home.score}</div>
            <span className="status">{hid ? "Played" : gameStatus(g)}</span>
            {!hid && periods.length > 0 && (
              <div className="sb-periods">{periods.map((q) => <span key={q.label}><i>{q.label}</i> {q.away}–{q.home}</span>)}</div>
            )}
            <div className="sb-info">{[g.type === 3 ? "Playoffs" : "", g.venue, fmtDate(g.date, { weekday: "short", day: "numeric", month: "short" })].filter(Boolean).join(" · ")}</div>
          </div>
        )] : [el])}
      </div>
      <div className="row">
        <Chip active={vid === "short"} onClick={() => setVid(vid === "short" ? null : "short")} title="~5 min recap video">▶ Short summary</Chip>
        <Chip active={vid === "long"} onClick={() => setVid(vid === "long" ? null : "long")} title="~10 min condensed game">▶ Full summary</Chip>
        {!hid && g.finished && <Chip active={text} onClick={() => setText(!text)} title="Written recap with goals by period">📝 Text summary</Chip>}
        {!g.recapClip && !g.condensedClip && g.finished && <span className="muted">Videos usually appear a few hours after the game.</span>}
      </div>
      {vid && ((vid === "short" ? g.recapClip : g.condensedClip)
        ? <ClipPlayer clip={(vid === "short" ? g.recapClip : g.condensedClip)!} />
        : <p className="muted">That video isn't available yet.</p>)}
      <InjuryCards items={injuries} />
      {hid ? (
        <>
          <div className="gate">
            <div className="gate-icon">🙈</div>
            <p className="muted">Result, recap text and goals are hidden. Watch the 5 or 10 min video above to see the game.</p>
            <button className="chip on" onClick={() => sp.reveal([g.id])}>Reveal this game</button>
          </div>
        </>
      ) : !started ? null : (
        <>
      {text && (
        <div className="recap">
          <p>{shortRecap(g)}</p>
          {blocks.map((b) => <p key={b.label}><b>{b.label}:</b> {b.goals.map((x) => `${x.scorer.name.split(" ").slice(1).join(" ")} (${x.team}, ${x.time})`).join("; ")}.</p>)}
        </div>
      )}
      {g.stars.length > 0 && (
        <div className="infobox">
          <h4 className="infolabel">Three stars</h4>
          <div className="stars">{g.stars.map((s) => (
            <Link key={s.id} to={`/player/${s.id}`} className="star-card"><span className="starno">{"★".repeat(4 - s.star)}</span><Face id={s.id} size={44} /><b>{s.name}</b><small>{s.team}</small></Link>
          ))}</div>
        </div>
      )}
      <div className="tabs-h2" role="tablist">
        <button role="tab" aria-selected={tab === "goals"} className={tab === "goals" ? "on" : ""} onClick={() => setTab("goals")}>Goals ({g.goals.filter((x) => !nat || is(x.scorer.id)).length})</button>
        {g.goals.length > 0 && <button role="tab" aria-selected={tab === "assists"} className={tab === "assists" ? "on" : ""} onClick={() => setTab("assists")}>Assists ({g.goals.reduce((n, x) => n + x.assists.filter((a) => !nat || is(a.id)).length, 0)})</button>}
        {g.goals.length > 0 && <button role="tab" aria-selected={tab === "points"} className={tab === "points" ? "on" : ""} onClick={() => setTab("points")}>Points</button>}
        <button role="tab" aria-selected={tab === "map"} className={tab === "map" ? "on" : ""} onClick={() => setTab("map")}>Shot map</button>
      </div>
      {tab === "map" && <GameShotMap game={g} />}
      {(tab === "goals" || tab === "assists" || tab === "points") && (
        <>
      {g.goals.length > 0 && (
        <div className="row presets">
          {([["SWE", "Swedes"], ["FIN", "Finns"], ["USA", "Americans"], ["CAN", "Canadians"]] as const).map(([c, l]) => (
            <Chip key={c} active={nat === c} onClick={() => setNat(nat === c ? null : c)}>{flag(c)} {l}</Chip>
          ))}
          <Chip active={nat === null} onClick={() => setNat(null)}>All nations</Chip>
        </div>
      )}
      {tab === "points" ? (points.length === 0 ? <p className="empty">No points by that nation in this game.</p> : (
        <table className="table">
          <thead><tr><th>#</th><th>Player</th><th>Team</th><th>P</th><th>G</th><th>A</th></tr></thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={p.id}>
                <td>{i + 1}</td>
                <td><Link to={`/player/${p.id}`} className="pl"><Face id={p.id} size={30} /> <Flag code={players[p.id]?.nat} /> {p.name}{(() => { const st = g.stars.find((x) => x.id === p.id); return st && <span className="starno" title={`${["First", "Second", "Third"][st.star - 1]} star`}>{"★".repeat(4 - st.star)}</span>; })()}</Link></td>
                <td><TeamLogo abbrev={p.team} size={22} /></td>
                <td><b>{p.g + p.a}</b></td><td>{p.g}</td><td>{p.a}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )) : g.goals.length === 0 ? <p className="empty">No goals{g.finished ? "" : " yet"}.</p> : shown.length === 0 ? <p className="empty">No {tab === "goals" ? "goals scored" : "assists"} by that nation in this game.</p> : shownBlocks.map((b) => (
        <div key={b.label}><h3 className="period">{b.label}</h3>{b.goals.map((x) => <GoalCard key={x.id} goal={x} showGame={false} minimap lead={tab === "goals" ? "scorer" : "assists"} />)}</div>
      ))}
      {tab === "goals" && shootout.length > 0 && (
        <div><h3 className="period">Shootout</h3>{shootout.map((x) => <ShootoutCard key={`${x.round}-${x.scorer.id}`} goal={x} />)}</div>
      )}
        </>
      )}
        </>
      )}
    </section>
  );
}
