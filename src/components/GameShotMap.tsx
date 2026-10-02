import { useMemo, useState } from "react";
import type { Game, Goal } from "../../shared/types";
import { useData } from "../lib/data";
import { useShots, type Shot } from "../lib/shots";
import { Chip, ClipModal, TeamLogo } from "./ui";
import { Rink } from "./RinkMap";
import { ZoneBars } from "./ZoneBars";

const KIND = ["saved", "missed", "blocked"] as const;

/** One rink per team with every shot attempt of the game. Goals are bigger; clicking one plays its clip. */
export function GameShotMap({ game }: { game: Game }) {
  const { players } = useData();
  const [open, setOpen] = useState(true);
  const [play, setPlay] = useState<Goal>();
  const shots = useShots(game.season, open);
  const mine = useMemo(() => (shots ?? []).filter((s) => s.game === game.id && s.kind !== 3), [shots, game.id]);
  const sides = [game.away.abbrev, game.home.abbrev];
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
                  <h3><TeamLogo abbrev={abbrev} size={22} /> {abbrev}</h3>
                  <div className="rink">
                    <Rink label={`${abbrev} shots`}>
                      {own.map((s, i) => (
                        <circle key={i} cx={s.x} cy={42.5 + s.y} r="1" className={`shot shot-${s.kind}`}>
                          <title>{`${players[s.player]?.n ?? "Unknown"} · ${KIND[s.kind as 0 | 1 | 2]}`}</title>
                        </circle>
                      ))}
                      {goals.map((g) => (
                        <circle key={g.id} cx={g.x} cy={42.5 + g.y!} r="2" className={`shot shot-3${g.clip ? " clickable" : ""}`} onClick={() => g.clip && setPlay(g)}>
                          <title>{g.text}</title>
                        </circle>
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
