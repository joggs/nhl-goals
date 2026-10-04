import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { PlayoffBracket, PlayoffGame, PlayoffSeries } from "../../shared/types";
import { useData } from "../lib/data";
import { Chip, Face, Flag, GoalCard, TeamLogo, Watermark } from "../components/ui";
import { tally } from "./Players";
import { useEdge } from "../lib/edge";
import { headshot } from "../lib/util";
import { kmh } from "../lib/units";

const base = import.meta.env.BASE_URL;
const EAST = new Set("ABCDIJM");
const ROUND_LABEL = ["First round", "Second round", "Conference final", "Stanley Cup Final"];
const etDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "America/New_York" });

function SeriesCard({ s, on, pick }: { s?: PlayoffSeries; on: boolean; pick: () => void }) {
  if (!s) return <div className="series empty" />;
  const side = (t: PlayoffSeries["top"]) => {
    if (!t) return <div className="sd tbd"><span className="sd-name">TBD</span></div>;
    const cls = s.winner ? (s.winner === t.abbrev ? " win" : " lose") : "";
    return (
      <div className={`sd${cls}`}>
        <TeamLogo abbrev={t.abbrev} size={22} /><span className="sd-name">{t.abbrev}</span><small>{t.seed}</small><b>{t.wins}</b>
      </div>
    );
  };
  return (
    <button className={`series${on ? " on" : ""}`} onClick={pick} aria-pressed={on} title={s.title}>
      {side(s.top)}{side(s.bottom)}
    </button>
  );
}

function GameRow({ g }: { g: PlayoffGame }) {
  const { gameById } = useData();
  const [open, setOpen] = useState(false);
  if (!g.final) {
    return <li className="muted">Game {g.num} · {etDate(g.start)}{g.optional ? " · if necessary" : ""}</li>;
  }
  const game = gameById.get(g.id);
  const homeWon = (g.homeScore ?? 0) > (g.awayScore ?? 0);
  const ot = g.ot ? ` (${g.ot > 1 ? `${g.ot}OT` : "OT"})` : "";
  const body = (
    <>
      <span className="g-num">G{g.num}</span><span className="muted">{etDate(g.start)}</span>
      <span className={homeWon ? "" : "g-win"}>{g.away} {g.awayScore}</span>–<span className={homeWon ? "g-win" : ""}>{g.homeScore} {g.home}</span>{ot}
    </>
  );
  return (
    <li>
      <div className="g-line">
        {game ? <Link to={`/game/${g.id}`} className="g-row">{body}</Link> : <span className="g-row">{body}</span>}
        {game && game.goals.length > 0 && (
          <button className="linkbtn" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Hide goals" : `Goals (${game.goals.length})`}</button>
        )}
      </div>
      {open && game && <div className="series-goals">{game.goals.map((x) => <GoalCard key={x.id} goal={x} showGame={false} minimap />)}</div>}
    </li>
  );
}

type Leader = "points" | "goals" | "assists";

