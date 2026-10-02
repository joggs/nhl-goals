import { useMemo } from "react";
import { describeLocation } from "../../shared/describe";

type P = { x: number; y: number };

/** Named areas, with left/right merged: the point of a summary is "where", not "which side". */
export function areaOf(p: P): string {
  const raw = describeLocation(p, false);
  if (raw.startsWith("a sharp angle")) return "Sharp angle";
  if (raw.endsWith("circle")) return "Circle";
  if (raw.endsWith("half wall")) return "Half wall";
  if (raw.endsWith("wing")) return "Wing";
  if (raw === "the neutral zone" || raw === "the defensive zone") return "Long range";
  const name = raw.replace(/^the /, "");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const share = (points: P[]) => {
  const m = new Map<string, number>();
  for (const p of points) m.set(areaOf(p), (m.get(areaOf(p)) ?? 0) + 1);
  return m;
};

/** Share of attempts per named area. With a baseline, a tick marks the baseline's share and the delta is shown. */
export function ZoneBars({ points, baseline }: { points: P[]; baseline?: P[] }) {
  const rows = useMemo(() => {
    const a = share(points), b = baseline?.length ? share(baseline) : undefined;
    const n = points.length || 1, nb = baseline?.length || 1;
    return [...a.entries()].sort((x, y) => y[1] - x[1]).slice(0, 7)
      .map(([label, count]) => ({ label, count, pct: (count / n) * 100, base: b ? ((b.get(label) ?? 0) / nb) * 100 : undefined }));
  }, [points, baseline]);
  if (!points.length) return null;
  const max = Math.max(...rows.map((r) => Math.max(r.pct, r.base ?? 0)), 1);
  return (
    <div className="zones" aria-label="Share of attempts by area">
      {rows.map((r) => (
        <div key={r.label} className="zone-row">
          <span>{r.label}</span>
          <div className="zone-bar"><i style={{ width: `${(r.pct / max) * 100}%` }} />{r.base !== undefined && <u style={{ left: `${(r.base / max) * 100}%` }} title={`League ${r.base.toFixed(0)}%`} />}</div>
          <b>{r.pct.toFixed(0)}%</b>
          {r.base !== undefined && <small className={r.pct - r.base >= 0 ? "up" : "down"}>{r.pct - r.base >= 0 ? "+" : "−"}{Math.abs(r.pct - r.base).toFixed(0)}</small>}
        </div>
      ))}
    </div>
  );
}
