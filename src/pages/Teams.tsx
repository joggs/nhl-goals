import { Link } from "react-router-dom";
import { useData } from "../lib/data";
import { useFavorites, useTheme } from "../lib/favorites";
import { StarButton, TeamLogo } from "../components/ui";
import { useSpoilers } from "../lib/spoilers";
import { teamColor } from "../lib/teamColors";

export default function Teams() {
  const { standings, teams } = useData();
  const { teams: favs } = useFavorites();
  const sp = useSpoilers();
  const theme = useTheme();
  const divisions = [...new Set(teams.map((t) => t.division ?? ""))].sort();
  const row = (abbrev: string) => standings.find((s) => s.abbrev === abbrev);
  return (
    <section>
      <div className="row between"><h1>Teams</h1><span className="muted">{favs.length ? `${favs.length} favourite${favs.length > 1 ? "s" : ""}` : "Tap ☆ to follow a team"}</span></div>
      {theme.team && <p className="muted">Theme: {theme.team} · <button className="linkbtn" onClick={() => theme.set(undefined)}>reset</button></p>}
      {favs.length > 0 && <p><Link className="chip on" to={`/goals?team=${favs.join(",")}&range=month`}>Goals by my teams</Link> <Link className="chip" to="/goals?mine=1&range=week">Goals in my teams' games</Link></p>}
      <div className="divs">
        {divisions.map((d) => (
          <div key={d} className="div">
            <h3>{d}</h3>
            {teams.filter((t) => t.division === d).sort((a, b) => sp.on ? a.name.localeCompare(b.name) : (row(b.abbrev)?.pts ?? 0) - (row(a.abbrev)?.pts ?? 0)).map((t) => {
              const r = row(t.abbrev);
              return (
                <div key={t.abbrev} className={`trow${favs.includes(t.abbrev) ? " fav" : ""}`} style={{ "--tc": teamColor(t.abbrev).vivid } as React.CSSProperties}>
                  <StarButton abbrev={t.abbrev} />
                  <Link to={`/goals?team=${t.abbrev}&range=month`} className="trow-name"><TeamLogo abbrev={t.abbrev} size={30} /> {t.name}</Link>
                  {favs.includes(t.abbrev) && <button className={`chip theme${theme.team === t.abbrev ? " on" : ""}`} onClick={() => theme.set(theme.team === t.abbrev ? undefined : t.abbrev)} title="Use this team's colours for the whole site">🎨</button>}
                  <span className="rec">{r && !sp.on ? `${r.w}-${r.l}-${r.otl}` : ""}</span><b>{sp.on ? "" : r?.pts ?? ""}</b>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
