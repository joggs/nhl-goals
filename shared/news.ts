// NHL.com's content API (stories), shared by the build pipeline and the player page, which reads it live (it sends CORS headers).
import type { NewsCat, NewsItem } from "./types.js";

export const FORGE = "https://forge-dapi.d3.nhle.com/v2/content/en-us/stories";

export const newsCat = (slugs: Set<string>): NewsCat =>
  slugs.has("injury") ? "injury"
  : ["trade", "transactions", "signing", "press-release", "waivers"].some((t) => slugs.has(t)) ? "transactions"
  : ["game-recap", "postgame", "game-coverage"].some((t) => slugs.has(t)) ? "recap"
  : ["game-preview", "pregame", "lineup", "season-preview"].some((t) => slugs.has(t)) ? "preview"
  : "other";

/** Raw stories to NewsItems, newest first. Team-site copies of the same story are merged; NHL.com's own copy wins. */
export function toNewsItems(stories: any[], adjust?: (item: NewsItem) => void): NewsItem[] {
  const best = new Map<string, { item: NewsItem; nhl: boolean }>();
  for (const s of stories) {
    const key = String(s.headline ?? "").trim().toLowerCase();
    if (!s.contentDate || !s.slug || !key) continue;
    const tags: any[] = s.tags ?? [];
    const slugs = new Set<string>(tags.map((t) => t.slug));
    const ids = tags.filter((t) => t.externalSourceName === "player").map((t) => Number(t.extraData?.playerId)).filter(Boolean);
    const teams = tags.filter((t) => t.externalSourceName === "team").map((t) => t.extraData?.abbreviation).filter(Boolean) as string[];
    const game = tags.find((t) => t.slug.startsWith("gameid-"))?.slug.slice(7);
    const item: NewsItem = { id: s.slug, date: s.contentDate, headline: String(s.headline).trim(), cat: newsCat(slugs), teams, players: ids, ...(game ? { gameId: Number(game) } : {}) };
    adjust?.(item);
    const nhl = slugs.has("nhl-created"), old = best.get(key);
    if (!old || (nhl && !old.nhl)) best.set(key, { item, nhl });
  }
  return [...best.values()].map((b) => b.item).sort((a, b) => b.date.localeCompare(a.date));
}
