/**
 * Shared GitHub API helpers used by the grove CLI.
 *
 *   - ghFetch:      fetch + JSON parse + 2-attempt exponential backoff
 *   - rateLimitWaitMs: read X-RateLimit-Reset header and return ms to wait
 *   - sleep:        small helper
 *   - pLimit:       tiny concurrency cap (no external deps)
 *
 * These exist so a single transient 5xx doesn't fail an entire daily
 * refresh, and so we can run the per-app loop with bounded concurrency
 * instead of one round-trip at a time.
 */

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "grove-bot",
};

export interface GhFetchOptions {
  token?: string;
  userAgent?: string;
  attempts?: number;
  onRateLimited?: () => number;
}

export function rateLimitWaitMs(res: Response, capMs = 5 * 60_000): number {
  const reset = res.headers.get("x-ratelimit-reset");
  if (!reset) return 0;
  const resetMs = Number(reset) * 1000 - Date.now();
  if (!Number.isFinite(resetMs) || resetMs <= 0) return 0;
  return Math.min(resetMs, capMs);
}

export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((r) => setTimeout(r, ms));
}

export async function ghFetch(path: string, options: GhFetchOptions = {}): Promise<Response> {
  const { token, userAgent, attempts = 2, onRateLimited } = options;
  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(userAgent ? { "User-Agent": userAgent } : {}),
  };
  let lastErr: Error | undefined;
  for (let i = 0; i < attempts; i++) {
    let res: Response;
    try {
      res = await fetch(`https://api.github.com${path}`, { headers });
    } catch (err) {
      lastErr = err as Error;
      if (i < attempts - 1) {
        await sleep(500 * Math.pow(2, i));
        continue;
      }
      throw err;
    }
    if (
      res.status === 429 ||
      (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0")
    ) {
      const wait = onRateLimited ? onRateLimited() : rateLimitWaitMs(res);
      if (wait > 0) {
        console.warn(`[ghFetch] rate limited, waiting ${Math.round(wait / 1000)}s for ${path}`);
        await sleep(wait);
        continue;
      }
    }
    if (res.status >= 500 && i < attempts - 1) {
      lastErr = new Error(`GitHub ${res.status} ${res.statusText} for ${path}`);
      await sleep(500 * Math.pow(2, i));
      continue;
    }
    return res;
  }
  throw lastErr ?? new Error(`ghFetch: gave up after ${attempts} attempts for ${path}`);
}

/**
 * Tiny p-limit implementation: a promise-pool that caps how many
 * `fn(item)` calls run at once. Await the returned promise to get the
 * full results array in input order.
 */
export async function pLimit<T, U>(
  concurrency: number,
  items: T[],
  fn: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  const out = new Array<U>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  };
  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return out;
}
