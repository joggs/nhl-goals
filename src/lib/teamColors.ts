// Primary/secondary team colours as hex, taken from Wikipedia's Module:Sports color/ice hockey
// (cross-checked against TruColor's official-colour list where it covers the team).
// `vivid()` picks/lightens one that reads well as an accent on the dark UI.
const RAW: Record<string, [string, string]> = {
  ANA: ["#CF4520", "#89734C"],
  BOS: ["#010101", "#FFB81C"],
  BUF: ["#003087", "#FFB81C"],
  CGY: ["#C8102E", "#F1BE48"],
  CAR: ["#000000", "#CC0000"],
  CHI: ["#CE1126", "#010101"],
  COL: ["#8A2432", "#236093"],
  CBJ: ["#041E42", "#C8102E"],
  DAL: ["#00823E", "#000000"],
  DET: ["#C8102E", "#FFFFFF"],
  EDM: ["#00205B", "#D14520"],
  FLA: ["#C8102E", "#041E42"],
  LAK: ["#010101", "#A2AAAD"],
  MIN: ["#0E4431", "#AC1A2E"],
  MTL: ["#A6192E", "#001E62"],
  NSH: ["#FFB81C", "#041E42"],
  NJD: ["#CC0000", "#000000"],
  NYI: ["#003087", "#FC4C02"],
  NYR: ["#154B94", "#C32032"],
  OTT: ["#010101", "#C8102E"],
  PHI: ["#D24303", "#000000"],
  PIT: ["#000000", "#FFB81C"],
  SEA: ["#001425", "#96D8D8"],
  SJS: ["#00778B", "#010101"],
  STL: ["#006AC6", "#FFB81C"],
  TBL: ["#00205B", "#FFFFFF"],
  TOR: ["#00205B", "#FFFFFF"],
  UTA: ["#010101", "#7AB2E0"],
  VAN: ["#00205B", "#046A38"],
  VGK: ["#B9975B", "#333F48"],
  WSH: ["#C8102E", "#041E42"],
  WPG: ["#041E42", "#004A98"],
};

// Extra colours found in each club's dark-background logo, used when two clubs would otherwise look alike.
const ALT: Record<string, string[]> = {
  ANA: ["#89734c"], BUF: ["#ffb81c", "#c8102e"], CGY: ["#f1be48"], CAR: ["#a2aaad"],
  CHI: ["#fedd00", "#f5812b", "#d9a510"], COL: ["#236192", "#c1c6c8"], CBJ: ["#a2aaad", "#c8102e"],
  DAL: ["#a2aaad", "#00843d"], EDM: ["#cf4520"], FLA: ["#b9975b", "#c8102e"], LAK: ["#a2aaad"],
  MIN: ["#eaaa00", "#ddcba4", "#a6192e"], MTL: ["#001e62"], NSH: ["#ffb81c"], NJD: ["#cd001a"],
  NYI: ["#fc4c02"], NYR: ["#c8102e"], OTT: ["#b9975b"], PHI: ["#dc4405"], PIT: ["#ffb81c"],
  SEA: ["#9cdbd9", "#6ba4b8", "#c8102e"], SJS: ["#e57200"], STL: ["#ffb81c"], UTA: ["#6cace4"],
  VAN: ["#97999b"], VGK: ["#b9975b"], WSH: ["#c8102e"], WPG: ["#a2aaad", "#a6192e"],
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

const parseCss = (c: string): [number, number, number] => {
  const m = c.match(/hsl\((\d+) (\d+)% (\d+)%\)/)!;
  return [+m[1], +m[2] / 100, +m[3] / 100];
};
const hueGap = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
/** Two colours that can be told apart at a glance: different hue, or a silver/grey against a saturated colour. */
const apart = (a: [number, number, number], b: [number, number, number]) =>
  (a[1] < 0.2) !== (b[1] < 0.2) || (a[1] >= 0.2 && hueGap(a[0], b[0]) >= 40) || (a[1] < 0.2 && b[1] < 0.2 && Math.abs(a[2] - b[2]) >= 0.3);
/** A logo colour made readable on the dark UI. Greys stay grey. */
const readable = (hex: string): string => {
  const [h, sat, l] = hslOf(hex);
  return css(sat < 0.2 ? [h, sat, Math.min(Math.max(l, 0.6), 0.78)] : [h, Math.max(sat, 0.55), Math.min(Math.max(l, 0.52), 0.68)]);
};

/** Colours for the two sides of a game. When both clubs read alike, one of them switches to another colour
 *  from its own logo that stands apart from the other club's colour. */
export function gameColors(away: string, home: string): [string, string] {
  const a = teamColor(away).vivid, h = teamColor(home).vivid;
  if (apart(parseCss(a), parseCss(h))) return [a, h];
  for (const c of (ALT[home] ?? []).map(readable)) if (apart(parseCss(a), parseCss(c))) return [a, c];
  for (const c of (ALT[away] ?? []).map(readable)) if (apart(parseCss(c), parseCss(h))) return [c, h];
  return [a, h];
}

/** Inline CSS variables for a game card/scoreboard. */
export const gameVars = (away: string, home: string) => {
  const [ta, th] = gameColors(away, home);
  return { "--ta": ta, "--th": th } as React.CSSProperties;
};
