// Official-ish primary/secondary team colours (from public brand guides, hand-entered).
// `vivid()` picks/lightens one that reads well as an accent on the dark UI.
const RAW: Record<string, [string, string]> = {
  ANA: ["#F47A38", "#B9975B"], BOS: ["#FFB81C", "#000000"], BUF: ["#003087", "#FFB81C"], CGY: ["#D2001C", "#FAAF19"],
  CAR: ["#CC0000", "#A2AAAD"], CHI: ["#CF0A2C", "#000000"], COL: ["#6F263D", "#236192"], CBJ: ["#002654", "#CE1126"],
  DAL: ["#006847", "#8F8F8C"], DET: ["#CE1126", "#FFFFFF"], EDM: ["#041E42", "#FF4C00"], FLA: ["#C8102E", "#041E42"],
  LAK: ["#A2AAAD", "#111111"], MIN: ["#154734", "#A6192E"], MTL: ["#AF1E2D", "#192168"], NSH: ["#FFB81C", "#041E42"],
  NJD: ["#CE1126", "#000000"], NYI: ["#00539B", "#F47D30"], NYR: ["#0038A8", "#CE1126"], OTT: ["#C52032", "#C2912C"],
  PHI: ["#F74902", "#000000"], PIT: ["#FCB514", "#000000"], SEA: ["#001628", "#99D9D9"], SJS: ["#006D75", "#EA7200"],
  STL: ["#002F87", "#FCB514"], TBL: ["#002868", "#FFFFFF"], TOR: ["#00205B", "#FFFFFF"], UTA: ["#6CACE4", "#010101"],
  VAN: ["#00205B", "#00843D"], VGK: ["#B4975A", "#333F42"], WSH: ["#C8102E", "#041E42"], WPG: ["#041E42", "#004C97"],
};

function hslOf(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
const css = ([h, s, l]: [number, number, number]) => `hsl(${h.toFixed(0)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(0)}%)`;

export interface TeamColor { primary: string; secondary: string; vivid: string; vivid2: string }
const cache = new Map<string, TeamColor>();

export function teamColor(abbrev: string): TeamColor {
  const hit = cache.get(abbrev);
  if (hit) return hit;
  const [p, s] = RAW[abbrev] ?? ["#4cc9f0", "#7c5cff"];
  const lift = (hex: string): [number, number, number] => {
    const [h, sat, l] = hslOf(hex);
    return [h, Math.max(sat, 0.55), Math.min(Math.max(l, 0.52), 0.68)];
  };
  const hp = hslOf(p), hs = hslOf(s);
  // Prefer the colour that is already bright and saturated; otherwise lighten the primary.
  const good = (c: [number, number, number]) => c[2] >= 0.4 && c[2] <= 0.8 && c[1] >= 0.45;
  const first = good(hp) ? p : good(hs) ? s : p;
  const second = first === p ? s : p;
  const v: TeamColor = { primary: p, secondary: s, vivid: css(good(hslOf(first)) ? hslOf(first) : lift(first)), vivid2: css(good(hslOf(second)) ? hslOf(second) : lift(second)) };
  cache.set(abbrev, v);
  return v;
}

/** Inline CSS variables for a game card/scoreboard. */
export const gameVars = (away: string, home: string) =>
  ({ "--ta": teamColor(away).vivid, "--th": teamColor(home).vivid }) as React.CSSProperties;
