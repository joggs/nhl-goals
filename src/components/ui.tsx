import { Link } from "react-router-dom";
import type { Goal } from "../../shared/types";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "../lib/data";
import { flag } from "../lib/flags";
import { headshot, logo, periodLabel } from "../lib/util";
import { useFavorites } from "../lib/favorites";
import { useSpoilers } from "../lib/spoilers";
import { clipSource } from "../lib/clip";
import { teamColor } from "../lib/teamColors";
import { MiniRink } from "./RinkMap";

export const TvIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="6" width="20" height="14" rx="2.5" /><path d="M8 2l4 4 4-4" />
  </svg>
);

/** Plays one goal clip inline, loading a fresh signed MP4 URL when mounted. */
export function ClipPlayer({ clip, pageUrl }: { clip: number; pageUrl?: string }) {
  const [state, setState] = useState<{ src?: string; error?: boolean }>({});
  useEffect(() => {
    let live = true;
    clipSource(clip).then((c) => live && setState({ src: c.src })).catch(() => live && setState({ error: true }));
    return () => { live = false; };
  }, [clip]);
  if (state.error) return <p className="muted">Clip unavailable here. {pageUrl && <a href={pageUrl} target="_blank" rel="noreferrer">Open on NHL.com ↗</a>}</p>;
  if (!state.src) return <div className="video loading" />;
  return <video className="video" src={state.src} controls autoPlay playsInline preload="auto" />;
}

/** Large centred player for a goal clip. Closes on backdrop click, the ✕ button or Escape. */
export function VideoModal({ clip, pageUrl, caption, label = "Goal video", onClose }: { clip?: number; pageUrl?: string; caption?: string; label?: string; onClose: () => void }) {
  // Closing must never let the same tap/click reach the page underneath (it would open another clip),
  // so for a moment after closing any click in the document is swallowed.
  const down = useRef<boolean | null>(null); // did the press start on the backdrop? (null = touch, no mousedown)
  const close = () => {
    const swallow = (e: Event) => { e.stopPropagation(); e.preventDefault(); };
    window.addEventListener("click", swallow, true);
    window.setTimeout(() => window.removeEventListener("click", swallow, true), 450);
    onClose();
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);
  if (!clip) return null;
  return createPortal(
    <div className="modal-back" role="dialog" aria-modal="true" aria-label={label}
      onMouseDown={(e) => { down.current = e.target === e.currentTarget; }}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); const ok = down.current !== false && e.target === e.currentTarget; down.current = null; if (ok) close(); }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={close} aria-label="Close">✕</button>
        <ClipPlayer clip={clip} pageUrl={pageUrl} />
        {caption && <p className="modal-cap">{caption}</p>}
        {pageUrl && <a className="modal-link" href={pageUrl} target="_blank" rel="noreferrer">NHL.com ↗</a>}
      </div>
    </div>,
    document.body,
  );
}

export const ClipModal = ({ goal, onClose }: { goal: Goal; onClose: () => void }) =>
  <VideoModal clip={goal.clip} pageUrl={goal.clipUrl} caption={goal.text} onClose={onClose} />;

export const TeamLogo = ({ abbrev, size = 28 }: { abbrev: string; size?: number }) => (
  <img className="logo" src={logo(abbrev)} width={size} height={size} alt={abbrev} loading="lazy" />
);

export function Face({ id, size = 36 }: { id: number; size?: number }) {
  const { players } = useData();
  const h = headshot(players[id]?.h);
  return h ? <img className="face" src={h} width={size} height={size} alt="" loading="lazy" /> : <span className="face ph" style={{ width: size, height: size }} />;
}

export function Flag({ code, title }: { code?: string; title?: string }) {
  const { manifest } = useData();
  return <span className="flag" title={title ?? (code ? manifest.countries[code] ?? code : "Unknown")}>{flag(code)}</span>;
}

export function Chip({ active, onClick, children, title }: { active?: boolean; onClick?: () => void; children: React.ReactNode; title?: string }) {
  return <button className={`chip${active ? " on" : ""}`} onClick={onClick} title={title}>{children}</button>;
}

export function StarButton({ abbrev }: { abbrev: string }) {
  const { has, toggle } = useFavorites();
  return (
    <button className={`star${has(abbrev) ? " on" : ""}`} onClick={(e) => { e.preventDefault(); toggle(abbrev); }} aria-label="Favourite" title="Favourite team">
      {has(abbrev) ? "★" : "☆"}
    </button>
  );
}

