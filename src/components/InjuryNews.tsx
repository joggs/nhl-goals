import { useState } from "react";
import type { Game, NewsCat, NewsItem } from "../../shared/types";
import { useData } from "../lib/data";
import { useSpoilers } from "../lib/spoilers";
import { fmtDate, surname } from "../lib/util";
import { Face, TeamLogo } from "./ui";

/** Headlines like "misses Sharks loss" give away a result, so they stay hidden in spoiler mode until clicked. */
const RESULT_LOOSE = /\b(wins?|won|loss|losses|loses|lost|defeats?|beats?|falls?|overtime|OT|shootout|shutout|\d+-\d+)\b/i;
const RESULT = /\b(wins?|won|loss|losses|loses|lost|defeats?|beats?|falls?|overtime|OT|shootout|shutout|scores?|goals?|\d+-\d+)\b/i;

/** Should this story stay hidden until clicked? Recaps always, anything that reads like a result, anything about a game still hidden. */
export function useRisky() {
  const sp = useSpoilers();
  const { gameById } = useData();
  return (n: NewsItem) => sp.on && (n.cat === "recap" || (n.cat === "injury" ? RESULT : RESULT_LOOSE).test(n.headline) || (!!n.gameId && sp.hidden(gameById.get(n.gameId))));
}

export const recentNews = (news: NewsItem[], opts: { teams?: string[]; player?: number; days: number; until?: string; latestPerPlayer?: boolean; cat?: NewsCat }) => {
  const from = Date.now() - opts.days * 86400e3;
  const seen = new Set<number>();
  return news.filter((n) =>
    n.cat === (opts.cat ?? "injury") && Date.parse(n.date) >= from && (!opts.until || n.date.slice(0, 10) <= opts.until) &&
    (!opts.teams || n.teams.some((t) => opts.teams!.includes(t))) &&
    (opts.player === undefined || n.players.includes(opts.player)))
    .filter((n) => {
      if (!opts.latestPerPlayer || !n.players.length) return true;
      if (n.players.every((p) => seen.has(p))) return false;
      n.players.forEach((p) => seen.add(p));
      return true;
    });
};

function Line({ n }: { n: NewsItem }) {
  const { players } = useData();
  const isRisky = useRisky();
  const [open, setOpen] = useState(false);
  const risky = !open && isRisky(n);
  const who = n.players.length === 1 ? players[n.players[0]]?.n : undefined;
  return (
    <li className="news-row">
      <span aria-hidden="true">🩹</span>
      {risky ? (
        <span>{who ?? n.teams.join(" / ")}: injury news <button className="chip" onClick={() => setOpen(true)} title="The headline may mention a result">Show</button></span>
      ) : (
        <a href={`https://www.nhl.com/news/${n.id}`} target="_blank" rel="noreferrer">{n.headline}</a>
      )}
      <small className="muted">{fmtDate(n.date.slice(0, 10), { day: "numeric", month: "short" })}</small>
    </li>
  );
}

/** Same look as the three-stars cards: face, name, one line of news. */
function Card({ n }: { n: NewsItem }) {
  const { players } = useData();
  const isRisky = useRisky();
  const [open, setOpen] = useState(false);
  const risky = !open && isRisky(n);
  const pid = n.players.length === 1 ? n.players[0] : undefined;
  const who = pid ? players[pid]?.n : undefined;
  const body = risky
    ? <small>Injury news <button className="chip" onClick={() => setOpen(true)} title="The headline may mention a result">Show</button></small>
    : <small><a href={`https://www.nhl.com/news/${n.id}`} target="_blank" rel="noreferrer">{n.headline}</a></small>;
  return (
    <div className="star-card news-card">
      <span aria-hidden="true">🩹</span>
      {pid && players[pid]?.h ? <Face id={pid} size={44} /> : <TeamLogo abbrev={n.teams[0]} size={36} />}
      <div><b>{who ?? n.teams.join(" / ")}</b>{who && n.teams[0] && <span className="news-team"> {n.teams[0]}</span>}<br />{body}</div>
    </div>
  );
}

export function InjuryCards({ items, title = "Injuries" }: { items: NewsItem[]; title?: string }) {
  if (!items.length) return null;
  return (
    <div className="infobox">
      <h4 className="infolabel">{title}</h4>
      <div className="stars">{items.map((n) => <Card key={n.id} n={n} />)}</div>
    </div>
  );
}

export function InjuryNews({ items, title = "Injuries & returns", max = 6 }: { items: NewsItem[]; title?: string; max?: number }) {
  if (!items.length) return null;
  const teams = [...new Set(items.flatMap((n) => n.teams))];
  return (
    <div className="news">
      {title && <h3>{title} {teams.length <= 2 && teams.map((t) => <TeamLogo key={t} abbrev={t} size={16} />)}</h3>}
      <ul>{items.slice(0, max).map((n) => <Line key={n.id} n={n} />)}</ul>
    </div>
  );
}

/** One-line status for a player profile. */
export function InjuryBadge({ player }: { player: number }) {
  const { news } = useData();
  const items = recentNews(news, { player, days: 14 });
  if (!items.length) return null;
  return <ul className="news"><Line n={items[0]} /></ul>;
}

const etDay = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/New_York" });

/** Headlines that say a player is back; a name alone would read as "injured". Heuristic. */
const BACK = /\b(returns?|activated|cleared|debuts?|back in (the )?lineup)\b/i;

/** One compact line on a game card: names of players with injury news for either team, linked to the story. */
export function GameInjuries({ game }: { game: Pick<Game, "date" | "away" | "home"> }) {
  const { news, players } = useData();
  const from = new Date(Date.parse(game.date + "T12:00:00Z") - 3 * 86400e3).toISOString().slice(0, 10);
  const seen = new Set<number>();
  const rows: { pid: number; team: string; n: NewsItem }[] = [];
  for (const n of news) {
    if (n.cat !== "injury" || !n.teams.some((t) => t === game.away.abbrev || t === game.home.abbrev)) continue;
    const d = etDay(n.date);
    if (d > game.date || d < from) continue;
    for (const pid of n.players) {
      if (seen.has(pid) || !players[pid]?.n) continue;
      seen.add(pid);
      rows.push({ pid, team: n.teams.find((t) => t === game.away.abbrev || t === game.home.abbrev)!, n });
    }
  }
  if (!rows.length) return null;
  const open = (id: string) => window.open(`https://www.nhl.com/news/${id}`, "_blank", "noopener");
  return (
    <div className="gc-inj">
      {rows.slice(0, 5).map(({ pid, team, n }) => (
        <span key={pid} role="link" tabIndex={0} className="gc-inj-item" title={BACK.test(n.headline) ? "Back: open the story" : "Injury news: open the story"}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); open(n.id); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); open(n.id); } }}>
          {BACK.test(n.headline) ? "✅" : "🩹"} {surname(players[pid].n)} <small>{team}</small>
        </span>
      ))}
    </div>
  );
}
