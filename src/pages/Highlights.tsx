import { useMemo } from "react";
import { Link } from "react-router-dom";
import { SpoilerGate } from "../lib/spoilers";
import { useData } from "../lib/data";
import { RANGES, useGoalFilter, useFilteredGoals } from "../lib/filters";
import { Chip, GoalCard, Face, Flag } from "../components/ui";
import type { Goal } from "../../shared/types";

interface Section { id: string; title: string; blurb: string; goals: Goal[]; link: string }

export default function Highlights() {
  const { players, loading } = useData();
  const [f, set] = useGoalFilter({ range: "week" });
  const goals = useFilteredGoals({ ...f, sort: "new" });
  const sections = useMemo<Section[]>(() => {
    const r = f.range === "week" ? "" : `&range=${f.range}`;
    const tag = (t: string) => goals.filter((g) => g.tags.includes(t));
    const clutch = goals.filter((g) => g.period >= 3 && (g.tags.includes("tying") || g.tags.includes("go-ahead")) && g.time >= "17:00" && g.periodType === "REG");
    return [
      { id: "ot", title: "Overtime winners", blurb: "Games ended on the spot.", goals: tag("otwinner"), link: `/goals?tag=otwinner${r}` },
      { id: "ht", title: "Hat tricks", blurb: "Third goal of the night.", goals: goals.filter((g) => g.gameGoal === 3), link: `/goals?tag=hattrick${r}` },
      { id: "clutch", title: "Last-3-minute drama", blurb: "Tying or go-ahead goals in the final 3 minutes.", goals: clutch, link: `/goals?tag=tying${r}` },
      { id: "sh", title: "Shorthanded", blurb: "Scored while a man down.", goals: tag("shorthanded"), link: `/goals?tag=shorthanded${r}` },
      { id: "ps", title: "Penalty shots", blurb: "One-on-one from the spot.", goals: tag("penaltyshot"), link: `/goals?tag=penaltyshot${r}` },
      { id: "far", title: "Long-range bombs", blurb: "Scored from 60+ ft with the net occupied.", goals: [...tag("longrange")].sort((a, b) => (b.distance ?? 0) - (a.distance ?? 0)), link: `/goals?tag=longrange&sort=dist${r}` },
    ].filter((s) => s.goals.length);
  }, [goals, f.range]);

  const hot = useMemo(() => {
    const m = new Map<number, number>();
    for (const g of goals) m.set(g.scorer.id, (m.get(g.scorer.id) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [goals]);

  return (
    <section>
      <div className="row between"><h1>Highlights</h1><span className="muted">{goals.length} goals in range</span></div>
      <div className="row">{RANGES.map((r) => <Chip key={r.id} active={f.range === r.id} onClick={() => set({ range: r.id })}>{r.label}</Chip>)}</div>
      {loading ? <div className="spinner" /> : (
        <>
          {hot.length > 0 && (
            <>
              <h2>🔥 Hottest shooters</h2>
              <div className="hot-row">{hot.map(([id, n]) => (
                <Link to={`/player/${id}`} key={id} className="hot-card"><Face id={id} size={52} /><b>{n}</b><small><Flag code={players[id]?.nat} /> {players[id]?.n}</small></Link>
              ))}</div>
            </>
          )}
          {sections.map((s) => (
            <div key={s.id}>
              <div className="row between"><h2>{s.title} <small className="muted">{s.goals.length}</small></h2><Link to={s.link}>See all →</Link></div>
              <p className="muted">{s.blurb}</p>
              {s.goals.slice(0, 4).map((g) => <GoalCard key={g.id} goal={g} />)}
            </div>
          ))}
          {!sections.length && <p className="empty">Nothing notable in this range yet.</p>}
        </>
      )}
    </section>
  );
}
