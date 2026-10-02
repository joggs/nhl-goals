import { useEffect, useState } from "react";
import type { ShotFile } from "../../shared/types";

export type ShotKind = 0 | 1 | 2 | 3; // saved, missed, blocked, goal
export interface Shot { game: number; player: number; team: string; x: number; y: number; kind: ShotKind; strength: 0 | 1 | 2; period: number; sec: number; type?: string }

const base = import.meta.env.BASE_URL;
const cache = new Map<number, Promise<Shot[] | null>>();

/** Every shot attempt of a season (about 160k, 1 MB gzipped), loaded on demand and decoded once. */
export function loadShots(season: number): Promise<Shot[] | null> {
  let p = cache.get(season);
  if (!p) {
    p = fetch(`${base}data/shots-${season}.json`, { cache: "no-cache" }).then((r) => (r.ok ? (r.json() as Promise<ShotFile>) : null)).then((f) => {
      if (!f) return null;
      // Older files had seven numbers per shot and no time or type; the file says which it is.
      const STRIDE = f.stride ?? 7, types = f.types ?? [];
      const out: Shot[] = new Array(Math.floor(f.shots.length / STRIDE));
      for (let i = 0, j = 0; i < f.shots.length; i += STRIDE, j++) {
        const s = f.shots;
        out[j] = { game: f.games[s[i]], player: s[i + 1], team: f.teams[s[i + 2]], x: s[i + 3], y: s[i + 4], kind: s[i + 5] as ShotKind, strength: s[i + 6] as 0 | 1 | 2, period: STRIDE > 7 ? s[i + 7] : 1, sec: STRIDE > 7 ? s[i + 8] : 0, type: STRIDE > 7 && s[i + 9] >= 0 ? types[s[i + 9]] : undefined };
      }
      return out;
    }).catch(() => null);
    cache.set(season, p);
  }
  return p;
}

/** undefined while loading, null if the season has no shot file. Pass enabled=false to not fetch yet. */
export function useShots(season: number, enabled: boolean): Shot[] | null | undefined {
  const [state, setState] = useState<{ season: number; shots: Shot[] | null }>();
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadShots(season).then((shots) => live && setState({ season, shots }));
    return () => { live = false; };
  }, [season, enabled]);
  return state && state.season === season ? state.shots : undefined;
}
