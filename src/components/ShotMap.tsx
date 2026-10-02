import { useMemo, useState } from "react";
import type { Goal } from "../../shared/types";
import { useData } from "../lib/data";
import { useShots, type Shot, type ShotKind } from "../lib/shots";
import { Chip } from "./ui";
import { ZoneBars } from "./ZoneBars";
import { MapTip, shotTip, useMapTip } from "./MapTip";
import { Heat, Rink, RinkMap, Versus } from "./RinkMap";

const KINDS: { kind: ShotKind; label: string }[] = [
  { kind: 3, label: "Goals" }, { kind: 0, label: "Saved" }, { kind: 1, label: "Missed" }, { kind: 2, label: "Blocked" },
];

/**
 * Goal map with an "All shots" switch. The goal view uses the goals already in memory; the all-shots view
 * loads the season's shot file the first time it is opened. `pick` selects which shots belong on this map.
 */
export function ShotMap({ goals, pick }: { goals: Goal[]; pick: (s: Shot) => boolean }) {
  const { season, players, gameById } = useData();
  const { tip, at, hide } = useMapTip();
  const [mode, setMode] = useState<"goals" | "all" | "vs">("all");
  const all = mode !== "goals";
  const [on, setOn] = useState<Set<ShotKind>>(new Set([0, 1, 2, 3]));
  const shots = useShots(season, all);
  const mine = useMemo(() => (all && shots ? shots.filter(pick) : []), [all, shots, pick]);
  const count = useMemo(() => {
    const c = [0, 0, 0, 0];
    for (const s of mine) c[s.kind]++;
    return c;
  }, [mine]);
  const shown = useMemo(() => mine.filter((s) => on.has(s.kind)).sort((a, b) => a.kind - b.kind), [mine, on]);
  // League baseline for the "vs league" view: every attempt of the chosen kinds.
  const league = useMemo(() => (mode === "vs" && shots ? shots.filter((s) => on.has(s.kind)) : []), [mode, shots, on]);
  const toggle = (k: ShotKind) => setOn((cur) => { const n = new Set(cur); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const onTarget = count[0] + count[3];
  return (
    <div>
      <div className="row">
        <Chip active={mode === "goals"} onClick={() => setMode("goals")}>Goals</Chip>
        <Chip active={mode === "all"} onClick={() => setMode("all")} title="Every shot attempt, including saves, misses and blocks">All shots</Chip>
        <Chip active={mode === "vs"} onClick={() => setMode("vs")} title="Where these shots come from compared with the league average">vs league</Chip>
      </div>
      {!all ? <><RinkMap goals={goals} /><ZoneBars points={goals.filter((g) => g.x !== undefined && !g.ownGoal).map((g) => ({ x: g.x!, y: g.y! }))} /></> : shots === undefined ? <div className="spinner" /> : shots === null ? <p className="empty">No shot data for this season.</p> : (
        <div className="rink tip-host">
          <MapTip tip={tip} />
          <Rink label={`Map of ${shown.length} shot attempts`}>
            {mode === "vs" ? <Versus points={shown} baseline={league} /> : shown.length > 150 ? <Heat points={shown} /> : shown.map((s, i) => <circle key={i} cx={s.x} cy={42.5 - s.y} r={s.kind === 3 ? 1.2 : 0.8} className={`shot shot-${s.kind}`} onMouseMove={at(shotTip(s, players[s.player]?.n ?? "Unknown", gameById.get(s.game), true))} onMouseLeave={hide} />)}
            {mode === "all" && shown.length > 150 && count[3] > 0 && count[3] <= 60 && on.has(3) && shown.filter((s) => s.kind === 3).map((s, i) => <circle key={`g${i}`} cx={s.x} cy={42.5 - s.y} r="1.1" className="shot shot-3" onMouseMove={at(shotTip(s, players[s.player]?.n ?? "Unknown", gameById.get(s.game), true))} onMouseLeave={hide} />)}
          </Rink>
          <div className="row">{KINDS.map((k) => <Chip key={k.kind} active={on.has(k.kind)} onClick={() => toggle(k.kind)}><span className={`dot dot-${k.kind}`} /> {k.label} {count[k.kind]}</Chip>)}</div>
          <ZoneBars points={shown} baseline={mode === "vs" ? league : undefined} />
          <p className="muted rink-cap">{mine.length} attempts{mode === "vs" ? <> · <span className="dot dot-hot" /> more often than the league · <span className="dot dot-cold" /> less often</> : shown.length > 150 ? " · brighter = more shots" : ""} · {onTarget ? `${((count[3] / onTarget) * 100).toFixed(1)}% of shots on goal scored` : "no shots on goal"}</p>
        </div>
      )}
    </div>
  );
}
