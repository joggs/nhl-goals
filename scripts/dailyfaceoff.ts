// Projected line-ups for each team's next game from DailyFaceoff (beat reporters, morning skates, practice).
// The NHL publishes no line-ups. DailyFaceoff has no free API either, so this reads the data its team pages embed,
// at most once every two hours per team, and the app always credits and links the source.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { Lineup, LineupSlot, PlayerInfo, TeamInfo } from "../shared/types.js";
import { pool } from "./lib-nhl.js";

const SITE = "https://www.dailyfaceoff.com";
const UA = "nhl-goals/0.1 (personal project; https://github.com/joggs/nhl-goals)";
const MAX_AGE = 2 * 3600e3;
const GROUPS = new Set(["f1", "f2", "f3", "f4", "d1", "d2", "d3", "pp1", "pp2", "pk1", "pk2", "g", "ir"]);

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
const slugOf = (name: string) => norm(name).replace(/ /g, "-");

async function page(slug: string): Promise<{ at: number; combos: any }> {
  const file = `.cache/dfo-${slug}.json`;
  try {
    const c = JSON.parse(await readFile(file, "utf8"));
    if (Date.now() - c.at < MAX_AGE) return c;
  } catch { /* miss */ }
  const res = await fetch(`${SITE}/teams/${slug}/line-combinations`, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${slug}`);
  const html = await res.text();
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  const combos = m ? JSON.parse(m[1]).props?.pageProps?.combinations : undefined;
  if (!combos?.players) throw new Error(`no line-up data for ${slug}`);
  const out = { at: Date.now(), combos };
  await mkdir(".cache", { recursive: true });
  await writeFile(file, JSON.stringify(out));
  return out;
}

export async function loadLineups(teams: TeamInfo[], players: Map<number, PlayerInfo>): Promise<Record<string, Lineup>> {
  const out: Record<string, Lineup> = {};
  // League-wide fallback for players whose latest game was for another team (trades, call-ups). Unique names only.
  const anywhere = new Map<string, number | null>();
  for (const [id, p] of players) { const n = norm(p.n); anywhere.set(n, anywhere.has(n) ? null : id); }
  await pool(teams, 2, async (t) => {
    const slug = slugOf(t.name);
    try {
      const { combos } = await page(slug);
      // DailyFaceoff has its own player ids; match on the name among the team's players, then on the surname alone.
      const roster = [...players].filter(([, p]) => p.t === t.abbrev);
      const byName = new Map(roster.map(([id, p]) => [norm(p.n), id]));
      const bySurname = new Map<string, number | null>();
      for (const [id, p] of roster) { const s = norm(p.n).split(" ").slice(1).join(" "); bySurname.set(s, bySurname.has(s) ? null : id); }
      const groups: Record<string, LineupSlot[]> = {};
      for (const p of combos.players as any[]) {
        if (!GROUPS.has(p.groupIdentifier)) continue;
        const n = norm(p.name);
        const id = byName.get(n) ?? bySurname.get(n.split(" ").slice(1).join(" ")) ?? anywhere.get(n) ?? undefined;
        const slot: LineupSlot = { name: p.name, pos: p.positionIdentifier, ...(id ? { id } : {}), ...(p.gameTimeDecision ? { gtd: true } : {}), ...(p.injuryStatus ? { injury: String(p.injuryStatus) } : {}) };
        (groups[p.groupIdentifier] ??= []).push(slot);
      }
      const rank = (pos: string) => { const i = ["lw", "c", "rw", "ld", "rd"].indexOf(pos); return i >= 0 ? i : 10 + Number(pos.replace(/\D/g, "") || 0); };
      for (const g of Object.values(groups)) g.sort((a, b) => rank(a.pos) - rank(b.pos));
      out[t.abbrev] = {
        url: `${SITE}/teams/${slug}/line-combinations`, updated: combos.updatedAt,
        ...(combos.sourceName ? { reporter: String(combos.sourceName) } : {}), ...(combos.source ? { sourceUrl: String(combos.source) } : {}),
        groups,
      };
    } catch (e) { console.warn(`  line-up ${t.abbrev} failed: ${(e as Error).message}`); }
  });
  return out;
}
