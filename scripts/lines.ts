// Line combinations, derived from NHL shift charts: who is on the ice together, for how long, and what happens then.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { Game, LineUnit, LinesFile, PlayerInfo, TeamLines } from "../shared/types.js";
import { cached, pool, stats, web } from "./lib-nhl.js";

/** [playerId, team, period, start s, end s] */
type Shift = [number, string, number, number, number];
type Kind = "fwd" | "def" | "pp";

const sec = (s: string) => { const [m, x] = s.split(":").map(Number); return m * 60 + x; };

/** Shifts of one game. Finished games are cached; a few games have no shift data at all and are left uncached. */
async function shifts(id: number, finished: boolean): Promise<Shift[]> {
  const file = `.cache/shifts-${id}.json`;
  try { return JSON.parse(await readFile(file, "utf8")); } catch { /* miss */ }
  const r = await stats(`/shiftcharts?cayenneExp=gameId=${id}`);
  const rows: Shift[] = (r.data ?? []).filter((x: any) => x.typeCode === 517 && x.startTime && x.endTime)
    .map((x: any) => [x.playerId, x.teamAbbrev, x.period, sec(x.startTime), sec(x.endTime)]);
  if (finished && rows.length > 200) {
    await mkdir(".cache", { recursive: true });
    await writeFile(file, JSON.stringify(rows));
  }
  return rows;
}

const POS_ORDER: Record<string, number> = { L: 0, C: 1, R: 2 };
const keyOf = (ids: number[]) => [...ids].sort((a, b) => a - b).join(",");

interface Acc { toi: number; gf: number; ga: number; gp: number }
interface TeamAcc {
  units: Record<Kind, Map<string, Acc>>;
  last?: { game: Game; side: 0 | 1; units: Record<Kind, Map<string, number>>; goalie?: number };
  ppRecent: Map<string, number>[];   // power-play seconds per unit, one map per game
  form: Map<number, [number, number][]>; // goals, assists per game played, oldest first
}

