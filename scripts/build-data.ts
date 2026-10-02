/**
 * Builds the static dataset the web app reads (public/data/*.json).
 *
 *   npm run data                       current season only
 *   npm run data -- --with-previous    current + previous season (what CI builds)
 *   npm run data -- --seasons 20252026,20262027
 *
 * Sources (all unauthenticated, no CORS => that's why this runs server-side):
 *   api-web.nhle.com/v1  schedule, gamecenter play-by-play + landing, standings
 *   api.nhle.com/stats/rest/en  skater/goalie bios (nationality), country names
 * Finished games are cached in .cache/ and never re-fetched.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { EdgeBoardId, EdgeData, EdgeEntry, EdgePos, EdgeStat, EdgeTeam, ShotFile, Game, Goal, Manifest, PlayerInfo, PlayoffBracket, PlayoffGame, PlayoffSeries, StandingRow, Star, TeamInfo } from "../shared/types.js";
import { describeGoal, describeLocation, distanceToNet, normalise, parseSituation } from "../shared/describe.js";
import { cached, pool, stats, web } from "./lib-nhl.js";

const OUT = "public/data";
const args = process.argv.slice(2);
const seasonIdx = args.indexOf("--seasons");
const seasonArg = seasonIdx >= 0 ? args[seasonIdx + 1] : undefined;

const isoToday = () => new Date().toISOString().slice(0, 10);

async function currentSeasonId(): Promise<number> {
  const s = await web("/schedule/now");
  const first = s.gameWeek?.flatMap((d: any) => d.games)?.[0];
  if (first?.season) return first.season;
  const y = new Date().getUTCFullYear();
  return new Date().getUTCMonth() >= 8 ? y * 10000 + y + 1 : (y - 1) * 10000 + y;
}

interface SchedGame { id: number; date: string }

/** Walk the weekly schedule from the season's start to its end (or today). */
async function seasonGames(season: number): Promise<SchedGame[]> {
  const startYear = Math.floor(season / 10000);
  let date = `${startYear}-09-15`;
  const end = new Date().toISOString().slice(0, 10);
  const seen = new Map<number, SchedGame>();
  const last = `${startYear + 1}-07-15`;
  for (let guard = 0; guard < 60 && date <= last; guard++) {
    const wk = await web(`/schedule/${date}`);
    for (const day of wk.gameWeek ?? []) {
      for (const g of day.games ?? []) {
        if (g.season !== season || (g.gameType !== 2 && g.gameType !== 3)) continue;
        seen.set(g.id, { id: g.id, date: day.date });
      }
    }
    const next = wk.nextStartDate;
    if (!next || next <= date) break;
    if (next > end) break; // nothing played beyond today needed
    date = next;
  }
  return [...seen.values()].sort((a, b) => a.id - b.id);
}

const nm = (p: any) => `${p.firstName?.default ?? ""} ${p.lastName?.default ?? ""}`.trim();

const teamIds = new Map<string, number>();
const SHOT_KIND: Record<string, number> = { "shot-on-goal": 0, "missed-shot": 1, "blocked-shot": 2, goal: 3 };

/** Appends every shot attempt of one game (shootouts excluded) to the season's flat shot list. */
function collectShots(gameId: number, plays: any[], away: any, home: any, roster: Map<number, { teamId: number }>, sink: ShotFile) {
  const gi = sink.games.push(gameId) - 1;
  for (const p of plays) {
    const kind = SHOT_KIND[p.typeDescKey];
    const d = p.details;
    if (kind === undefined || !d || p.periodDescriptor?.periodType === "SO") continue;
    if (typeof d.xCoord !== "number" || typeof d.yCoord !== "number" || !p.homeTeamDefendingSide) continue;
    const pid: number | undefined = d.shootingPlayerId ?? d.scoringPlayerId;
    if (!pid || (roster.get(pid) && roster.get(pid)!.teamId !== d.eventOwnerTeamId)) continue; // skips own goals
    const owner = d.eventOwnerTeamId === home.id ? home : away;
    const ownerIsHome = owner === home;
    const pos = normalise(d.xCoord, d.yCoord, ownerIsHome, p.homeTeamDefendingSide);
    let ti = sink.teams.indexOf(owner.abbrev);
    if (ti < 0) ti = sink.teams.push(owner.abbrev) - 1;
    const st = parseSituation(p.situationCode, ownerIsHome).strength;
    sink.shots.push(gi, pid, ti, Math.round(pos.x), Math.round(pos.y), kind, st === "PP" ? 1 : st === "SH" ? 2 : 0);
  }
}

