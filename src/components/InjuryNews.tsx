import { useState } from "react";
import type { NewsItem } from "../../shared/types";
import { useData } from "../lib/data";
import { useSpoilers } from "../lib/spoilers";
import { fmtDate } from "../lib/util";
import { TeamLogo } from "./ui";

/** Headlines like "misses Sharks loss" give away a result, so they stay hidden in spoiler mode until clicked. */
const RESULT = /\b(wins?|won|loss|losses|loses|lost|defeats?|beats?|falls?|overtime|OT|shootout|shutout|scores?|goals?|\d+-\d+)\b/i;

export const recentNews = (news: NewsItem[], opts: { teams?: string[]; player?: number; days: number; until?: string }) => {
  const from = Date.now() - opts.days * 86400e3;
  return news.filter((n) =>
    Date.parse(n.date) >= from && (!opts.until || n.date.slice(0, 10) <= opts.until) &&
    (!opts.teams || n.teams.some((t) => opts.teams!.includes(t))) &&
    (opts.player === undefined || n.players.includes(opts.player)));
};

function Line({ n }: { n: NewsItem }) {
  const { players } = useData();
  const sp = useSpoilers();
  const [open, setOpen] = useState(false);
  const risky = sp.on && !open && RESULT.test(n.headline);
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

export function InjuryNews({ items, title = "Injuries & returns", max = 6 }: { items: NewsItem[]; title?: string; max?: number }) {
  if (!items.length) return null;
  const teams = [...new Set(items.flatMap((n) => n.teams))];
  return (
    <div className="news">
      <h3>{title} {items.length > 0 && teams.length <= 2 && teams.map((t) => <TeamLogo key={t} abbrev={t} size={16} />)}</h3>
      <ul>{items.slice(0, max).map((n) => <Line key={n.id} n={n} />)}</ul>
      <small className="muted">From NHL.com news, updated every ~20 min. Return dates are not official.</small>
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
