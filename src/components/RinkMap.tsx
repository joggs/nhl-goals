import { useMemo } from "react";
import type { Goal } from "../../shared/types";
import { useData } from "../lib/data";
import { fmtM } from "../lib/units";
import { goalTip, MapTip, useMapTip } from "./MapTip";

const CELL = 2;      // feet per heat cell
const SIGMA = 1.6;   // smoothing, in cells
const DOT_LIMIT = 60; // above this many points individual dots turn into mush, so show a heat map instead

/**
 * Offensive half of the rink, attacking net on the right. Coordinates are normalised that way (x up to +89, y -42.5..42.5),
 * and +y is the shooter's left, i.e. up on screen, so SVG y = 42.5 - y.
 */
export function Rink({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <svg viewBox="-2 -2 104 89" role="img" aria-label={label}>
      <path className="rink-ice" d="M0 0H72a28 28 0 0 1 28 28V57a28 28 0 0 1-28 28H0Z" />
      <g className="rink-lines">
        <line x1="25" y1="0" x2="25" y2="85" className="rink-blue" />
        <line x1="89" y1="2.5" x2="89" y2="82.5" className="rink-red" />
        <path d="M89 36.5a6 6 0 0 0 0 12" className="rink-crease" />
        <rect x="89" y="39.5" width="3" height="6" className="rink-net" />
        {[22, -22].map((dy) => (
          <g key={dy}>
            <circle cx="69" cy={42.5 + dy} r="15" fill="none" />
            <circle cx="69" cy={42.5 + dy} r="1" className="rink-dot" />
          </g>
        ))}
        <circle cx="0" cy="42.5" r="15" fill="none" />
      </g>
      {children}
    </svg>
  );
}

export function RinkMap({ goals }: { goals: Goal[] }) {
  const { gameById } = useData();
  const { tip, at, hide } = useMapTip();
  const pts = goals.filter((g) => g.x !== undefined && g.y !== undefined && !g.ownGoal);
  return (
    <div className="rink tip-host">
      <MapTip tip={tip} />
      <Rink label={`Map of ${pts.length} goals`}>
        {pts.length > DOT_LIMIT
          ? <Heat points={pts.map((g) => ({ x: g.x!, y: g.y! }))} />
          : pts.map((g) => (
            <circle key={g.id} cx={g.x} cy={42.5 - g.y!} r="1" className={`rink-goal${g.strength === "PP" ? " pp" : ""}`} onMouseMove={at(goalTip(g, gameById.get(g.gameId), true))} onMouseLeave={hide} />
          ))}
      </Rink>
      <p className="muted rink-cap">{pts.length} goals{pts.length > DOT_LIMIT ? " · brighter = more goals" : <> · <span className="rink-key" /> power play</>}</p>
    </div>
  );
}

/** Smoothed density of points over the rink, drawn as translucent cells clipped to the ice. */
export function Heat({ points }: { points: { x: number; y: number }[] }) {
  const cells = useMemo(() => {
    const w = Math.ceil(100 / CELL), h = Math.ceil(85 / CELL), r = Math.ceil(SIGMA * 2.5);
    const grid = new Float32Array(w * h);
    for (const p of points) {
      const cx = p.x / CELL, cy = (42.5 - p.y) / CELL;
      for (let j = Math.max(0, Math.floor(cy) - r); j <= Math.min(h - 1, Math.floor(cy) + r); j++)
        for (let i = Math.max(0, Math.floor(cx) - r); i <= Math.min(w - 1, Math.floor(cx) + r); i++) {
          const d2 = (i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2;
          grid[j * w + i] += Math.exp(-d2 / (2 * SIGMA * SIGMA));
        }
    }
    // Scale to the 97th percentile so one hot cell right at the net doesn't wash out the rest.
    const nz = Array.from(grid).filter((v) => v > 0.01).sort((a, b) => a - b);
    const max = nz.length ? nz[Math.floor(nz.length * 0.97)] : 1;
    const out: { x: number; y: number; o: number }[] = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const v = Math.min(1, grid[j * w + i] / max);
      if (v > 0.05) out.push({ x: i * CELL, y: j * CELL, o: Math.min(0.9, 0.12 + Math.sqrt(v) * 0.8) });
    }
    return out;
  }, [points]);
  return (
    <g className="heat" clipPath="url(#ice-clip)">
      <defs><clipPath id="ice-clip"><path d="M0 0H72a28 28 0 0 1 28 28V57a28 28 0 0 1-28 28H0Z" /></clipPath></defs>
      {cells.map((c, i) => <rect key={i} x={c.x} y={c.y} width={CELL} height={CELL} fillOpacity={c.o} />)}
    </g>
  );
}