/** `wanted`: extra units per team (the projected line-up) whose season numbers should be included. */
export async function loadLines(season: number, games: Game[], players: Map<number, PlayerInfo>, wanted: Record<string, number[][]> = {}): Promise<LinesFile> {
  const pos = (id: number) => players.get(id)?.pos;
  const played = games.filter((g) => g.state !== "FUT" && g.state !== "PRE").sort((a, b) => a.start.localeCompare(b.start));
  const all = await pool(played, 8, async (g) => {
    try { return await shifts(g.id, g.finished); } catch (e) { console.warn(`  shifts ${g.id} failed: ${(e as Error).message}`); return []; }
  });
  const teams = new Map<string, TeamAcc>();
  const team = (abbrev: string) => {
    let t = teams.get(abbrev);
    if (!t) { t = { units: { fwd: new Map(), def: new Map(), pp: new Map() }, ppRecent: [], form: new Map() }; teams.set(abbrev, t); }
    return t;
  };

  played.forEach((game, gi) => {
    const rows = all[gi];
    if (!rows.length) return;
    const abbrevs = [game.away.abbrev, game.home.abbrev];
    const len = Math.max(...rows.map((r) => (r[2] - 1) * 1200 + r[4]));
    // on[side][second] = players on the ice
    const on: number[][][] = [Array.from({ length: len + 1 }, () => []), Array.from({ length: len + 1 }, () => [])];
    for (const [id, abbrev, period, start, end] of rows) {
      const side = abbrevs.indexOf(abbrev);
      if (side < 0) continue;
      const base = (period - 1) * 1200;
      for (let t = base + start; t < base + end; t++) on[side][t].push(id);
    }
    const situation = (side: number, t: number): { kind: Kind; ids: number[] }[] => {
      const me = on[side][t] ?? [], opp = on[1 - side][t] ?? [];
      const sk = me.filter((id) => pos(id) !== "G"), osk = opp.filter((id) => pos(id) !== "G");
      if (sk.length === me.length || osk.length === opp.length) return []; // a net is empty
      if (sk.length === 5 && osk.length === 5) {
        const out: { kind: Kind; ids: number[] }[] = [];
        const f = sk.filter((id) => pos(id) !== "D"), d = sk.filter((id) => pos(id) === "D");
        if (f.length === 3) out.push({ kind: "fwd", ids: f });
        if (d.length === 2) out.push({ kind: "def", ids: d });
        return out;
      }
      if (sk.length > osk.length && sk.length >= 4) return [{ kind: "pp", ids: sk }];
      return [];
    };
    const gameUnits = [0, 1].map(() => ({ fwd: new Map<string, number>(), def: new Map<string, number>(), pp: new Map<string, number>() }));
    for (let t = 0; t <= len; t++) {
      for (const side of [0, 1]) {
        for (const u of situation(side, t)) {
          const m = gameUnits[side][u.kind], k = keyOf(u.ids);
          m.set(k, (m.get(k) ?? 0) + 1);
        }
      }
    }
    const goalFor = new Map<string, number>(), goalAgainst = new Map<string, number>(); // `${side}|${kind}|${key}`
    for (const g of game.goals) {
      const t = Math.max(0, (g.period - 1) * 1200 + sec(g.time) - 1);
      const scorer = abbrevs.indexOf(g.team);
      if (scorer < 0) continue;
      for (const side of [0, 1]) {
        for (const u of situation(side, t)) {
          const k = `${side}|${u.kind}|${keyOf(u.ids)}`, m = side === scorer ? goalFor : goalAgainst;
          m.set(k, (m.get(k) ?? 0) + 1);
        }
      }
    }
    const pts = new Map<number, [number, number]>();
    for (const g of game.goals) {
      const p = pts.get(g.scorer.id) ?? [0, 0]; p[0]++; pts.set(g.scorer.id, p);
      for (const a of g.assists) { const q = pts.get(a.id) ?? [0, 0]; q[1]++; pts.set(a.id, q); }
    }
    for (const side of [0, 1] as const) {
      const acc = team(abbrevs[side]);
      for (const kind of ["fwd", "def", "pp"] as Kind[]) {
        for (const [k, s] of gameUnits[side][kind]) {
          const a = acc.units[kind].get(k) ?? { toi: 0, gf: 0, ga: 0, gp: 0 };
          a.toi += s;
          if (s >= (kind === "pp" ? 20 : 60)) a.gp++;
          a.gf += goalFor.get(`${side}|${kind}|${k}`) ?? 0;
          a.ga += goalAgainst.get(`${side}|${kind}|${k}`) ?? 0;
          acc.units[kind].set(k, a);
        }
      }
      acc.ppRecent.push(gameUnits[side].pp);
      if (acc.ppRecent.length > 5) acc.ppRecent.shift();
      const dressed = new Set(rows.filter((r) => r[1] === abbrevs[side]).map((r) => r[0]));
      const goalieToi = new Map<number, number>();
      for (const [id, abbrev, , start, end] of rows) if (abbrev === abbrevs[side] && pos(id) === "G") goalieToi.set(id, (goalieToi.get(id) ?? 0) + end - start);
      for (const id of dressed) {
        if (pos(id) === "G") continue;
        const f = acc.form.get(id) ?? [];
        f.push(pts.get(id) ?? [0, 0]);
        acc.form.set(id, f.slice(-10));
      }
      acc.last = { game, side, units: gameUnits[side], goalie: [...goalieToi].sort((a, b) => b[1] - a[1])[0]?.[0] };
    }
  });

  const order = (ids: number[], kind: Kind) => (kind === "fwd" ? [...ids].sort((a, b) => (POS_ORDER[pos(a) ?? ""] ?? 1) - (POS_ORDER[pos(b) ?? ""] ?? 1)) : ids);
  // Scratches of each team's latest game (the API has no line-ups, but it does list who sat out).
  const lastGames = [...new Map([...teams.values()].filter((t) => t.last).map((t) => [t.last!.game.id, t.last!.game])).values()];
  const scratches = new Map<number, [number[], number[]]>();
  await pool(lastGames, 4, async (g) => {
    try {
      const info = await cached(`.cache/scratches-${g.id}.json`, g.finished, async () => (await web(`/gamecenter/${g.id}/right-rail`)).gameInfo ?? {});
      scratches.set(g.id, [(info.awayTeam?.scratches ?? []).map((p: any) => p.id), (info.homeTeam?.scratches ?? []).map((p: any) => p.id)]);
    } catch { /* leave unknown */ }
  });
  const out: LinesFile = { season, teams: {} };
  for (const [abbrev, acc] of teams) {
    if (!acc.last) continue;
    const unit = (kind: Kind, k: string, recent: number): LineUnit => {
      const a = acc.units[kind].get(k) ?? { toi: 0, gf: 0, ga: 0, gp: 0 };
      return { ids: order(k.split(",").map(Number), kind), toi: a.toi, gf: a.gf, ga: a.ga, gp: a.gp, recent };
    };
    /** Biggest units first, no player in two of them. */
    const pick = (kind: Kind, times: Map<string, number>, n: number, min: number) => {
      const used = new Set<number>(), outU: LineUnit[] = [];
      for (const [k, s] of [...times].sort((a, b) => b[1] - a[1])) {
        if (outU.length >= n || s < min) break;
        const ids = k.split(",").map(Number);
        if (ids.some((id) => used.has(id))) continue;
        ids.forEach((id) => used.add(id));
        outU.push(unit(kind, k, s));
      }
      return outU;
    };
    const pp = new Map<string, number>();
    for (const m of acc.ppRecent) for (const [k, s] of m) pp.set(k, (pp.get(k) ?? 0) + s);
    const top = (kind: Kind, n: number) => [...acc.units[kind]].sort((a, b) => b[1].toi - a[1].toi).slice(0, n).map(([k]) => unit(kind, k, acc.last!.units[kind].get(k) ?? 0));
    const g = acc.last.game, side = acc.last.side;
    const lines: TeamLines = {
      game: g.id, date: g.date, opp: side === 0 ? g.home.abbrev : g.away.abbrev, home: side === 1, goalie: acc.last.goalie, scratches: scratches.get(g.id)?.[side] ?? [],
      fwd: pick("fwd", acc.last.units.fwd, 4, 60), def: pick("def", acc.last.units.def, 3, 60), pp: pick("pp", pp, 2, 30),
      topFwd: top("fwd", 6), topDef: top("def", 4),
      combos: (wanted[abbrev] ?? []).map((ids) => ({ ids, kind: ids.length === 3 ? "fwd" : ids.length === 2 ? "def" : "pp" } as const))
        .map(({ ids, kind }) => unit(kind, keyOf(ids), acc.last!.units[kind].get(keyOf(ids)) ?? 0)).filter((u) => u.toi > 0),
      form: Object.fromEntries([...acc.form].map(([id, f]) => [id, f])),
    };
    out.teams[abbrev] = lines;
  }
  return out;
}
