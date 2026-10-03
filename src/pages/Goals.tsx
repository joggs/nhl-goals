import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../lib/data";
import { useFilteredGoals, useGoalFilter } from "../lib/filters";
import { FilterBar } from "../components/FilterBar";
import { Chip, GoalCard } from "../components/ui";
import { fmtDate } from "../lib/util";
import { flag } from "../lib/flags";

const PAGE = 40;

export default function Goals() {
  const { loading } = useData();
  const [f, set] = useGoalFilter();
  const goals = useFilteredGoals(f);
  const [n, setN] = useState(PAGE);
  useEffect(() => setN(PAGE), [goals]);
  const grouped = f.sort === "new" || f.sort === "old";
  const shown = goals.slice(0, n);
  let lastDate = "";
  return (
    <section>
      <div className="row between"><h1>Goals</h1><span className="muted">{goals.length} goals</span></div>
      <div className="row presets">
        <Chip active={f.nat.includes("SWE") && f.nat.length === 1} onClick={() => set({ nat: ["SWE"] })}>{flag("SWE")} Swedes</Chip>
        <Chip active={f.nat.includes("FIN") && f.nat.length === 1} onClick={() => set({ nat: ["FIN"] })}>{flag("FIN")} Finns</Chip>
        <Chip active={f.nat.includes("USA") && f.nat.length === 1} onClick={() => set({ nat: ["USA"] })}>{flag("USA")} Americans</Chip>
        <Chip active={f.nat.includes("CAN") && f.nat.length === 1} onClick={() => set({ nat: ["CAN"] })}>{flag("CAN")} Canadians</Chip>
        <Chip active={f.nat.length === 0} onClick={() => set({ nat: [] })}>All nations</Chip>
      </div>
      <FilterBar f={f} set={set} />
      {loading ? <div className="spinner" /> : goals.length === 0 ? <p className="empty">No goals match. Try a longer range or fewer filters.</p> : (
        <>
          {shown.map((g) => {
            const head = grouped && g.date !== lastDate ? (lastDate = g.date, <h3 key={"d" + g.date} className="period"><Link to={`/?date=${g.date}`}>{fmtDate(g.date, { weekday: "long", day: "numeric", month: "long" })}</Link></h3>) : null;
            return <div key={g.id}>{head}<GoalCard goal={g} minimap /></div>;
          })}
          {n < goals.length && <button className="more" onClick={() => setN(n + PAGE)}>Show {Math.min(PAGE, goals.length - n)} more</button>}
        </>
      )}
    </section>
  );
}