async function loadGame(sg: SchedGame, players: Map<number, PlayerInfo>, shots: ShotFile): Promise<Game | null> {
  const landing = await cached(`.cache/landing-${sg.id}.json`, false, () => web(`/gamecenter/${sg.id}/landing`));
  const state: string = landing.gameState;
  const finished = state === "OFF" || state === "FINAL";
  const live = state === "LIVE" || state === "CRIT";
  const fut = state === "FUT" || state === "PRE";
  const away = landing.awayTeam, home = landing.homeTeam;
  teamIds.set(away.abbrev, away.id); teamIds.set(home.abbrev, home.id);

  const base: Game = {
    id: sg.id, season: landing.season, type: landing.gameType, date: sg.date, start: landing.startTimeUTC,
    state, finished, venue: landing.venue?.default,
    away: { abbrev: away.abbrev, name: away.commonName?.default ?? away.abbrev, score: away.score ?? 0, sog: away.sog },
    home: { abbrev: home.abbrev, name: home.commonName?.default ?? home.abbrev, score: home.score ?? 0, sog: home.sog },
    lastPeriod: "REG", otPeriods: 0, goals: [], stars: [],
  };
  if (fut) return base;

  // Only finished games are cached on disk; live ones are refetched each run.
  const pbp = await cached(`.cache/pbp-${sg.id}.json`, finished, () => web(`/gamecenter/${sg.id}/play-by-play`));
  const fresh = finished ? await cached(`.cache/landing-${sg.id}.json`, true, () => web(`/gamecenter/${sg.id}/landing`)) : landing;
  // (the first landing call above was uncached; this stores the final version)

  const roster = new Map<number, { teamId: number; name: string; pos: string; head?: string; last: string; first: string }>();
  for (const r of pbp.rosterSpots ?? []) {
    roster.set(r.playerId, { teamId: r.teamId, name: nm(r), pos: r.positionCode, head: r.headshot, last: r.lastName?.default ?? "", first: r.firstName?.default ?? "" });
    const t = r.teamId === away.id ? away.abbrev : home.abbrev;
    const prev = players.get(r.playerId) ?? { n: nm(r) };
    prev.n = nm(r); prev.pos = r.positionCode; prev.t = t;
    if (r.headshot) prev.h = String(r.headshot).split("/mugs/nhl/")[1];
    players.set(r.playerId, prev);
  }
  const teamById = (id: number) => (id === away.id ? away : home);

  // goalModifier lives in landing.summary.scoring
  const modByEvent = new Map<number, { mod: string; clipUrl?: string }>();
  for (const per of fresh.summary?.scoring ?? [])
    for (const g of per.goals ?? []) modByEvent.set(g.eventId, { mod: g.goalModifier, clipUrl: g.highlightClipSharingUrl });

  const plays = (pbp.plays ?? []) as any[];
  collectShots(sg.id, plays, away, home, roster, shots);
  const goalPlays = plays.filter((p) => p.typeDescKey === "goal").sort((a, b) => a.sortOrder - b.sortOrder);
  const shootout = goalPlays.some((p) => p.periodDescriptor?.periodType === "SO");
  const regGoals = goalPlays.filter((p) => p.periodDescriptor?.periodType !== "SO");

  const lastDesc = pbp.periodDescriptor ?? landing.periodDescriptor;
  base.lastPeriod = shootout || lastDesc?.periodType === "SO" ? "SO" : lastDesc?.periodType === "OT" ? "OT" : "REG";
  base.otPeriods = Math.max(0, ...plays.map((p) => (p.periodDescriptor?.periodType === "OT" ? p.periodDescriptor.number - 3 : 0)));
  if (finished) base.periodsLabel = base.lastPeriod === "SO" ? "SO" : base.lastPeriod === "OT" ? (base.otPeriods > 1 && base.type === 3 ? `${base.otPeriods}OT` : "OT") : "";

  const finalAway = away.score ?? 0, finalHome = home.score ?? 0;
  const winnerIsHome = finalHome > finalAway;
  const loserFinal = Math.min(finalAway, finalHome);
  const goalsByPlayerInGame = new Map<number, number>();
  let n = 0;
  for (const p of regGoals) {
    const d = p.details ?? {};
    const sid: number | undefined = d.scoringPlayerId;
    if (!sid) continue;
    n++;
    const owner = teamById(d.eventOwnerTeamId);
    const ownerIsHome = owner === home;
    const against = ownerIsHome ? away : home;
    const sr = roster.get(sid);
    const ownGoal = !!sr && sr.teamId !== d.eventOwnerTeamId;
    const sit = parseSituation(p.situationCode, ownerIsHome);
    const mod = modByEvent.get(p.eventId)?.mod;
    const emptyNet = sit.emptyNet || mod === "empty-net" || !d.goalieInNetId;
    const penaltyShot = mod === "penalty-shot";
    const hasPos = typeof d.xCoord === "number" && typeof d.yCoord === "number";
    const pos = hasPos ? normalise(d.xCoord, d.yCoord, ownerIsHome, p.homeTeamDefendingSide) : undefined;
    const dist = pos ? Math.round(distanceToNet(pos)) : undefined;
    const zone = pos && !penaltyShot && !ownGoal ? describeLocation(pos, emptyNet) : undefined;
    const gc = (goalsByPlayerInGame.get(sid) ?? 0) + 1;
    goalsByPlayerInGame.set(sid, gc);
    const scoreFor = ownerIsHome ? d.homeScore : d.awayScore;
    const scoreAgainst = ownerIsHome ? d.awayScore : d.homeScore;
    const isGwg = finished && base.lastPeriod !== "SO" && owner === (winnerIsHome ? home : away) && scoreFor === loserFinal + 1;
    const assists = [d.assist1PlayerId, d.assist2PlayerId].filter(Boolean).map((id: number) => ({ id, name: roster.get(id)?.name ?? String(id) }));
    const goalie = d.goalieInNetId && !emptyNet ? { id: d.goalieInNetId, name: roster.get(d.goalieInNetId)?.name ?? "" } : undefined;
    // Disambiguate shared surnames among the people named in one sentence ("E. Lindholm").
    const involved = [sid, ...assists.map((a) => a.id), ...(goalie ? [goalie.id] : [])];
    const short = (id: number) => {
      const r = roster.get(id);
      if (!r) return "Unknown";
      const clash = involved.some((o) => o !== id && roster.get(o)?.last === r.last);
      return clash && r.first ? `${r.first[0]}. ${r.last}` : r.last;
    };
    const desc = describeGoal({
      scorerLast: short(sid), scorerFull: sr?.name ?? "", assistLasts: assists.map((a) => short(a.id)),
      goalieLast: goalie ? short(goalie.id) : undefined, teamName: owner.commonName?.default ?? owner.abbrev,
      opponentName: against.commonName?.default ?? against.abbrev, strength: sit.strength, skaters: sit.skaters,
      emptyNet, penaltyShot, ownGoal, shotType: d.shotType, location: zone, distance: dist,
      period: p.periodDescriptor.number, periodType: p.periodDescriptor.periodType === "OT" ? "OT" : "REG", time: p.timeInPeriod,
      scoreFor, scoreAgainst, gameGoal: gc, seasonGoal: d.scoringPlayerTotal, isGwg, gameFinalTeamWon: false, isFirstOfGame: n === 1,
    });
    const goal: Goal = {
      id: `${sg.id}-${p.eventId}`, gameId: sg.id, date: sg.date, period: p.periodDescriptor.number,
      periodType: p.periodDescriptor.periodType === "OT" ? "OT" : "REG", time: p.timeInPeriod,
      team: owner.abbrev, against: against.abbrev, scorer: { id: sid, name: sr?.name ?? String(sid) }, assists, goalie,
      strength: sit.strength, skaters: sit.skaters, emptyNet, penaltyShot, ownGoal, shotType: d.shotType,
      x: pos?.x, y: pos?.y, distance: dist, zone, away: d.awayScore, home: d.homeScore, seasonGoal: d.scoringPlayerTotal,
      gameGoal: gc, clip: d.highlightClip, clipUrl: d.highlightClipSharingUrl ?? modByEvent.get(p.eventId)?.clipUrl,
      text: desc.text, tags: desc.tags,
    };
    base.goals.push(goal);
  }

  base.stars = (fresh.summary?.threeStars ?? []).map((s: any): Star => ({
    id: s.playerId, name: s.name?.default ?? "", team: s.teamAbbrev, star: s.star, pos: s.position,
  }));
  const sbp = fresh.summary?.shotsByPeriod;
  if (sbp) base.shotsByPeriod = sbp.map((s: any) => ({ period: s.periodDescriptor.number, away: s.away, home: s.home }));
  // Full-game videos (recap ~5 min, condensed ~10 min). They appear some hours after the final horn,
  // so an empty answer is only cached once the game is a week old.
  if (finished) {
    const old = Date.now() - new Date(base.start).getTime() > 7 * 86400e3;
    try {
      const v = await readFile(`.cache/rr-${sg.id}.json`, "utf8").then((t) => JSON.parse(t)).catch(async () => (await web(`/gamecenter/${sg.id}/right-rail`)).gameVideo ?? {});
      base.recapClip = v.threeMinRecap; base.condensedClip = v.condensedGame;
      if (v.condensedGame || old) await mkdir(".cache", { recursive: true }).then(() => writeFile(`.cache/rr-${sg.id}.json`, JSON.stringify(v)));
    } catch { /* leave without videos */ }
  }
  if (live) base.state = state;
  return base;
}

