import { useCallback, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useData } from "../lib/data";
import { useFavorites, useTheme } from "../lib/favorites";
import { Face, Flag, StarButton, TeamLogo } from "../components/ui";
import { ShotMap } from "../components/ShotMap";
import { tally } from "./Players";
import { useEdge } from "../lib/edge";
import { TEAM_METRICS } from "./Edge";
import { teamColor } from "../lib/teamColors";
import { fmtDate, ordinal } from "../lib/util";

export default function TeamPage() {
  const { abbrev = "" } = useParams();
  const { teams, standings, goals, games, players, season } = useData();
  const { teams: favs } = useFavorites();
  const theme = useTheme();
  const { gameById } = useData();
  const pickFor = useCallback((s: { team: string }) => s.team === abbrev, [abbrev]);
  const pickAgainst = useCallback((s: { team: string; game: number }) => {
    if (s.team === abbrev) return false;
    const g = gameById.get(s.game);
    return !!g && (g.home.abbrev === abbrev || g.away.abbrev === abbrev);
  }, [abbrev, gameById]);
  const edge = useEdge(season, "regular")?.teams[abbrev];
  const team = teams.find((t) => t.abbrev === abbrev);
  const r = standings.find((s) => s.abbrev === abbrev);
  const d = useMemo(() => {
    const gf = goals.filter((g) => g.team === abbrev && !g.ownGoal);
    const ga = goals.filter((g) => g.against === abbrev && !g.ownGoal);
    const period = (list: typeof gf) => [1, 2, 3, 4].map((p) => list.filter((g) => (p === 4 ? g.periodType === "OT" : g.period === p && g.periodType === "REG")).length);
    const played = games.filter((g) => g.finished && (g.home.abbrev === abbrev || g.away.abbrev === abbrev)).sort((a, b) => b.start.localeCompare(a.start));
    return {
      gf, ga, byPeriod: period(gf), byPeriodAgainst: period(ga), played,
      pp: gf.filter((g) => g.strength === "PP").length, sh: gf.filter((g) => g.strength === "SH").length,
      en: gf.filter((g) => g.emptyNet).length, ot: gf.filter((g) => g.periodType === "OT").length,
      hat: gf.filter((g) => g.tags.includes("hattrick")).length,
      players: tally(gf).sort((a, b) => b.points - a.points || b.goals - a.goals).slice(0, 10),
    };
  }, [goals, games, abbrev]);
  if (!team) return <section><h1>Unknown team</h1><Link to="/teams">← All teams</Link></section>;
  const tc = teamColor(abbrev);
  const maxP = Math.max(1, ...d.byPeriod, ...d.byPeriodAgainst);
  const PERIODS = ["1st", "2nd", "3rd", "OT"];
  const wins = d.played.filter((g) => (g.home.abbrev === abbrev ? g.home.score > g.away.score : g.away.score > g.home.score)).length;
  return (
    <section style={{ "--tc": tc.vivid, "--tc2": tc.vivid2 } as React.CSSProperties}>
      <p><Link to="/teams">← All teams</Link></p>
      <div className="team-hero">
        <TeamLogo abbrev={abbrev} size={84} />
        <div className="team-hero-main">
          <h1>{team.name}</h1>
          <p className="muted">{team.division} Division · {team.conference} Conference{r ? ` · ${ordinal(r.divRank)} in division${r.wc > 0 && r.wc <= 2 ? ` · wild card ${r.wc}` : ""}` : ""}</p>
          {r && <p><b>{r.w}-{r.l}-{r.otl}</b> · <b>{r.pts}</b> pts · GF {r.gf} · GA {r.ga} · L10 {r.l10}{r.streak && <> · streak <b>{r.streak}</b></>}</p>}
        </div>
        <div className="team-hero-tools">
          <StarButton abbrev={abbrev} />
          {favs.includes(abbrev) && <button className={`chip theme${theme.team === abbrev ? " on" : ""}`} onClick={() => theme.set(theme.team === abbrev ? undefined : abbrev)} title="Use this team's colours for the whole site">🎨</button>}
        </div>
      </div>
      <p>
        <Link className="chip on" to={`/goals?team=${abbrev}&range=season`}>All goals by {abbrev}</Link>{" "}
        <Link className="chip" to={`/goals?against=${abbrev}&range=season`}>Goals against {abbrev}</Link>
      </p>
      <div className="tiles">
        {([["Goals for", d.gf.length], ["Goals against", d.ga.length], ["Power-play", d.pp], ["Short-handed", d.sh], ["Empty-net", d.en], ["Overtime", d.ot], ["Hat tricks", d.hat], ["Games won", wins]] as const).map(([k, v]) => (
          <div key={k} className="tile"><b>{v}</b><small>{k}</small></div>
        ))}
      </div>
      {edge && (
        <>
          <h2>Edge profile <small className="muted">regular season, rank among 32 teams</small></h2>
          <div className="tiles">
            {TEAM_METRICS.map((m) => (
              <div key={m.key} className="tile" title={m.title}><b>{m.fmt(edge[m.key].value)}</b><small>{m.title}</small><small className="rank-pill">#{edge[m.key].rank}</small></div>
            ))}
          </div>
        </>
      )}
      <div className="cols">
        <div>
          <h3>Goals by period</h3>
          {PERIODS.map((p, i) => (
            <div key={p} className="bar2">
              <span>{p}</span>
              <div><i style={{ width: `${(d.byPeriod[i] / maxP) * 100}%` }} title="scored" /><i className="against" style={{ width: `${(d.byPeriodAgainst[i] / maxP) * 100}%` }} title="allowed" /></div>
              <b>{d.byPeriod[i]}<small className="muted"> / {d.byPeriodAgainst[i]}</small></b>
            </div>
          ))}
          <p className="muted rink-cap"><span className="rink-key" style={{ background: "var(--accent)" }} /> scored · <span className="rink-key against" /> allowed</p>
        </div>
        <div><h3>Where they score</h3><ShotMap goals={d.gf} pick={pickFor} /></div>
        <div><h3>Where they concede</h3><ShotMap goals={d.ga} pick={pickAgainst} /></div>
      </div>
      <h2>Scoring leaders</h2>
      {d.players.length === 0 ? <p className="empty">No goals yet.</p> : (
        <table className="table">
          <thead><tr><th>#</th><th>Player</th><th>P</th><th>G</th><th>A</th><th>PPG</th><th>GWG</th></tr></thead>
          <tbody>
            {d.players.map((p, i) => {
              const info = players[p.id];
              return (
                <tr key={p.id}>
                  <td>{i + 1}</td>
                  <td><Link to={`/player/${p.id}`} className="pl"><Face id={p.id} size={30} /> <Flag code={info?.nat} /> {info?.n ?? p.id}</Link></td>
                  <td><b>{p.points}</b></td><td>{p.goals}</td><td>{p.assists}</td><td>{p.ppg}</td><td>{p.gwg}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <h2>Results</h2>
      {d.played.length === 0 ? <p className="empty">No games played yet.</p> : (
        <ul className="g-list">
          {d.played.slice(0, 12).map((g) => {
            const home = g.home.abbrev === abbrev, me = home ? g.home : g.away, opp = home ? g.away : g.home;
            const won = me.score > opp.score;
            const ext = g.lastPeriod === "SO" ? " (SO)" : g.lastPeriod === "OT" ? " (OT)" : "";
            return (
              <li key={g.id}>
                <Link to={`/game/${g.id}`} className="g-row">
                  <span className={`g-num res ${won ? "w" : "l"}`}>{won ? "W" : "L"}</span><span className="muted">{fmtDate(g.date)}</span>
                  <span>{home ? "vs" : "@"} <TeamLogo abbrev={opp.abbrev} size={18} /> {opp.abbrev}</span><b>{me.score}–{opp.score}</b>{ext}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
