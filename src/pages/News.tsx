import { useSearchParams } from "react-router-dom";
import type { NewsCat } from "../../shared/types";
import { useData } from "../lib/data";
import { NewsList } from "../components/NewsList";

export default function News() {
  const { news, teams } = useData();
  const [q, setQ] = useSearchParams();
  const team = q.get("team") ?? "", cat = (q.get("cat") ?? "") as NewsCat | "";
  const set = (k: string, v: string) => setQ((p) => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });
  return (
    <section>
      <h1>News</h1>
      <div className="row">
        <select value={team} onChange={(e) => set("team", e.target.value)} aria-label="Team">
          <option value="">All teams</option>
          {[...teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => <option key={t.abbrev} value={t.abbrev}>{t.name}</option>)}
        </select>
      </div>
      <NewsList items={team ? news.filter((n) => n.teams.includes(team)) : news} cat={cat} onCat={(c) => set("cat", c)} />
    </section>
  );
}