async function loadNationalities(players: Map<number, PlayerInfo>, seasons: number[]) {
  for (const s of seasons) {
    for (const kind of ["skater", "goalie"]) {
      try {
        const r = await stats(`/${kind}/bios?limit=-1&cayenneExp=seasonId=${s}`);
        for (const row of r.data ?? []) {
          const id = row.playerId as number;
          const cur = players.get(id);
          if (cur && !cur.nat) cur.nat = row.nationalityCode ?? row.birthCountryCode;
        }
      } catch (e) { console.warn(`bios ${kind} ${s} failed:`, (e as Error).message); }
    }
  }
  // Fallback for the stragglers (traded/new/retired): player landing page.
  const missing = [...players.entries()].filter(([, p]) => !p.nat);
  await pool(missing, 6, async ([id, p]) => {
    try { const l = await cached(`.cache/player-${id}.json`, true, () => web(`/player/${id}/landing`)); p.nat = l.birthCountry; }
    catch { /* leave unknown */ }
  });
}

/** Playoff bracket for one season, with the games of every series. The API keys brackets by the season's end year. */
async function loadPlayoffs(season: number): Promise<PlayoffBracket> {
  const br = await web(`/playoff-bracket/${season % 10000}`);
  const team = (t: any, seed: string, wins: number) => (t ? { abbrev: t.abbrev, name: t.name.default, seed, wins: wins ?? 0 } : undefined);
  const series = await pool<any, PlayoffSeries>(br.series ?? [], 4, async (r) => {
    const top = team(r.topSeedTeam, r.topSeedRankAbbrev, r.topSeedWins);
    const bottom = team(r.bottomSeedTeam, r.bottomSeedRankAbbrev, r.bottomSeedWins);
    const winner = r.winningTeamId ? [r.topSeedTeam, r.bottomSeedTeam].find((t) => t?.id === r.winningTeamId)?.abbrev : undefined;
    let games: PlayoffGame[] = [];
    if (top && bottom) {
      try {
        // A finished series never changes, so it is cached like a finished game.
        const sch = await cached(`.cache/series-${season}-${r.seriesLetter}.json`, !!winner, () => web(`/schedule/playoff-series/${season}/${r.seriesLetter.toLowerCase()}`));
        games = (sch.games ?? []).map((g: any): PlayoffGame => {
          const final = g.gameState === "OFF" || g.gameState === "FINAL";
          return {
            id: g.id, num: g.gameNumber, start: g.startTimeUTC, away: g.awayTeam.abbrev, home: g.homeTeam.abbrev,
            awayScore: final ? g.awayTeam.score : undefined, homeScore: final ? g.homeTeam.score : undefined,
            ot: final ? g.gameOutcome?.otPeriods : undefined, final, optional: !!g.ifNecessary,
          };
        });
      } catch (e) { console.warn(`  series ${season}/${r.seriesLetter} failed: ${(e as Error).message}`); }
    }
    return { letter: r.seriesLetter, round: r.playoffRound, title: r.seriesTitle, top, bottom, winner, games };
  });
  return { season, series };
}

