import { useState } from "react";
import type { NewsCat, NewsItem } from "../../shared/types";
import { fmtDate } from "../lib/util";
import { Chip, TeamLogo } from "./ui";
import { useRisky } from "./InjuryNews";

export const CATS: [NewsCat, string, string][] = [
  ["injury", "Injuries", "🚑"], ["transactions", "Transactions", "🔁"], ["recap", "Recaps", "📰"], ["preview", "Previews", "🔭"], ["other", "Features", "✍️"],
];
const label = (c: NewsCat) => CATS.find((x) => x[0] === c)!;

/** One headline. `day` shows the date instead of the time, for lists not grouped by day. */
export function NewsRow({ n, day }: { n: NewsItem; day?: boolean }) {
  const isRisky = useRisky();
  const [open, setOpen] = useState(false);
  const [, name, icon] = label(n.cat);
  return (
    <li className="news-row">
      <span aria-hidden="true" title={name}>{icon}</span>
      {n.teams[0] && <TeamLogo abbrev={n.teams[0]} size={18} />}
      {!open && isRisky(n)
        ? <span>{name.replace(/s$/, "")} hidden <button className="chip" onClick={() => setOpen(true)} title="May mention a result">Show</button></span>
        : <a href={`https://www.nhl.com/news/${n.id}`} target="_blank" rel="noreferrer">{n.headline}</a>}
      <small className="muted">{day ? fmtDate(n.date.slice(0, 10), { day: "numeric", month: "short", ...(n.date.slice(0, 4) !== String(new Date().getFullYear()) && { year: "numeric" }) }) : new Date(n.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</small>
    </li>
  );
}

/** Stories grouped by day, with category chips. `cat` is controlled so pages can keep it in the URL. */
export function NewsList({ items, cat, onCat, limit = 120 }: { items: NewsItem[]; cat: NewsCat | ""; onCat: (c: NewsCat | "") => void; limit?: number }) {
  const [more, setMore] = useState(false);
  const main = items.filter((n) => n.cat !== "other");
  const shown = cat ? items.filter((n) => n.cat === cat) : main;
  const list = more ? shown : shown.slice(0, limit);
  const days = new Map<string, NewsItem[]>();
  for (const n of list) {
    const d = new Date(n.date).toLocaleDateString("sv-SE");
    days.set(d, [...(days.get(d) ?? []), n]);
  }
  return (
    <>
      <div className="row">
        <Chip active={cat === ""} onClick={() => onCat("")} title="Everything except features">Main ({main.length})</Chip>
        {CATS.map(([c, name, icon]) => {
          const k = items.filter((n) => n.cat === c).length;
          return k > 0 && <Chip key={c} active={cat === c} onClick={() => onCat(cat === c ? "" : c)}>{icon} {name} ({k})</Chip>;
        })}
      </div>
      {shown.length === 0 && <p className="empty">No news.</p>}
      {[...days].map(([d, rows]) => (
        <div key={d} className="news">
          <h3>{fmtDate(d)}</h3>
          <ul>{rows.map((n) => <NewsRow key={n.id} n={n} />)}</ul>
        </div>
      ))}
      {!more && shown.length > limit && <p><button className="chip" onClick={() => setMore(true)}>Show {shown.length - limit} more</button></p>}
    </>
  );
}
