import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useData } from "../lib/data";
import { addDays, fmtDate, gameStatus, logo, surname } from "../lib/util";
import { useFavorites } from "../lib/favorites";
import { Chip, ClipModal, Flag, VideoModal, TvIcon } from "../components/ui";
import { useSpoilers } from "../lib/spoilers";
import { gameVars, teamColor } from "../lib/teamColors";
import type { Game } from "../../shared/types";

function GameCard({ g }: { g: Game }) {
  const { players } = useData();
  const { has } = useFavorites();
  const sp = useSpoilers();
  const [playing, setPlaying] = useState<string | null>(null);
  const [summary, setSummary] = useState<"short" | "long" | null>(null);
  const navigate = useNavigate();
  const hid = sp.hidden(g);
  const awayWon = !hid && g.finished && g.away.score > g.home.score;
  const homeWon = !hid && g.finished && g.home.score > g.away.score;
  const started = g.state !== "FUT" && g.state !== "PRE";
  const Side = ({ t, win }: { t: Game["away"]; win: boolean }) => (
    <div className={`gc-side${win ? " win" : ""}`}>
      <img className="gc-logo" src={logo(t.abbrev)} alt="" aria-hidden="true" loading="lazy" />
      <b className="gc-name">{t.name}{has(t.abbrev) && <em> ★</em>}</b>
      {started && !hid && t.sog !== undefined && <small className="sog" title="Shots on goal">{t.sog} SOG</small>}
    </div>
  );
  return (
    <Link to={`/game/${g.id}`} style={gameVars(g.away.abbrev, g.home.abbrev)} className={`game${g.state === "LIVE" || g.state === "CRIT" ? " live" : ""}`}>
      <div className="game-head"><span className="status">{hid ? "Played" : gameStatus(g)}</span><span>{g.type === 3 ? "Playoffs" : g.venue}</span></div>
      <div className="gc-board">
        <Side t={g.away} win={awayWon} />
        <div className="gc-mid">
          {!started ? <span className="gc-vs">@</span> : hid ? <span>•<i>–</i>•</span> : <><span className={awayWon ? "w" : ""}>{g.away.score}</span><i>–</i><span className={homeWon ? "w" : ""}>{g.home.score}</span></>}
        </div>
        <Side t={g.home} win={homeWon} />
      </div>
      {hid && <button className="reveal-mini" onClick={(e) => { e.preventDefault(); sp.reveal([g.id]); }}>Reveal result</button>}
      {!hid && g.goals.length > 0 && (
        <ul className="mini-goals">
          {g.goals.map((x, i) => (
            <Fragment key={x.id}>
              {(i === 0 || g.goals[i - 1].period !== x.period) && <li className="period-sep" aria-hidden="true"><span>{x.periodType === "OT" ? "OT" : `P${x.period}`}</span></li>}
            <li className="row-band" style={{ "--tc": teamColor(x.team).vivid } as React.CSSProperties} title={`${x.team} goal`}>
              <img className="band-logo" src={logo(x.team)} alt={x.team} />
              <div className="goal-line">
                <b className="c-name" role="link" tabIndex={0} title={`${x.scorer.name}'s page`}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/player/${x.scorer.id}`); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); navigate(`/player/${x.scorer.id}`); } }}>{surname(x.scorer.name)}</b>
                <small className="c-score">{x.away}–{x.home}</small>
                <small className="c-time">{x.time}</small>
                <small className="c-tag">{x.emptyNet ? "EN" : x.strength !== "EV" ? x.strength : ""}</small>
              </div>
              <Flag code={players[x.scorer.id]?.nat} />
              {x.clip && (
                <button className={`tv mini${playing === x.id ? " on" : ""}`} title="Watch the goal here" aria-label="Play goal video"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPlaying(playing === x.id ? null : x.id); }}><TvIcon /></button>
              )}
            </li>
            </Fragment>
          ))}
        </ul>
      )}
      {(g.recapClip || g.condensedClip) && (
        <div className="game-videos">
          {g.recapClip && <button title="Recap, about 5 minutes" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSummary("short"); }}><TvIcon /> 5 min</button>}
          {g.condensedClip && <button title="Condensed game, about 10 minutes" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSummary("long"); }}><TvIcon /> 10 min</button>}
        </div>
      )}
      {summary && <VideoModal clip={summary === "short" ? g.recapClip : g.condensedClip} label="Game summary"
        caption={`${summary === "short" ? "Recap" : "Condensed game"}: ${g.away.name} at ${g.home.name}`} onClose={() => setSummary(null)} />}
      {!hid && playing && (() => { const x = g.goals.find((q) => q.id === playing); return x?.clip ? <ClipModal goal={x} onClose={() => setPlaying(null)} /> : null; })()}
    </Link>
  );
}

export default function Scores() {
  const { games, anchor, season, loading } = useData();
  const { teams: favs } = useFavorites();
  const spoil = useSpoilers();
  const [sp, setSp] = useSearchParams();
  const date = sp.get("date") ?? anchor;
  const mine = sp.get("mine") === "1";
  const go = (d: string) => { const n = new URLSearchParams(sp); n.set("date", d); setSp(n, { replace: true }); };
  const dates = new Set(games.map((g) => g.date));
  let day = games.filter((g) => g.date === date);
  if (mine && favs.length) day = day.filter((g) => favs.includes(g.home.abbrev) || favs.includes(g.away.abbrev));
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stripRef.current, on = el?.querySelector<HTMLElement>(".day.on");
    if (el && on) el.scrollTo({ left: on.offsetLeft - el.clientWidth / 2 + on.clientWidth / 2 });
  }, [date]);
  const strip = Array.from({ length: 9 }, (_, i) => addDays(date, i - 4));
  const goals = day.reduce((a, g) => a + g.goals.length, 0);
  const anyHidden = day.some((g) => spoil.hidden(g));
  return (
    <section>
      <div className="datenav">
        <button onClick={() => go(addDays(date, -1))} aria-label="Previous day">‹</button>
        <div className="strip" ref={stripRef}>
          {strip.map((d) => (
            <button key={d} className={`day${d === date ? " on" : ""}${dates.has(d) ? "" : " empty"}`} onClick={() => go(d)}>
              <small>{fmtDate(d, { weekday: "short" })}</small><b>{fmtDate(d, { day: "numeric" })}</b><small>{fmtDate(d, { month: "short" })}</small>
            </button>
          ))}
        </div>
        <button onClick={() => go(addDays(date, 1))} aria-label="Next day">›</button>
        <input type="date" value={date} onChange={(e) => e.target.value && go(e.target.value)} aria-label="Pick date" />
      </div>
      <div className="row between">
        <h1>{fmtDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h1>
        <div className="row">
          <span className="muted">{day.length} games{anyHidden ? "" : ` · ${goals} goals`}</span>
          {anyHidden && <Chip onClick={() => spoil.reveal(day.map((g) => g.id))}>Reveal day</Chip>}
          {favs.length > 0 && <Chip active={mine} onClick={() => { const n = new URLSearchParams(sp); mine ? n.delete("mine") : n.set("mine", "1"); setSp(n, { replace: true }); }}>★ My teams</Chip>}
          {date !== anchor && <Chip onClick={() => go(anchor)}>Latest</Chip>}
        </div>
      </div>
      {loading ? <div className="spinner" /> : day.length === 0 ? (
        <p className="empty">No games {mine ? "for your teams " : ""}on this day{dates.size ? "." : ` in season ${season}.`}</p>
      ) : <div className="grid">{day.map((g) => <GameCard key={g.id} g={g} />)}</div>}
      {favs.length === 0 && <p className="muted hint">Tip: <Link to="/teams">pick favourite teams</Link> to filter scores and goals.</p>}
    </section>
  );
}
