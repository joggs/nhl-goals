import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../lib/data";
import { useSpoilers } from "../lib/spoilers";
import { useFilteredGoals, useGoalFilter } from "../lib/filters";
import { FilterBar } from "../components/FilterBar";
import { GoalCard, PlaylistModal } from "../components/ui";
import { fmtDate } from "../lib/util";

const PAGE = 40;

export default function Goals({ assists = false }: { assists?: boolean }) {
  const { loading, gameById } = useData();
  const [f, set] = useGoalFilter(assists ? { natRole: "assist" } : {});
  const all = useFilteredGoals(f);
  const goals = useMemo(() => (assists ? all.filter((g) => g.assists.length > 0) : all), [all, assists]);
  const [n, setN] = useState(PAGE);
  const [playAll, setPlayAll] = useState(false);
  const sp = useSpoilers();
  const playable = useMemo(() => goals.filter((g) => g.clip && !sp.hidden(gameById.get(g.gameId))).length, [goals, gameById, sp]);
  useEffect(() => setN(PAGE), [goals]);
  const grouped = f.sort === "new" || f.sort === "old";
  const shown = goals.slice(0, n);
  let lastDate = "";
  return (
    <section>
      <div className="row between"><h1>{assists ? "Assists" : "Goals"}</h1><div className="row"><span className="muted">{goals.length} {assists ? "assisted goals" : "goals"}</span>{playable > 0 && <button className="chip on playall" onClick={() => setPlayAll(true)} title="Play every clip in this list, one after another">▶ Play all ({playable})</button>}</div></div>
      {playAll && <PlaylistModal goals={goals} onClose={() => setPlayAll(false)} />}
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