const EDGE_POS: EdgePos[] = ["all", "F", "D"];
const EDGE_BOARDS: Record<EdgeBoardId, { path: (pos: EdgePos, season: number, gt: number) => string; read: (r: any) => Pick<EdgeEntry, "value" | "sub" | "when"> }> = {
  speed: {
    path: (pos, season, gt) => `/edge/skater-speed-top-10/${pos}/max/${season}/${gt}`,
    read: (r) => ({ value: r.maxSpeed.imperial, sub: `${r.burstsOver22} bursts over 22 mph`, when: overlayWhen(r.maxSpeed.overlay) }),
  },
  shot: {
    path: (pos, season, gt) => `/edge/skater-shot-speed-top-10/${pos}/max/${season}/${gt}`,
    read: (r) => ({ value: r.hardestShot.imperial, sub: `${r.shotAttemptsOver100} over 100 mph · ${r.shotAttempts90To100} at 90–100`, when: overlayWhen(r.hardestShot.overlay) }),
  },
  distance: {
    path: (pos, season, gt) => `/edge/skater-distance-top-10/${pos}/all/total/${season}/${gt}`,
    read: (r) => ({ value: r.distanceTotal.imperial, sub: `${r.distancePer60.imperial.toFixed(1)} mi per 60 min` }),
  },
  zone: {
    path: (pos, season, gt) => `/edge/skater-zone-time-top-10/${pos}/all/offensive/${season}/${gt}`,
    read: (r) => ({ value: r.offensiveZoneTime * 100, sub: `${(r.neutralZoneTime * 100).toFixed(0)}% neutral · ${(r.defensiveZoneTime * 100).toFixed(0)}% defensive` }),
  },
};
const overlayWhen = (o: any) => (o?.gameDate ? `${o.gameDate} ${o.awayTeam?.abbrev} @ ${o.homeTeam?.abbrev}` : undefined);

