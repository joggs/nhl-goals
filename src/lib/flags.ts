// ISO-3 (as used by the NHL) -> ISO-2, for flag emoji.
const ISO3to2: Record<string, string> = {
  CAN: "CA", USA: "US", SWE: "SE", FIN: "FI", RUS: "RU", CZE: "CZ", SVK: "SK", CHE: "CH", SUI: "CH", DEU: "DE", GER: "DE",
  DNK: "DK", DEN: "DK", NOR: "NO", LVA: "LV", LAT: "LV", BLR: "BY", UKR: "UA", KAZ: "KZ", FRA: "FR", AUT: "AT", GBR: "GB",
  SVN: "SI", SLO: "SI", LTU: "LT", POL: "PL", HUN: "HU", ITA: "IT", JPN: "JP", KOR: "KR", CHN: "CN", AUS: "AU", NLD: "NL",
  BEL: "BE", EST: "EE", ISR: "IL", BRA: "BR", NGA: "NG", JAM: "JM", BHS: "BS", BRB: "BB", HRV: "HR", SRB: "RS", ROU: "RO",
  LUX: "LU", IRL: "IE", ESP: "ES", ARG: "AR", MEX: "MX", NZL: "NZ", ZAF: "ZA", HKG: "HK", TWN: "TW", BGR: "BG", ISL: "IS",
  GRC: "GR", TUR: "TR", LIE: "LI", DOM: "DO", TTO: "TT", BMU: "BM", GUY: "GY", HTI: "HT", COL: "CO", VEN: "VE", PHL: "PH",
  UZB: "UZ", MKD: "MK", BIH: "BA", GEO: "GE", MDA: "MD", ARM: "AM", AZE: "AZ", SGP: "SG", THA: "TH", IND: "IN",
};
export function flag(code?: string): string {
  if (!code) return "🏳️";
  if (code === "ENG" || code === "SCO" || code === "WAL") return "🏴";
  const a = ISO3to2[code] ?? (code.length === 2 ? code : undefined);
  if (!a) return "🏳️";
  return String.fromCodePoint(...[...a].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
