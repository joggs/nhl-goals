import { useEffect, useState } from "react";
import type { EdgeData } from "../../shared/types";

const base = import.meta.env.BASE_URL;
export type GameType = "regular" | "playoffs";
const cache = new Map<string, Promise<EdgeData | null>>();

/** Edge leaderboards for one season and game type. undefined while loading, null if missing. */
export function useEdge(season: number, type: GameType): EdgeData | null | undefined {
  const key = `${season}-${type}`;
  const [state, setState] = useState<{ key: string; data: EdgeData | null }>();
  useEffect(() => {
    let live = true;
    let p = cache.get(key);
    if (!p) {
      p = fetch(`${base}data/edge-${season}${type === "playoffs" ? "-po" : ""}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      cache.set(key, p);
    }
    p.then((data) => live && setState({ key, data }));
    return () => { live = false; };
  }, [key, season, type]);
  return state && state.key === key ? state.data : undefined;
}
