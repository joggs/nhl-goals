import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { EdgeBoardId, EdgeData, EdgeEntry, EdgePos } from "../../shared/types";
import { useData } from "../lib/data";
import { Chip, TeamLogo } from "../components/ui";
import { headshot } from "../lib/util";

const base = import.meta.env.BASE_URL;
const BOARDS: { id: EdgeBoardId; title: string; blurb: string; fmt: (v: number) => string }[] = [
  { id: "speed", title: "⚡ Fastest skaters", blurb: "Top skating speed in a single burst", fmt: (v) => `${v.toFixed(1)} mph` },
  { id: "shot", title: "🎯 Hardest shots", blurb: "Fastest shot of the season", fmt: (v) => `${v.toFixed(1)} mph` },
  { id: "distance", title: "🏃 Most distance skated", blurb: "Miles skated over the season", fmt: (v) => `${v.toFixed(0)} mi` },
  { id: "zone", title: "🔥 Most time in the offensive zone", blurb: "Share of ice time spent attacking", fmt: (v) => `${v.toFixed(1)}%` },
];

function Row({ e, i, fmt }: { e: EdgeEntry; i: number; fmt: (v: number) => string }) {
  const h = e.h ? headshot(e.h) : undefined;
  return (
    <Link to={`/player/${e.id}`} className="leader edge-row">
      <span className="rank">{i + 1}</span>
      {h ? <img className="face" src={h} width={34} height={34} alt="" loading="lazy" /> : <span className="face ph" style={{ width: 34, height: 34 }} />}
      <span className="leader-name">
        {e.name} <small className="muted">{e.pos}</small>
        {(e.sub || e.when) && <small className="edge-sub">{[e.sub, e.when].filter(Boolean).join(" · ")}</small>}
      </span>
      <TeamLogo abbrev={e.team} size={18} />
      <b>{fmt(e.value)}</b>
    </Link>
  );
}

export default function Edge() {
  const { season, setSeason, manifest } = useData();
  const [data, setData] = useState<EdgeData | null | undefined>(undefined);
  const [pos, setPos] = useState<EdgePos>("all");
  useEffect(() => {
    let live = true;
    setData(undefined);
    fetch(`${base}data/edge-${season}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => live && setData(d));
    return () => { live = false; };
  }, [season]);
  const label = manifest.seasons.find((s) => s.id === season)?.label ?? String(season);
  return (
    <section>
      <div className="row between"><h1>Edge leaderboards</h1><span className="muted">{label} · regular season</span></div>
      <p className="muted">Player tracking from the NHL's puck and player sensors: how fast, how hard and how far.</p>
      <div className="row">
        {(["all", "F", "D"] as const).map((p) => <Chip key={p} active={pos === p} onClick={() => setPos(p)}>{p === "all" ? "All skaters" : p === "F" ? "Forwards" : "Defencemen"}</Chip>)}
        <span className="sep" />
        {[...manifest.seasons].reverse().map((s) => <Chip key={s.id} active={s.id === season} onClick={() => setSeason(s.id)}>{s.label}</Chip>)}
      </div>
      {data === undefined || (data && data.season !== season) ? <div className="spinner" /> : !data ? <p className="empty">No Edge data for this season.</p> : (
        <div className="cols edge-cols">
          {BOARDS.map((b) => {
            const rows = data.boards[b.id]?.[pos] ?? [];
            return (
              <div key={b.id}>
                <h3>{b.title}</h3>
                <p className="muted edge-blurb">{b.blurb}</p>
                {rows.length ? rows.map((e, i) => <Row key={e.id} e={e} i={i} fmt={b.fmt} />) : <p className="empty">Nothing yet.</p>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
