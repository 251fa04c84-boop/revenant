import type { Dep, RegistryInfo } from './types';
import { monthsBetween } from './classify';

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
/** Packages this old (or deprecated) are the only ones we spend a downloads lookup on. */
const DOWNLOADS_LOOKUP_AFTER_MONTHS = 18;

export function registryUrl(name: string): string {
  // Scoped names must keep a literal "@" and an encoded "/".
  return `https://registry.npmjs.org/${encodeURIComponent(name).replace(/^%40/, '@')}`;
}

async function timedFetch(fetcher: Fetcher, url: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetcher(url, { headers: { accept: 'application/json' }, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function retryDelayMs(response: Response, attempt: number): number {
  const header = response.headers.get('retry-after');
  if (header) {
    const seconds = Number(header);
    const dateDelay = Number.isNaN(seconds) ? Date.parse(header) - Date.now() : seconds * 1_000;
    if (Number.isFinite(dateDelay)) return Math.max(0, Math.min(dateDelay, 2_000));
  }
  return Math.min(250 * 2 ** attempt, 2_000);
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Turns a raw packument into the few fields we care about. Exported for tests. */
export function extractInfo(name: string, doc: unknown): RegistryInfo {
  const d = (doc ?? {}) as {
    'dist-tags'?: { latest?: string };
    versions?: Record<string, { deprecated?: unknown }>;
    time?: Record<string, string>;
  };
  const time = d.time ?? {};
  if (time.unpublished) {
    return { name, deprecated: 'This package was unpublished from npm.' };
  }
  let latest = d['dist-tags']?.latest;
  if (!latest) {
    // No "latest" tag: fall back to the most recently published version.
    const dated = Object.entries(time)
      .filter(([k]) => k !== 'created' && k !== 'modified')
      .sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]));
    latest = dated[0]?.[0];
  }
  if (!latest) return { name, error: 'not-found' };
  const raw = d.versions?.[latest]?.deprecated;
  const deprecated = typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
  return { name, latest, deprecated, lastPublish: time[latest] };
}

export async function fetchInfo(name: string, fetcher: Fetcher = fetch): Promise<RegistryInfo> {
  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const res = await timedFetch(fetcher, registryUrl(name));
      if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
        await wait(retryDelayMs(res, attempt));
        continue;
      }
      if (res.status === 404) return { name, error: 'not-found' };
      if (!res.ok) return { name, error: 'network' };
      return extractInfo(name, await res.json());
    }
    return { name, error: 'network' };
  } catch {
    return { name, error: 'network' };
  }
}

/** Best effort: the downloads API is only used to tell "finished" from "abandoned". */
export async function fetchWeeklyDownloads(
  name: string,
  fetcher: Fetcher = fetch,
): Promise<number | undefined> {
  try {
    const res = await timedFetch(fetcher, `https://api.npmjs.org/downloads/point/last-week/${name}`);
    if (!res.ok) return undefined;
    const body = (await res.json()) as { downloads?: unknown };
    return typeof body.downloads === 'number' ? body.downloads : undefined;
  } catch {
    return undefined;
  }
}

export async function lookup(
  dep: Dep,
  fetcher: Fetcher = fetch,
  now: Date = new Date(),
): Promise<RegistryInfo> {
  const info = await fetchInfo(dep.name, fetcher);
  if (info.error) return info;
  const age = info.lastPublish ? monthsBetween(info.lastPublish, now) : undefined;
  const stale = age !== undefined && age >= DOWNLOADS_LOOKUP_AFTER_MONTHS;
  if (stale && !info.deprecated) {
    info.weeklyDownloads = await fetchWeeklyDownloads(dep.name, fetcher);
  }
  return info;
}

/** Runs `fn` over `items` with bounded concurrency, preserving order. */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Concurrency limit must be a positive integer.');
  const results = new Array<R>(items.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i] as T, i);
      onProgress?.(++done, items.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
