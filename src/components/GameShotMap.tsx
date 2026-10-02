import { useMemo, useState } from "react";
import type { Game, Goal } from "../../shared/types";
import { useData } from "../lib/data";
import { useShots, type Shot } from "../lib/shots";
import { Chip, ClipModal, TeamLogo } from "./ui";
import { Rink } from "./RinkMap";
import { periodLabel } from "../lib/util";
import { ZoneBars } from "./ZoneBars";

const KIND = ["Saved", "Missed", "Blocked"] as const;
const STRENGTH = ["", " · power play", " · short-handed"] as const;
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
const per = (p: number) => (p <= 3 ? `P${p}` : p === 4 ? "OT" : `${p - 3}OT`);
interface Tip { map: string; x: number; y: number; flip: boolean; head: string; lines: string[] }

/** One rink per team with every shot attempt of the game. Goals are bigger; clicking one plays its clip. */
export function GameShotMap({ game }: { game: Game }) {
  const { players } = useData();
  const [open, setOpen] = useState(true);
  const [play, setPlay] = useState<Goal>();
  const [tip, setTip] = useState<Tip>();
  const shots = useShots(game.season, open);
  const mine = useMemo(() => (shots ?? []).filter((s) => s.game === game.id && s.kind !== 3), [shots, game.id]);
  const sides = [game.away.abbrev, game.home.abbrev];
  const name = (id: number) => players[id]?.n ?? "Unknown";
  const at = (map: string, head: string, lines: string[]) => (e: React.MouseEvent<SVGCircleElement>) => {
    const box = e.currentTarget.closest(".game-map")!.getBoundingClientRect();
    setTip({ map, x: e.clientX - box.left, y: e.clientY - box.top, flip: e.clientX - box.left > box.width * 0.55, head, lines });
  };
  return (
    <div>
      <div className="row between">
        <h2>Shot map</h2>
        <Chip active={open} onClick={() => setOpen(!open)}>{open ? "Hide" : "Show shots"}</Chip>
      </div>
      {open && (shots === undefined ? <div className="spinner" /> : shots === null ? <p className="empty">No shot data for this season.</p> : (
        <>
          <div className="game-maps">
            {sides.map((abbrev) => {
              const own = mine.filter((s: Shot) => s.team === abbrev);
              const goals = game.goals.filter((g) => g.team === abbrev && !g.ownGoal && g.x !== undefined);
              const c = [0, 1, 2].map((k) => own.filter((s) => s.kind === k).length);
              return (
                <div key={abbrev} className="game-map">
                  {tip?.map === abbrev && <div className={`map-tip${tip.flip ? " flip" : ""}`} style={{ left: tip.x, top: tip.y }}><b>{tip.head}</b>{tip.lines.map((l, i) => <span key={i}>{l}</span>)}</div>}
                  <h3><TeamLogo abbrev={abbrev} size={22} /> {abbrev}</h3>
                  <div className="rink">
                    <Rink label={`${abbrev} shots`}>
                      {own.map((s, i) => (
                        <circle key={i} cx={s.x} cy={42.5 + s.y} r="1" className={`shot shot-${s.kind}`} onMouseMove={at(abbrev, name(s.player), [`${KIND[s.kind as 0 | 1 | 2]}${s.type ? ` · ${s.type} shot` : ""}`, `${per(s.period)} ${mmss(s.sec)}${STRENGTH[s.strength]}`])} onMouseLeave={() => setTip(undefined)} />
                      ))}
                      {goals.map((g) => (
                        <circle key={g.id} cx={g.x} cy={42.5 + g.y!} r="2" className={`shot shot-3${g.clip ? " clickable" : ""}`} onClick={() => g.clip && setPlay(g)}
                          onMouseMove={at(abbrev, `⚽ ${g.scorer.name}`, [
                            `Goal${g.shotType ? ` · ${g.shotType} shot` : ""} · ${g.distance ?? "?"} ft`,
                            `${periodLabel(g)} ${g.time}${STRENGTH[g.strength === "PP" ? 1 : g.strength === "SH" ? 2 : 0]}${g.emptyNet ? " · empty net" : ""}`,
                            g.assists.length ? `Assists: ${g.assists.map((a) => a.name).join(", ")}` : "Unassisted",
                            `${game.away.abbrev} ${g.away} – ${g.home} ${game.home.abbrev}`,
                            ...(g.clip ? ["Click to watch"] : []),
                          ])} onMouseLeave={() => setTip(undefined)} />
                      ))}
                    </Rink>
                  </div>
                  <ZoneBars points={[...own, ...goals.map((g) => ({ x: g.x!, y: g.y! }))]} />
                  <p className="muted rink-cap">{goals.length} goals · {c[0]} saved · {c[1]} missed · {c[2]} blocked</p>
                </div>
              );
            })}
          </div>
          <p className="muted rink-cap"><span className="dot dot-3" /> goal (click to watch) · <span className="dot dot-0" /> saved · <span className="dot dot-1" /> missed · <span className="dot dot-2" /> blocked. Each team attacks the net on the right.</p>
        </>
      ))}
      {play && <ClipModal goal={play} onClose={() => setPlay(undefined)} />}
    </div>
  );
}