/** EDGE top-10 boards for one season. Player ids are only present in the slug ("beck-malenstyn-8479359"). */
async function loadEdge(season: number, gt: 2 | 3): Promise<EdgeData> {
  const boards = { speed: {}, shot: {}, distance: {}, zone: {} } as EdgeData["boards"];
  const jobs = (Object.keys(EDGE_BOARDS) as EdgeBoardId[]).flatMap((b) => EDGE_POS.map((pos) => ({ b, pos })));
  await pool(jobs, 4, async ({ b, pos }) => {
    const rows: any[] = await web(EDGE_BOARDS[b].path(pos, season, gt)).catch(() => []);
    boards[b][pos] = rows.map((r): EdgeEntry => ({
      id: Number(/(\d+)$/.exec(r.player.slug)?.[1]), name: `${r.player.firstName.default} ${r.player.lastName.default}`,
      team: r.player.team?.abbrev, pos: r.player.position, h: r.player.headshot?.split("/mugs/nhl/")[1],
      ...EDGE_BOARDS[b].read(r),
    }));
  });
  const teams: Record<string, EdgeTeam> = {};
  await pool([...teamIds.entries()], 4, async ([abbrev, id]) => {
    try {
      const t = await web(`/edge/team-detail/${id}/${season}/${gt}`);
      const st = (o: any, rank: number | undefined, avg?: number, scale = 1): EdgeStat => ({ value: o * scale, rank: rank ?? 0, avg: avg === undefined ? undefined : avg * scale });
      const z = t.zoneTimeDetails ?? {}, all = (t.sogSummary ?? []).find((x: any) => x.locationCode === "all") ?? {};
      teams[abbrev] = {
        shotSpeed: st(t.shotSpeed.topShotSpeed.imperial, t.shotSpeed.topShotSpeed.rank, t.shotSpeed.topShotSpeed.leagueAvg?.imperial),
        burst22: st(t.skatingSpeed.burstsOver22.value, t.skatingSpeed.burstsOver22.rank),
        speed: st(t.skatingSpeed.speedMax.imperial, t.skatingSpeed.speedMax.rank, t.skatingSpeed.speedMax.leagueAvg?.imperial),
        distance: st(t.distanceSkated.total.imperial, t.distanceSkated.total.rank, t.distanceSkated.total.leagueAvg?.imperial),
        zoneOff: st(z.offensiveZonePctg, z.offensiveZoneRank, z.offensiveZoneLeagueAvg, 100),
        zoneDef: st(z.defensiveZonePctg, z.defensiveZoneRank, z.defensiveZoneLeagueAvg, 100),
        shots: st(all.shots, all.shotsRank, all.shotsLeagueAvg),
        shootPct: st(all.shootingPctg, all.shootingPctgRank, all.shootingPctgLeagueAvg, 100),
      };
    } catch (e) { console.warn(`  team edge ${abbrev} ${season} failed: ${(e as Error).message}`); }
  });
  return { season, boards, teams };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const cur = await currentSeasonId();
  const seasons = seasonArg ? seasonArg.split(",").map(Number) : args.includes("--with-previous") ? [cur - 10001, cur] : [cur];
  const players = new Map<number, PlayerInfo>();
  const manifest: Manifest = { updated: new Date().toISOString(), seasons: [], currentSeason: cur, countries: {} };

  for (const season of seasons) {
    console.log(`Season ${season}: schedule…`);
    const sched = await seasonGames(season);
    const todayIso = isoToday();
    const upcoming = sched.filter((g) => g.date > new Date(Date.now() + 36 * 3600e3).toISOString().slice(0, 10));
    const todo = sched.filter((g) => !upcoming.includes(g));
    console.log(`  ${todo.length} games to read (${upcoming.length} skipped as too far ahead), today=${todayIso}`);
    const shots: ShotFile = { season, teams: [], games: [], shots: [] };
    let done = 0;
    const games = (await pool(todo, 8, async (g) => {
      try { const r = await loadGame(g, players, shots); if (++done % 100 === 0) console.log(`  ${done}/${todo.length}`); return r; }
      catch (e) { console.warn(`  game ${g.id} failed: ${(e as Error).message}`); return null; }
    })).filter((g): g is Game => !!g);
    games.sort((a, b) => a.start.localeCompare(b.start));
    await writeFile(`${OUT}/shots-${season}.json`, JSON.stringify(shots));
    await writeFile(`${OUT}/season-${season}.json`, JSON.stringify(games));
    const label = `${String(season).slice(0, 4)}–${String(season).slice(6)}`;
    manifest.seasons.push({ id: season, label, games: games.length, goals: games.reduce((a, g) => a + g.goals.length, 0) });
    console.log(`  wrote ${games.length} games, ${manifest.seasons.at(-1)!.goals} goals`);
    try {
      const po = await loadPlayoffs(season);
      await writeFile(`${OUT}/playoffs-${season}.json`, JSON.stringify(po));
      console.log(`  wrote playoff bracket (${po.series.length} series)`);
    } catch (e) { console.warn(`  playoffs ${season} failed:`, (e as Error).message); }
    try {
      await writeFile(`${OUT}/edge-${season}.json`, JSON.stringify(await loadEdge(season, 2)));
      await writeFile(`${OUT}/edge-${season}-po.json`, JSON.stringify(await loadEdge(season, 3)));
      console.log("  wrote EDGE leaderboards (regular season + playoffs)");
    } catch (e) { console.warn(`  edge ${season} failed:`, (e as Error).message); }
  }

  console.log("Nationalities…");
  await loadNationalities(players, seasons);
  try {
    const c = await stats("/country");
    for (const r of c.data ?? []) manifest.countries[r.country3Code] = r.countryName;
  } catch (e) { console.warn("country list failed", (e as Error).message); }

  console.log("Standings + teams…");
  const st = await web("/standings/now");
  const rows: StandingRow[] = (st.standings ?? []).map((r: any) => ({
    abbrev: r.teamAbbrev.default, name: r.teamName.default, division: r.divisionName, conference: r.conferenceName,
    gp: r.gamesPlayed, w: r.wins, l: r.losses, otl: r.otLosses, pts: r.points, gf: r.goalFor, ga: r.goalAgainst,
    streak: r.streakCode ? `${r.streakCode}${r.streakCount}` : undefined,
    divRank: r.divisionSequence, wc: r.wildcardSequence, row: r.regulationPlusOtWins, ptsPct: r.pointPctg,
    l10: `${r.l10Wins}-${r.l10Losses}-${r.l10OtLosses}`,
  }));
  const teams: TeamInfo[] = rows.map((r) => ({ abbrev: r.abbrev, name: r.name, division: r.division, conference: r.conference }));
  await writeFile(`${OUT}/standings.json`, JSON.stringify(rows));
  await writeFile(`${OUT}/teams.json`, JSON.stringify(teams));
  await writeFile(`${OUT}/players.json`, JSON.stringify(Object.fromEntries(players)));
  await writeFile(`${OUT}/manifest.json`, JSON.stringify(manifest));
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
