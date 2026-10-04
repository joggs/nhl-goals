import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../lib/data";
import { useFilteredGoals, useGoalFilter } from "../lib/filters";
import { FilterBar } from "../components/FilterBar";
import { GoalCard } from "../components/ui";
import { fmtDate } from "../lib/util";

const PAGE = 40;

export default function Goals({ assists = false }: { assists?: boolean }) {
  const { loading } = useData();
  const [f, set] = useGoalFilter(assists ? { natRole: "assist" } : {});
  const all = useFilteredGoals(f);
  const goals = useMemo(() => (assists ? all.filter((g) => g.assists.length > 0) : all), [all, assists]);
  const [n, setN] = useState(PAGE);
  useEffect(() => setN(PAGE), [goals]);
  const grouped = f.sort === "new" || f.sort === "old";
  const shown = goals.slice(0, n);
  let lastDate = "";
  return (
    <section>
      <div className="row between"><h1>{assists ? "Assists" : "Goals"}</h1><span className="muted">{goals.length} {assists ? "assisted goals" : "goals"}</span></div>
      <FilterBar f={f} set={set} />
      {loading ? <div className="spinner" /> : goals.length === 0 ? <p className="empty">Nothing matches. Try a longer range or fewer filters.</p> : (
        <>
          {shown.map((g) => {
            const head = grouped && g.date !== lastDate ? (lastDate = g.date, <h3 key={"d" + g.date} className="period"><Link to={`/?date=${g.date}`}>{fmtDate(g.date, { weekday: "long", day: "numeric", month: "long" })}</Link></h3>) : null;
            return <div key={g.id}>{head}<GoalCard goal={g} minimap lead={assists ? "assists" : undefined} /></div>;
          })}
          {n < goals.length && <button className="more" onClick={() => setN(n + PAGE)}>Show {Math.min(PAGE, goals.length - n)} more</button>}
        </>
      )}
    </section>
  );
}
