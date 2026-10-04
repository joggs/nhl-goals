// The NHL API reports imperial units; the app shows metric.
export const kmh = (mph: number) => mph * 1.609344;
export const metres = (ft: number) => ft * 0.3048;
export const km = (mi: number) => mi * 1.609344;
export const fmtM = (ft: number) => `${Math.round(metres(ft))} m`;