/** Playoff scoring leaders, counted from the goals we already have (game ids with type 03). */
function PlayoffLeaders({ season }: { season: number }) {
  const { goals, players } = useData();
  const edge = useEdge(season, "playoffs");
  const rows = useMemo(() => tally(goals.filter((g) => String(g.gameId).slice(4, 6) === "03")), [goals]);
  const top = (key: Leader) => [...rows].sort((a, b) => b[key] - a[key] || b.points - a.points || b.goals - a.goals).filter((r) => r[key] > 0).slice(0, 5);
  if (rows.length === 0) return null;
  const edgeCards = ([["speed", "⚡ Fastest skaters", (v: number) => `${kmh(v).toFixed(1)} km/h`], ["shot", "🎯 Hardest shots", (v: number) => `${kmh(v).toFixed(1)} km/h`]] as const)
    .map(([id, title, fmt]) => ({ id, title, fmt, list: edge?.boards[id]?.all.slice(0, 5) ?? [] })).filter((c) => c.list.length);
  return (
    <>
      <h2>Playoff leaders</h2>
      <div className="cols edge-cols">
        {([["points", "Points"], ["goals", "Goals"], ["assists", "Assists"]] as const).map(([key, title]) => (
          <div key={key}>
            <h3>{title}</h3>
            {top(key).map((r, i) => {
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
        {edgeCards.map((c) => (
          <div key={c.id}>
            <h3>{c.title}</h3>
            {c.list.map((e, i) => (
              <Link key={e.id} to={`/player/${e.id}`} className="leader">
                <span className="rank">{i + 1}</span>
                {e.h ? <img className="face" src={headshot(e.h)} width={28} height={28} alt="" loading="lazy" /> : <span className="face ph" style={{ width: 28, height: 28 }} />}
                <span className="leader-name">{e.name}</span><TeamLogo abbrev={e.team} size={18} /><b>{c.fmt(e.value)}</b>
              </Link>
            ))}
          </div>
        ))}
      </div>
      <p className="muted"><Link to="/edge">More playoff Edge data →</Link></p>
    </>
  );
}

export default function StanleyCup() {
  const { season, setSeason, manifest } = useData();
  const [data, setData] = useState<PlayoffBracket | null | undefined>(undefined);
  const [sel, setSel] = useState<string>();
  useEffect(() => {
    let live = true;
    setData(undefined); setSel(undefined);
    fetch(`${base}data/playoffs-${season}.json`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => live && setData(d));
    return () => { live = false; };
  }, [season]);

  const endYear = season % 10000;
  const label = manifest.seasons.find((s) => s.id === season)?.label ?? String(season);
  const picker = (
    <div className="row">{[...manifest.seasons].reverse().map((s) => <Chip key={s.id} active={s.id === season} onClick={() => setSeason(s.id)}>{s.label}</Chip>)}</div>
  );
  if (data === undefined || (data && data.season !== season)) return <section><h1>Stanley Cup</h1><div className="spinner" /></section>;
  if (!data || data.series.length === 0) {
    return (
      <section>
        <div className="row between"><h1>Stanley Cup {endYear}</h1><span className="muted">{label}</span></div>
        {picker}
        <p className="empty">🏒 The {endYear} playoffs haven't started yet. The bracket appears here when the regular season ends{manifest.seasons.length > 1 ? ", and earlier seasons are one tap away above" : ""}.</p>
      </section>
    );
  }
  const by = new Map(data.series.map((s) => [s.letter, s]));
  const col = (letters: string) => [...letters].map((l) => by.get(l));
  const final = by.get("O");
  const champ = final?.winner ? [final.top, final.bottom].find((t) => t?.abbrev === final.winner) : undefined;
  const picked = by.get(sel ?? (final?.games.length ? "O" : ""));
  const columns: [string, number][] = [["ABCD", 0], ["IJ", 1], ["M", 2], ["O", 3], ["N", 2], ["KL", 1], ["EFGH", 0]];
  return (
    <section>
      <div className="row between"><h1>Stanley Cup {endYear}</h1><span className="muted">{label}</span></div>
      {picker}
      {champ && final && (
        <div className="champ"><Watermark abbrev={champ.abbrev} side="right" /><span className="trophy">🏆</span><TeamLogo abbrev={champ.abbrev} size={44} />
          <div><b>{champ.name}</b><br /><small className="muted">{endYear} Stanley Cup champions · won the final {Math.max(final.top?.wins ?? 0, final.bottom?.wins ?? 0)}–{Math.min(final.top?.wins ?? 0, final.bottom?.wins ?? 0)}</small></div>
        </div>
      )}
      <div className="bracket-wrap">
        <div className="bracket">
          {columns.map(([letters, round], i) => (
            <div key={i} className="b-col">
              <h4>{round === 3 ? ROUND_LABEL[3] : `${EAST.has(letters[0]) ? "East" : "West"} · ${ROUND_LABEL[round]}`}</h4>
              <div className="b-list">{col(letters).map((s, j) => <SeriesCard key={j} s={s} on={!!s && s.letter === picked?.letter} pick={() => s && setSel(s.letter)} />)}</div>
            </div>
          ))}
        </div>
      </div>
      {picked && picked.top && picked.bottom && (
        <div className="series-detail">
          <Watermark abbrev={picked.top.abbrev} side="left" /><Watermark abbrev={picked.bottom.abbrev} side="right" />
          <h3><TeamLogo abbrev={picked.top.abbrev} size={26} /> {picked.top.name} <span className="muted">vs</span> <TeamLogo abbrev={picked.bottom.abbrev} size={26} /> {picked.bottom.name}</h3>
          <p className="muted">{picked.title} · {picked.winner ? `${picked.winner} won ${Math.max(picked.top.wins, picked.bottom.wins)}–${Math.min(picked.top.wins, picked.bottom.wins)}` : `${picked.top.abbrev} ${picked.top.wins} – ${picked.bottom.wins} ${picked.bottom.abbrev}`}</p>
          <ul className="g-list">{picked.games.map((g) => <GameRow key={g.id} g={g} />)}</ul>
        </div>
      )}
      {!picked && <p className="muted">Tap a series to see its games.</p>}
      <PlayoffLeaders season={season} />
    </section>
  );
}
