import { useSyncExternalStore } from "react";

const KEY = "favTeams";
const read = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
let snapshot = JSON.stringify(read());
const subs = new Set<() => void>();
const emit = () => { snapshot = JSON.stringify(read()); subs.forEach((f) => f()); };
window.addEventListener("storage", emit);

export function useFavorites() {
  const raw = useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => snapshot);
  const teams: string[] = JSON.parse(raw);
  const toggle = (abbrev: string) => {
    const cur = read();
    localStorage.setItem(KEY, JSON.stringify(cur.includes(abbrev) ? cur.filter((t) => t !== abbrev) : [...cur, abbrev]));
    emit();
  };
  return { teams, toggle, has: (a: string) => teams.includes(a) };
}
