import { useEffect, useState } from "react";
import type { NewsItem, PlayerStats } from "../../shared/types";
import { FORGE, toNewsItems } from "../../shared/news";

const base = import.meta.env.BASE_URL;
const statsCache = new Map<string, Promise<PlayerStats | null>>();

const loadStats = (file: string) => {
  let p = statsCache.get(file);
  if (!p) {
    p = fetch(`${base}data/${file}`, { cache: "no-cache" }).then((r) => (r.ok ? (r.json() as Promise<PlayerStats>) : null)).catch(() => null);
    statsCache.set(file, p);
  }
  return p;
};

/** Official season totals of every player, regular season and playoffs. undefined while loading. */
export function useSeasonStats(season: number) {
  const [v, setV] = useState<{ rs: PlayerStats | null; po: PlayerStats | null }>();
  useEffect(() => {
    let live = true;
    setV(undefined);
    Promise.all([loadStats(`stats-${season}.json`), loadStats(`stats-${season}-po.json`)]).then(([rs, po]) => { if (live) setV({ rs, po }); });
    return () => { live = false; };
  }, [season]);
  return v;
}

const newsCache = new Map<number, Promise<NewsItem[] | null>>();

/** Stories NHL.com has tagged with this player, read live (the content API allows it). null if the request failed. */
export function usePlayerNews(pid: number) {
  const [v, setV] = useState<NewsItem[] | null>();
  useEffect(() => {
    let live = true;
    setV(undefined);
    let p = newsCache.get(pid);
    if (!p) {
      p = fetch(`${FORGE}?tags.slug=playerid-${pid}&$limit=30`).then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((r) => toNewsItems(r.items ?? [])).catch(() => { newsCache.delete(pid); return null; });
      newsCache.set(pid, p);
    }
    p.then((items) => { if (live) setV(items); });
    return () => { live = false; };
  }, [pid]);
  return v;
}