const TAG_LABEL: Record<string, string> = {
  powerplay: "PP", shorthanded: "SH", emptynet: "EN", penaltyshot: "Penalty shot", gwg: "GWG", otwinner: "OT winner",
  hattrick: "Hat trick", "go-ahead": "Go-ahead", tying: "Tying", opener: "Opener", longrange: "Long range", owngoal: "Own goal",
};
export const tagLabel = (t: string) => TAG_LABEL[t];

export function GoalCard({ goal, showGame = true, compact = false, minimap = false, lead }: { goal: Goal; showGame?: boolean; compact?: boolean; minimap?: boolean; lead?: "scorer" | "assists" }) {
  const { players, gameById } = useData();
  const info = players[goal.scorer.id];
  const game = gameById.get(goal.gameId);
  const [video, setVideo] = useState(false);
  const sp = useSpoilers();
  if (sp.hidden(game)) {
    return (
      <article className="goal masked">
        <div className="goal-body">
          <p className="goal-text">🙈 Goal hidden</p>
          <div className="goal-meta">
            <span>{goal.team} goal</span>
            {game && <Link to={`/game/${game.id}`}>{game.away.abbrev} @ {game.home.abbrev}</Link>}
            <button className="linkbtn" onClick={() => sp.reveal([goal.gameId])}>Reveal game</button>
          </div>
        </div>
      </article>
    );
  }
  const tags = goal.tags.map(tagLabel).filter(Boolean);
  const faceId = lead === "assists" && goal.assists.length ? goal.assists[0].id : goal.scorer.id;
  const scorerLine = (
    <p className="goal-who">
      <Link to={`/player/${goal.scorer.id}`}><Flag code={info?.nat} /> {goal.scorer.name}</Link>
      <span> · {goal.team}{goal.seasonGoal ? ` · goal #${goal.seasonGoal}` : ""}</span>
    </p>
  );
  const assistLine = goal.assists.length > 0 ? (
    <p className="goal-assists">
      <span>Assists</span>
      {goal.assists.map((a) => <Link key={a.id} to={`/player/${a.id}`}><Flag code={players[a.id]?.nat} /> {a.name}</Link>)}
    </p>
  ) : <p className="goal-assists"><span>Unassisted</span></p>;
  return (
    <article className={`goal${goal.tags.includes("otwinner") ? " hot" : ""}${goal.clip ? " playable" : ""}`} onClick={(e) => { if (goal.clip && !(e.target as HTMLElement).closest("a,button,video,input")) setVideo((v) => !v); }} style={{ "--tc": teamColor(goal.team).vivid } as React.CSSProperties}>
      <Link to={`/player/${faceId}`} className="goal-face"><Face id={faceId} size={compact ? 44 : 56} /></Link>
      <img className="goal-wm" src={logo(goal.team)} alt="" aria-hidden="true" loading="lazy" />
      <div className="goal-body">
        {lead && <div className="goal-lead">{lead === "scorer" ? scorerLine : assistLine}</div>}
        <p className={`goal-text${goal.clip ? " clickable" : ""}`}>{goal.text}</p>
        {lead !== "scorer" && scorerLine}
        {lead !== "assists" && goal.assists.length > 0 && assistLine}
        <div className="goal-meta">
          <span className="score-pill" title="Score after the goal">
            {game ? (
              <>
                <span className={goal.team === game.away.abbrev ? "sc-hit" : ""}>{game.away.abbrev} {goal.away}</span>
                {" – "}
                <span className={goal.team === game.home.abbrev ? "sc-hit" : ""}>{goal.home} {game.home.abbrev}</span>
              </>
            ) : `${goal.away}–${goal.home}`}
          </span>
          <span>{periodLabel(goal)} · {goal.time}</span>
          {showGame && game && <Link to={`/game/${game.id}`}>{game.away.abbrev} @ {game.home.abbrev}</Link>}
          {goal.distance !== undefined && <span>{goal.distance} ft</span>}
          {tags.map((t) => <span key={t} className="tag">{t}</span>)}
          {goal.clip && (
            <button className={`tv mini${video ? " on" : ""}`} onClick={() => setVideo((v) => !v)} aria-label={video ? "Hide video" : "Play goal video"} title={video ? "Hide video" : "Watch the goal here"}>
              <TvIcon />
            </button>
          )}
        </div>
        {video && goal.clip && <ClipModal goal={goal} onClose={() => setVideo(false)} />}
      </div>
      {minimap && <MiniRink goal={goal} />}
    </article>
  );
}
