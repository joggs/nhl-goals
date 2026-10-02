import type { Goal } from "../../shared/types";

/** Offensive half of the rink, attacking net on the right. Goal coordinates are already normalised that way (x up to +89). */
export function RinkMap({ goals }: { goals: Goal[] }) {
  const pts = goals.filter((g) => g.x !== undefined && g.y !== undefined && !g.ownGoal);
  return (
    <div className="rink">
      <svg viewBox="-2 -2 104 89" role="img" aria-label={`Map of ${pts.length} goals`}>
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
        {pts.map((g) => (
          <circle key={g.id} cx={g.x} cy={42.5 + g.y!} r="1.3" className={`rink-goal${g.strength === "PP" ? " pp" : ""}`}>
            <title>{g.text}</title>
          </circle>
        ))}
      </svg>
      <p className="muted rink-cap">{pts.length} goals · <span className="rink-key" /> power play</p>
    </div>
  );
}
