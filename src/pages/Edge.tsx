import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { EdgeBoardId, EdgeEntry, EdgePos, EdgeTeamMetric } from "../../shared/types";
import { useData } from "../lib/data";
import { Chip, TeamLogo } from "../components/ui";
import { headshot } from "../lib/util";
import { useEdge, type GameType } from "../lib/edge";
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

export const TEAM_METRICS: { key: EdgeTeamMetric; label: string; title: string; fmt: (v: number) => string }[] = [
  { key: "shotSpeed", label: "Shot", title: "Hardest shot (mph)", fmt: (v) => v.toFixed(1) },
  { key: "speed", label: "Speed", title: "Top skating speed (mph)", fmt: (v) => v.toFixed(1) },
  { key: "burst22", label: "22+", title: "Bursts over 22 mph", fmt: (v) => v.toFixed(0) },
  { key: "distance", label: "Miles", title: "Distance skated (miles)", fmt: (v) => v.toFixed(0) },
  { key: "zoneOff", label: "O-zone", title: "Offensive-zone time (%)", fmt: (v) => `${v.toFixed(1)}%` },
  { key: "shots", label: "SOG", title: "Shots on goal", fmt: (v) => v.toFixed(0) },
  { key: "shootPct", label: "Sh%", title: "Shooting percentage", fmt: (v) => `${v.toFixed(1)}%` },
];

export default function Edge() {
  const { season, setSeason, manifest } = useData();
  const [type, setType] = useState<GameType>("regular");
  const [pos, setPos] = useState<EdgePos>("all");
  const [sort, setSort] = useState<EdgeTeamMetric>("zoneOff");
  const data = useEdge(season, type);
  const label = manifest.seasons.find((s) => s.id === season)?.label ?? String(season);
  const teams = useMemo(() => Object.entries(data?.teams ?? {}).sort((a, b) => (a[1][sort]?.rank || 99) - (b[1][sort]?.rank || 99)), [data, sort]);
  return (
    <section>
      <div className="row between"><h1>Edge leaderboards</h1><span className="muted">{label} · {type === "regular" ? "regular season" : "playoffs"}</span></div>
      <p className="muted">Player tracking from the NHL's puck and player sensors: how fast, how hard and how far.</p>
      <div className="row">
        <Chip active={type === "regular"} onClick={() => setType("regular")}>Regular season</Chip>
        <Chip active={type === "playoffs"} onClick={() => setType("playoffs")}>Playoffs</Chip>
        <span className="sep" />
        {(["all", "F", "D"] as const).map((p) => <Chip key={p} active={pos === p} onClick={() => setPos(p)}>{p === "all" ? "All skaters" : p === "F" ? "Forwards" : "Defencemen"}</Chip>)}
        <span className="sep" />
        {[...manifest.seasons].reverse().map((s) => <Chip key={s.id} active={s.id === season} onClick={() => setSeason(s.id)}>{s.label}</Chip>)}
      </div>
      {data === undefined ? <div className="spinner" /> : !data ? <p className="empty">No Edge data for this season.</p> : (
        <>
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
          <h2>Teams</h2>
          {teams.length === 0 ? <p className="empty">No team data yet.</p> : (
            <table className="table sortable edge-teams">
              <thead>
                <tr>
                  <th>#</th><th>Team</th>
                  {TEAM_METRICS.map((m) => (
                    <th key={m.key} title={m.title} aria-sort={sort === m.key ? "ascending" : "none"}>
                      <button className={`th-sort${sort === m.key ? " on" : ""}`} onClick={() => setSort(m.key)}>{m.label}{sort === m.key && <span aria-hidden="true"> ▲</span>}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teams.map(([abbrev, t], i) => (
                  <tr key={abbrev}>
                    <td>{i + 1}</td>
                    <td><Link to={`/team/${abbrev}`} className="pl"><TeamLogo abbrev={abbrev} size={22} /> {abbrev}</Link></td>
                    {TEAM_METRICS.map((m) => <td key={m.key}>{m.fmt(t[m.key].value)} <small className="muted">#{t[m.key].rank}</small></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}