const DCELL = 3, DSIGMA = 1.3;
const DW = Math.ceil(100 / DCELL), DH = Math.ceil(85 / DCELL);

/** Gaussian-smoothed counts per cell over the offensive half. */
function grid(points: { x: number; y: number }[]): Float32Array {
  const g = new Float32Array(DW * DH), r = Math.ceil(DSIGMA * 2.5);
  for (const p of points) {
    const cx = p.x / DCELL, cy = (42.5 - p.y) / DCELL;
    for (let j = Math.max(0, Math.floor(cy) - r); j <= Math.min(DH - 1, Math.floor(cy) + r); j++)
      for (let i = Math.max(0, Math.floor(cx) - r); i <= Math.min(DW - 1, Math.floor(cx) + r); i++)
        g[j * DW + i] += Math.exp(-((i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2) / (2 * DSIGMA * DSIGMA));
  }
  return g;
}

/**
 * Where `points` are taken from more (red) or less (blue) often than `baseline`, as a share of each set's own total.
 * Shows a style rather than volume, so a team that shoots from the point shows up even if most of its shots are in the slot.
 */
export function Versus({ points, baseline }: { points: { x: number; y: number }[]; baseline: { x: number; y: number }[] }) {
  const base = useMemo(() => grid(baseline), [baseline]);
  const cells = useMemo(() => {
    const a = grid(points);
    const sa = a.reduce((x, y) => x + y, 0) || 1, sb = base.reduce((x, y) => x + y, 0) || 1;
    const diff = Array.from(a, (v, i) => v / sa - base[i] / sb);
    const mags = diff.map(Math.abs).filter((v) => v > 0).sort((x, y) => x - y);
    const scale = mags.length ? mags[Math.floor(mags.length * 0.97)] : 1;
    const out: { x: number; y: number; o: number; hot: boolean }[] = [];
    diff.forEach((d, k) => {
      if (a[k] < 0.4) return; // too few shots here to say anything
      const o = Math.min(1, Math.abs(d) / scale);
      if (o > 0.12) out.push({ x: (k % DW) * DCELL, y: Math.floor(k / DW) * DCELL, o: 0.15 + o * 0.7, hot: d > 0 });
    });
    return out;
  }, [points, base]);
  return (
    <g className="versus" clipPath="url(#ice-clip)">
      <defs><clipPath id="ice-clip"><path d="M0 0H72a28 28 0 0 1 28 28V57a28 28 0 0 1-28 28H0Z" /></clipPath></defs>
      {cells.map((c, i) => <rect key={i} x={c.x} y={c.y} width={DCELL} height={DCELL} rx="0.6" fillOpacity={c.o} className={c.hot ? "hot" : "cold"} />)}
    </g>
  );
}

/** Small rink with one marker: where a single goal was scored. Only a handful of SVG nodes, so it is cheap to repeat per goal. */
export function MiniRink({ goal }: { goal: Goal }) {
  if (goal.x === undefined || goal.y === undefined || goal.ownGoal) return null;
  return (
    <div className="goal-minimap" title={`${goal.distance !== undefined ? fmtM(goal.distance) : ""}${goal.zone ? ` · ${goal.zone}` : ""}`}>
      <Rink label={`Where the goal was scored${goal.zone ? `: ${goal.zone}` : ""}`}>
        <circle cx={goal.x} cy={42.5 - goal.y} r="4.5" className="rink-goal-halo" />
        <circle cx={goal.x} cy={42.5 - goal.y} r="2.2" className={`shot shot-3${goal.strength === "PP" ? " pp" : ""}`} />
      </Rink>
    </div>
  );
}
