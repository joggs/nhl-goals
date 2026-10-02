import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "../lib/data";
import { useFavorites } from "../lib/favorites";
import { Face, TeamLogo } from "../components/ui";
import { ordinal } from "../lib/util";
import { useSpoilers } from "../lib/spoilers";
import { teamColor } from "../lib/teamColors";

const CONFERENCES = [["Eastern", ["Atlantic", "Metropolitan"]], ["Western", ["Central", "Pacific"]]] as const;

export default function Teams() {
  const { standings, teams, goals, manifest, season } = useData();
  const { teams: favs } = useFavorites();
  const sp = useSpoilers();
  const live = season === manifest.currentSeason;
  const stats = useMemo(() => {
    const m = new Map<string, { gf: number; pp: number; scorers: Map<number, { name: string; n: number }> }>();
    for (const g of goals) {
      const t = m.get(g.team) ?? { gf: 0, pp: 0, scorers: new Map() };
      t.gf++; if (g.strength === "PP") t.pp++;
      const s = t.scorers.get(g.scorer.id) ?? { name: g.scorer.name, n: 0 };
      s.n++; t.scorers.set(g.scorer.id, s);
      m.set(g.team, t);
    }
    return m;
  }, [goals]);
  const row = (abbrev: string) => standings.find((s) => s.abbrev === abbrev);
  return (
    <section>
      <div className="row between"><h1>Teams</h1><span className="muted">{favs.length ? `${favs.length} favourite${favs.length > 1 ? "s" : ""}` : "Open a team, tap ☆ to follow it"}</span></div>
      {favs.length > 0 && <p><Link className="chip on" to={`/goals?team=${favs.join(",")}&range=month`}>Goals by my teams</Link> <Link className="chip" to="/goals?mine=1&range=week">Goals in my teams' games</Link></p>}
      {CONFERENCES.map(([conf, divs]) => (
        <div key={conf}>
          <h2>{conf} Conference</h2>
          {divs.map((d) => (
            <div key={d}>
              <h3>{d}</h3>
              <div className="team-grid">
                {teams.filter((t) => t.division === d)
                  .sort((a, b) => (sp.pagesOk && live ? (row(a.abbrev)?.divRank ?? 9) - (row(b.abbrev)?.divRank ?? 9) : a.name.localeCompare(b.name)))
                  .map((t) => {
                    const r = row(t.abbrev), st = stats.get(t.abbrev);
                    const top = st && [...st.scorers.entries()].sort((x, y) => y[1].n - x[1].n)[0];
                    return (
                      <Link key={t.abbrev} to={`/team/${t.abbrev}`} className={`team-card${favs.includes(t.abbrev) ? " fav" : ""}`} style={{ "--tc": teamColor(t.abbrev).vivid, "--tc2": teamColor(t.abbrev).vivid2 } as React.CSSProperties}>
                        <TeamLogo abbrev={t.abbrev} size={54} />
                        <div className="team-card-main">
                          <b>{t.name}</b>
                          {sp.pagesOk ? (
                            <>
                              {live && r && <small className="muted">{r.w}-{r.l}-{r.otl} · {r.pts} pts · {ordinal(r.divRank)} in {t.division}</small>}
                              {top && <small className="team-top"><Face id={top[0]} size={20} /> {top[1].name} <b>{top[1].n}</b></small>}
                            </>
                          ) : <small className="muted">Results hidden</small>}
                        </div>
                        {favs.includes(t.abbrev) && <span className="team-fav" aria-label="Favourite">★</span>}
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      ))}
      {!sp.pagesOk && <p className="muted">Records and scorers are hidden while spoiler mode is on. Open a team to reveal them.</p>}
    </section>
  );
}
