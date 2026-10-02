import { useData } from "../lib/data";
import { TeamLogo } from "../components/ui";
import { teamColor } from "../lib/teamColors";
import type { StandingRow } from "../../shared/types";

const DIVISIONS = [["Eastern", ["Atlantic", "Metropolitan"]], ["Western", ["Central", "Pacific"]]] as const;

function DivisionTable({ name, rows }: { name: string; rows: StandingRow[] }) {
  return (
    <div className="stand">
      <h3>{name}</h3>
      <table className="table stand-table">
        <thead>
          <tr>
            <th>#</th><th>Team</th><th title="Games played">GP</th><th>W</th><th>L</th><th title="Overtime losses">OTL</th><th title="Points">PTS</th>
            <th className="hide-sm" title="Points percentage">P%</th><th className="hide-sm" title="Regulation + overtime wins">ROW</th>
            <th className="hide-sm">GF</th><th className="hide-sm">GA</th><th title="Goal difference">DIFF</th><th className="hide-sm" title="Last ten games, W-L-OTL">L10</th><th title="Current streak">STRK</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.abbrev} className={r.divRank === 3 ? "cut" : ""} style={{ "--tc": teamColor(r.abbrev).vivid } as React.CSSProperties}>
              <td>{r.divRank}</td>
              <td><span className="pl"><TeamLogo abbrev={r.abbrev} size={22} /> {r.name}{r.wc > 0 && r.wc <= 2 && <span className="tag" title="Wild-card spot">WC{r.wc}</span>}</span></td>
              <td>{r.gp}</td><td>{r.w}</td><td>{r.l}</td><td>{r.otl}</td><td><b>{r.pts}</b></td>
              <td className="hide-sm">{r.gp ? r.ptsPct.toFixed(3).replace(/^0/, "") : "–"}</td><td className="hide-sm">{r.row}</td>
              <td className="hide-sm">{r.gf}</td><td className="hide-sm">{r.ga}</td>
              <td>{r.gf - r.ga > 0 ? "+" : ""}{r.gf - r.ga}</td><td className="hide-sm">{r.l10}</td><td>{r.streak ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Standings() {
  const { standings, manifest, season: id } = useData();
  const season = manifest.seasons.find((s) => s.id === id)?.label;
  return (
    <section>
      <div className="row between"><h1>Standings</h1><span className="muted">{season}{id === manifest.currentSeason ? "" : " · final regular-season table"} · top three per division make the playoffs, plus two wild cards per conference</span></div>
      {DIVISIONS.map(([conf, divs]) => (
        <div key={conf}>
          <h2>{conf} Conference</h2>
          {divs.map((d) => <DivisionTable key={d} name={d} rows={standings.filter((r) => r.division === d).sort((a, b) => a.divRank - b.divRank)} />)}
        </div>
      ))}
    </section>
  );
}
