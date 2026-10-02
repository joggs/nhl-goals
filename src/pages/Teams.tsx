import { Link } from "react-router-dom";
import { useData } from "../lib/data";
import { useFavorites } from "../lib/favorites";
import { StarButton, TeamLogo } from "../components/ui";
import { useSpoilers } from "../lib/spoilers";

export default function Teams() {
  const { standings, teams } = useData();
  const { teams: favs } = useFavorites();
  const sp = useSpoilers();
  const divisions = [...new Set(teams.map((t) => t.division ?? ""))].sort();
  const row = (abbrev: string) => standings.find((s) => s.abbrev === abbrev);
  return (
    <section>
      <div className="row between"><h1>Teams</h1><span className="muted">{favs.length ? `${favs.length} favourite${favs.length > 1 ? "s" : ""}` : "Tap ☆ to follow a team"}</span></div>
      {favs.length > 0 && <p><Link className="chip on" to={`/goals?team=${favs.join(",")}&range=month`}>Goals by my teams</Link> <Link className="chip" to="/goals?mine=1&range=week">Goals in my teams' games</Link></p>}
      <div className="divs">
        {divisions.map((d) => (
          <div key={d} className="div">
            <h3>{d}</h3>
            {teams.filter((t) => t.division === d).sort((a, b) => sp.on ? a.name.localeCompare(b.name) : (row(b.abbrev)?.pts ?? 0) - (row(a.abbrev)?.pts ?? 0)).map((t) => {
              const r = row(t.abbrev);
              return (
                <div key={t.abbrev} className={`trow${favs.includes(t.abbrev) ? " fav" : ""}`}>
                  <StarButton abbrev={t.abbrev} />
                  <Link to={`/goals?team=${t.abbrev}&range=month`} className="trow-name"><TeamLogo abbrev={t.abbrev} size={30} /> {t.name}</Link>
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
