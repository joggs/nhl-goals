// Minimal NHL web API client: retries, concurrency limit, on-disk cache for finished games.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const WEB = "https://api-web.nhle.com/v1";
const STATS = "https://api.nhle.com/stats/rest/en";
const UA = "nhl-goals/0.1 (personal project; https://github.com/joggs/nhl-goals)";

export async function getJson<T = any>(url: string, tries = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, redirect: "follow" });
      if (res.status === 404) throw Object.assign(new Error(`404 ${url}`), { notFound: true });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return (await res.json()) as T;
    } catch (e: any) {
      if (e?.notFound) throw e;
      last = e;
      await new Promise((r) => setTimeout(r, 400 * 2 ** i));
    }
  }
  throw last;
}

export const web = <T = any>(path: string) => getJson<T>(`${WEB}${path}`);
export const stats = <T = any>(path: string) => getJson<T>(`${STATS}${path}`);

export async function pool<T, R>(items: T[], size: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

export async function cached<T>(file: string, finalOnly: boolean, load: () => Promise<T>): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch { /* miss */ }
  const v = await load();
  if (finalOnly) {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(v));
  }
  return v;
}
