import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Game, Goal, Manifest, NewsItem, PlayerInfo, StandingRow, TeamInfo } from "../../shared/types";

const base = import.meta.env.BASE_URL;
const getJson = async <T,>(name: string): Promise<T> => {
  const r = await fetch(`${base}data/${name}`, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${name}: ${r.status}`);
  return r.json();
};

export interface Dataset {
  manifest: Manifest;
  teams: TeamInfo[];
  standings: StandingRow[];
  players: Record<string, PlayerInfo>;
  news: NewsItem[];
  games: Game[];           // selected season(s)
  goals: Goal[];
  gameById: Map<number, Game>;
  season: number;
  setSeason: (s: number) => void;
  /** Most recent date with played games (<= today) — the app's "today". */
  anchor: string;
  loading: boolean;
}

const Ctx = createContext<Dataset | null>(null);
export const useData = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("no data");
  return v;
};

const seasonCache = new Map<number, Game[]>();

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [boot, setBoot] = useState<{ manifest: Manifest; teams: TeamInfo[]; players: Record<string, PlayerInfo>; news: NewsItem[] } | null>(null);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [error, setError] = useState<string>();
  const [season, setSeasonState] = useState<number>(0);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getJson<Manifest>("manifest.json"), getJson<TeamInfo[]>("teams.json"),
      getJson<Record<string, PlayerInfo>>("players.json"),
      getJson<NewsItem[]>("news.json").catch(() => [] as NewsItem[]),
    ]).then(([manifest, teams, players, news]) => {
      setBoot({ manifest, teams, players, news });
      const saved = Number(localStorage.getItem("season"));
      setSeasonState(manifest.seasons.some((s) => s.id === saved) ? saved : manifest.currentSeason);
    }).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!season) return;
    setLoading(true);
    getJson<StandingRow[]>(`standings-${season}.json`).catch(() => [] as StandingRow[]).then((rows) => setStandings(rows));
    const hit = seasonCache.get(season);
    if (hit) { setGames(hit); setLoading(false); return; }
    getJson<Game[]>(`season-${season}.json`).then((g) => { seasonCache.set(season, g); setGames(g); setLoading(false); });
  }, [season]);

  const value = useMemo<Dataset | null>(() => {
    if (!boot) return null;
    const goals = games.flatMap((g) => g.goals);
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "America/New_York" });
    const played = games.filter((g) => g.state !== "FUT" && g.state !== "PRE" && g.date <= today).map((g) => g.date);
    const anchor = played.length ? played.reduce((a, b) => (a > b ? a : b)) : today;
    return {
      ...boot, standings, games, goals, gameById: new Map(games.map((g) => [g.id, g])), season, anchor, loading,
      setSeason: (s) => { localStorage.setItem("season", String(s)); setSeasonState(s); },
    };
  }, [boot, standings, games, season, loading]);

  if (error) return <div className="center-msg">Could not load data. Run <code>npm run data</code> first.<br /><small>{error}</small></div>;
  if (!value) return <div className="center-msg"><div className="spinner" /></div>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
