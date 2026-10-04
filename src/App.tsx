import { Component, useEffect, useRef } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { HashRouter, NavLink, Route, Routes, Link, useLocation } from "react-router-dom";
import { DataProvider, useData } from "./lib/data";
import { useFavorites, useTheme } from "./lib/favorites";
import { teamColor } from "./lib/teamColors";
import { TeamLogo } from "./components/ui";
import Scores from "./pages/Scores";
import GamePage from "./pages/GamePage";
import Goals from "./pages/Goals";
import { Players, PlayerPage } from "./pages/Players";
import Nations from "./pages/Nations";
import Highlights from "./pages/Highlights";
import Teams from "./pages/Teams";
import Standings from "./pages/Standings";
import StanleyCup from "./pages/StanleyCup";
import Edge from "./pages/Edge";
import TeamPage from "./pages/TeamPage";
import { SpoilerGate, useSpoilers } from "./lib/spoilers";

function Shell() {
  const navRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  // On small screens the menu scrolls sideways: keep the current page's tab in view.
  useEffect(() => {
    const el = navRef.current, on = el?.querySelector<HTMLElement>("a.on");
    if (el && on) el.scrollTo({ left: on.offsetLeft - el.clientWidth / 2 + on.clientWidth / 2, behavior: "smooth" });
  }, [pathname]);
  const { manifest, season, setSeason } = useData();
  const { teams } = useFavorites();
  const sp = useSpoilers();
  const theme = useTheme();
  useEffect(() => {
    const r = document.documentElement.style;
    const vars = ["--accent", "--accent2", "--bg-a", "--bg-b"];
    if (!theme.team) { vars.forEach((v) => r.removeProperty(v)); return; }
    const c = teamColor(theme.team);
    r.setProperty("--accent", c.vivid);
    r.setProperty("--accent2", c.vivid2);
    r.setProperty("--bg-a", `color-mix(in srgb, ${c.vivid} 26%, #0b0e14)`);
    r.setProperty("--bg-b", `color-mix(in srgb, ${c.vivid2} 20%, #0b0e14)`);
  }, [theme.team]);
  const nav = [["/", "Scores"], ["/goals", "Goals"], ["/assists", "Assists"], ["/highlights", "Highlights"], ["/players", "Players"], ["/nations", "Nations"], ["/standings", "Standings"], ["/stanley-cup", "Stanley Cup"], ["/edge", "Edge"], ["/teams", "Teams"]] as const;
  return (
    <>
      <header className="top">
        <Link to="/" className="brand"><span className="lamp" />Goalfeed</Link>
        <nav ref={navRef}>{nav.map(([to, l]) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "on" : "")}>{l}</NavLink>)}</nav>
        <div className="top-right">
          <button className={`chip spoil${sp.on ? " on" : ""}`} onClick={() => sp.setOn(!sp.on)} title="Hide results until you reveal them">{sp.on ? "🙈 Spoilers hidden" : "👁 Spoilers shown"}</button>
          <span className="favs">{teams.slice(0, 4).map((t) => <TeamLogo key={t} abbrev={t} size={20} />)}</span>
          {manifest.seasons.length > 1 && (
            <select value={season} onChange={(e) => setSeason(Number(e.target.value))} aria-label="Season">
              {[...manifest.seasons].reverse().map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          )}
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Scores />} />
          <Route path="/game/:id" element={<GamePage />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/assists" element={<Goals assists />} />
          <Route path="/highlights" element={<SpoilerGate><Highlights /></SpoilerGate>} />
          <Route path="/players" element={<SpoilerGate><Players /></SpoilerGate>} />
          <Route path="/player/:id" element={<SpoilerGate><PlayerPage /></SpoilerGate>} />
          <Route path="/nations" element={<SpoilerGate><Nations /></SpoilerGate>} />
          <Route path="/standings" element={<SpoilerGate><Standings /></SpoilerGate>} />
          <Route path="/stanley-cup" element={<SpoilerGate><StanleyCup /></SpoilerGate>} />
          <Route path="/edge" element={<Edge />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/team/:abbrev" element={<SpoilerGate><TeamPage /></SpoilerGate>} />
        </Routes>
      </main>
      <footer>{sp.on && <button className="linkbtn" onClick={sp.hideAgain}>Hide all revealed results again</button>}<br />Data: unofficial NHL web API · updated {new Date(manifest.updated).toLocaleString("en-GB")} · not affiliated with the NHL</footer>
    </>
  );
}

/** Without this a render error unmounts the whole app and the page just goes blank. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(error, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="center-msg">
        <h2>Something went wrong</h2>
        <p className="muted">{this.state.error.message}</p>
        <p><a href={import.meta.env.BASE_URL}>Back to start</a> · <button className="linkbtn" onClick={() => location.reload()}>Reload</button></p>
      </div>
    );
  }
}

export default function App() {
  return <HashRouter><ErrorBoundary><DataProvider><Shell /></DataProvider></ErrorBoundary></HashRouter>;
}
