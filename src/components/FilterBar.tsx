import { useMemo } from "react";
import { useData } from "../lib/data";
import { RANGES, type GoalFilter } from "../lib/filters";
import { flag } from "../lib/flags";
import { useFavorites } from "../lib/favorites";
import { Chip } from "./ui";

const TAGS = [
  ["powerplay", "Power play"], ["shorthanded", "Shorthanded"], ["emptynet", "Empty net"], ["penaltyshot", "Penalty shot"],
  ["gwg", "Game-winners"], ["otwinner", "OT winners"], ["hattrick", "Hat tricks"], ["go-ahead", "Go-ahead"], ["tying", "Equalizers"],
  ["longrange", "60+ ft"],
] as const;

export function FilterBar({ f, set, hide = [] }: { f: GoalFilter; set: (p: Partial<GoalFilter>) => void; hide?: string[] }) {
  const { goals, players, teams, manifest } = useData();
  const { teams: favs } = useFavorites();
  const nats = useMemo(() => {
    const c = new Map<string, number>();
    const add = (id: number) => { const n = players[id]?.nat ?? "?"; c.set(n, (c.get(n) ?? 0) + 1); };
    for (const g of goals) {
      if (f.natRole !== "assist") add(g.scorer.id);
      if (f.natRole !== "scorer") g.assists.forEach((a) => add(a.id));
    }
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [goals, players, f.natRole]);
  const toggle = (key: "nat" | "team" | "strength" | "tags" | "period", v: string) =>
    set({ [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] } as Partial<GoalFilter>);

  return (
    <div className="filterbar">
      {!hide.includes("range") && (
        <div className="row">
          {RANGES.map((r) => <Chip key={r.id} active={f.range === r.id} onClick={() => set({ range: r.id })}>{r.label}</Chip>)}
          <span className="dates">
            <input type="date" value={f.from ?? ""} onChange={(e) => set({ range: "custom", from: e.target.value, to: f.to ?? e.target.value })} aria-label="From" />
            <span>→</span>
            <input type="date" value={f.to ?? ""} onChange={(e) => set({ range: "custom", to: e.target.value, from: f.from ?? e.target.value })} aria-label="To" />
          </span>
        </div>
      )}
      {!hide.includes("type") && (
        <div className="row">
          {([["", "All games"], ["02", "Regular season"], ["03", "Stanley Cup"]] as const).map(([v, l]) => <Chip key={v} active={f.type === v} onClick={() => set({ type: v })}>{l}</Chip>)}
        </div>
      )}
      <div className="row">
        <input className="search" placeholder="Search player…" value={f.q} onChange={(e) => set({ q: e.target.value })} />
        {!hide.includes("nat") && (
          <select value="" onChange={(e) => e.target.value && toggle("nat", e.target.value)} aria-label="Nationality">
            <option value="">🌍 Nationality…</option>
            {nats.map(([n, k]) => <option key={n} value={n}>{flag(n)} {manifest.countries[n] ?? n} ({k})</option>)}
          </select>
        )}
        {!hide.includes("team") && (
          <select value="" onChange={(e) => e.target.value && toggle("team", e.target.value)} aria-label="Team">
            <option value="">🏒 Scoring team…</option>
            {[...teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => <option key={t.abbrev} value={t.abbrev}>{t.name}</option>)}
          </select>
        )}
        <select value={f.sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort">
          <option value="new">Newest first</option><option value="old">Oldest first</option>
          <option value="dist">Longest shots</option><option value="close">Closest shots</option>
        </select>
        {favs.length > 0 && <Chip active={f.mine} onClick={() => set({ mine: !f.mine })}>★ My teams</Chip>}
      </div>
      <div className="row">
        {f.nat.map((n) => <Chip key={n} active onClick={() => toggle("nat", n)}>{flag(n)} {manifest.countries[n] ?? n} ✕</Chip>)}
        {f.nat.length > 0 && !hide.includes("natrole") && (
          <>
            {([["scorer", "Scored by"], ["assist", "Assisted by"], ["either", "Either"]] as const).map(([r, l]) => (
              <Chip key={r} active={f.natRole === r} onClick={() => set({ natRole: r })} title="Which player the nationality filter applies to">{l}</Chip>
            ))}
            <span className="sep" />
          </>
        )}
        {f.team.map((n) => <Chip key={n} active onClick={() => toggle("team", n)}>{n} ✕</Chip>)}
        {f.against.map((n) => <Chip key={n} active onClick={() => set({ against: f.against.filter((x) => x !== n) })}>vs {n} ✕</Chip>)}
        {f.player && <Chip active onClick={() => set({ player: undefined })}>{players[f.player]?.n ?? f.player} ✕</Chip>}
      </div>
      <div className="row">
        {TAGS.map(([t, l]) => <Chip key={t} active={f.tags.includes(t)} onClick={() => toggle("tags", t)}>{l}</Chip>)}
        <span className="sep" />
        {["1", "2", "3", "OT"].map((p) => <Chip key={p} active={f.period.includes(p)} onClick={() => toggle("period", p)}>{p === "OT" ? "OT" : `P${p}`}</Chip>)}
      </div>
    </div>
  );
}
