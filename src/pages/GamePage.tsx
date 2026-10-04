import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useData } from "../lib/data";
import { byPeriod, headline, shortRecap } from "../lib/recap";
import { fmtDate, gameStatus } from "../lib/util";
import { Chip, ClipPlayer, Face, GoalCard, TeamLogo, Watermark } from "../components/ui";
import { GameShotMap } from "../components/GameShotMap";
import { useSpoilers } from "../lib/spoilers";
import { gameVars } from "../lib/teamColors";
import { flag } from "../lib/flags";

export default function GamePage() {
  const { id } = useParams();
  const { gameById, loading, players } = useData();
  const [nat, setNat] = useState<string | null>(null);
  const [by, setBy] = useState<"scorer" | "assists">("scorer");
  const [vid, setVid] = useState<"short" | "long" | null>(null);
  const sp = useSpoilers();
  const g = gameById.get(Number(id));
  if (loading) return <div className="spinner" />;
  if (!g) return <p className="empty">Game not found. <Link to="/">Back to scores</Link></p>;
  const blocks = byPeriod(g);
  const hid = sp.hidden(g);
  const is = (id: number) => players[id]?.nat === nat;
  const shown = g.goals.filter((x) => !nat || (by === "scorer" ? is(x.scorer.id) : x.assists.some((a) => is(a.id))));
  const shownBlocks = byPeriod({ ...g, goals: shown });
  return (
    <section>
      <Link to={`/?date=${g.date}`} className="back">‹ {fmtDate(g.date)}</Link>
      <div className="scoreboard" style={gameVars(g.away.abbrev, g.home.abbrev)}>
        <Watermark abbrev={g.away.abbrev} side="left" /><Watermark abbrev={g.home.abbrev} side="right" />
        {[g.away, g.home].map((t, i) => (
          <div key={t.abbrev} className="sb-team">
            <TeamLogo abbrev={t.abbrev} size={72} /><b>{t.name}</b>
            {!hid && (t.sog ?? g.shotsByPeriod?.reduce((a, p) => a + (i ? p.home : p.away), 0)) !== undefined && <small>{t.sog ?? g.shotsByPeriod!.reduce((a, p) => a + (i ? p.home : p.away), 0)} shots on goal</small>}
          </div>
        )).flatMap((el, i) => i === 0 ? [el, <div key="mid" className="sb-mid"><div className="sb-score">{hid ? "?" : g.away.score}<span>–</span>{hid ? "?" : g.home.score}</div><span className="status">{hid ? "Played" : gameStatus(g)}</span></div>] : [el])}
      </div>
      {hid ? (
        <div className="gate">
          <div className="gate-icon">🙈</div>
          <p className="muted">Result, summary and goals are hidden.</p>
          <button className="chip on" onClick={() => sp.reveal([g.id])}>Reveal this game</button>
        </div>
      ) : (
        <>
      <div className="row">
        <Chip active={vid === "short"} onClick={() => setVid(vid === "short" ? null : "short")} title="~5 min recap video">▶ Short summary</Chip>
        <Chip active={vid === "long"} onClick={() => setVid(vid === "long" ? null : "long")} title="~10 min condensed game">▶ Full summary</Chip>
        {!g.recapClip && !g.condensedClip && g.finished && <span className="muted">Videos usually appear a few hours after the game.</span>}
      </div>
      {vid && ((vid === "short" ? g.recapClip : g.condensedClip)
        ? <ClipPlayer clip={(vid === "short" ? g.recapClip : g.condensedClip)!} />
        : <p className="muted">That video isn't available yet.</p>)}
      <div className="recap">
        <h2>{headline(g)}</h2>
        <p>{shortRecap(g)}</p>
        {blocks.map((b) => <p key={b.label}><b>{b.label}:</b> {b.goals.map((x) => `${x.scorer.name.split(" ").slice(1).join(" ")} (${x.team}, ${x.time})`).join("; ")}.</p>)}
        {g.venue && <p className="muted">{g.venue}</p>}
      </div>
      {g.stars.length > 0 && (
        <div className="stars">{g.stars.map((s) => (
          <Link key={s.id} to={`/player/${s.id}`} className="star-card"><span className="starno">{"★".repeat(4 - s.star)}</span><Face id={s.id} size={44} /><b>{s.name}</b><small>{s.team}</small></Link>
        ))}</div>
      )}
      <div className="tabs-h2" role="tablist">
        <button role="tab" aria-selected={by === "scorer"} className={by === "scorer" ? "on" : ""} onClick={() => setBy("scorer")}>Goals ({g.goals.filter((x) => !nat || is(x.scorer.id)).length})</button>
        {g.goals.length > 0 && <button role="tab" aria-selected={by === "assists"} className={by === "assists" ? "on" : ""} onClick={() => setBy("assists")}>Assists ({g.goals.reduce((n, x) => n + x.assists.filter((a) => !nat || is(a.id)).length, 0)})</button>}
      </div>
      {g.goals.length > 0 && (
        <div className="row presets">
          {([["SWE", "Swedes"], ["FIN", "Finns"], ["USA", "Americans"], ["CAN", "Canadians"]] as const).map(([c, l]) => (
            <Chip key={c} active={nat === c} onClick={() => setNat(nat === c ? null : c)}>{flag(c)} {l}</Chip>
          ))}
          <Chip active={nat === null} onClick={() => setNat(null)}>All nations</Chip>
        </div>
      )}
      {g.goals.length === 0 ? <p className="empty">No goals{g.finished ? "" : " yet"}.</p> : shown.length === 0 ? <p className="empty">No {by === "scorer" ? "goals scored" : "assists"} by that nation in this game.</p> : shownBlocks.map((b) => (
        <div key={b.label}><h3 className="period">{b.label}</h3>{b.goals.map((x) => <GoalCard key={x.id} goal={x} showGame={false} minimap lead={by} />)}</div>
      ))}
      <GameShotMap game={g} />
        </>
      )}
    </section>
  );
}
