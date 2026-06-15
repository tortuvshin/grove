/**
 * @grove-dev/core — github-client.ts unit tests.
 *
 * Tests cover the pure-logic helpers (`rateLimitWaitMs`, `sleep`,
 * `pLimit`) and the HTTP path stub via a global `fetch` mock.
 * The brief flagged `ghFetch` as audit-worthy (exponential backoff
 * + rate-limit handling); the test pins the contract:
 *   - 429 / 403 (rate-limit) waits then retries
 *   - 5xx retries up to `attempts`
 *   - non-retryable 4xx returns immediately
 *   - exhausted attempts throw
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimitWaitMs, sleep, pLimit, ghFetch } from "./github-client.js";

describe("rateLimitWaitMs", () => {
  it("returns 0 when the header is missing", () => {
    const res = new Response("", { status: 200 });
    expect(rateLimitWaitMs(res)).toBe(0);
  });

  it("returns 0 when the reset time is in the past", () => {
    const res = new Response("", { status: 200, headers: { "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) - 60) } });
    expect(rateLimitWaitMs(res)).toBe(0);
  });

  it("returns the delta to the reset time, capped at 5 minutes", () => {
    // Reset 30 seconds in the future → expect ~30000ms (capped not triggered).
    const res = new Response("", { status: 200, headers: { "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 30) } });
    const wait = rateLimitWaitMs(res);
    expect(wait).toBeGreaterThan(20_000);
    expect(wait).toBeLessThan(35_000);
  });

  it("caps the wait at the supplied capMs (default 5 minutes)", () => {
    // Reset 1 hour in the future → capped at 5 minutes = 300_000ms.
    const res = new Response("", { status: 200, headers: { "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600) } });
    expect(rateLimitWaitMs(res)).toBe(5 * 60_000);
    // Custom cap is honoured.
    expect(rateLimitWaitMs(res, 1_000)).toBe(1_000);
  });
});

describe("sleep", () => {
  it("resolves immediately for non-positive input", async () => {
    const start = Date.now();
    await sleep(0);
    await sleep(-100);
    expect(Date.now() - start).toBeLessThan(50);
  });

  it("waits approximately the requested duration", async () => {
    const start = Date.now();
    await sleep(100);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(90); // tolerance for timer skew
    expect(elapsed).toBeLessThan(250);
  });
});

describe("pLimit", () => {
  it("runs every item and preserves order", async () => {
    const items = [1, 2, 3, 4, 5];
    const fn = vi.fn(async (n: number) => n * 10);
    const result = await pLimit(2, items, fn);
    expect(result).toEqual([10, 20, 30, 40, 50]);
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it("respects the concurrency cap (max in-flight workers)", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fn = async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await sleep(20);
      inFlight--;
      return "done";
    };
    await pLimit(2, [1, 2, 3, 4, 5, 6], fn);
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(maxInFlight).toBe(2); // we expect the cap to actually be hit
  });

  it("returns an empty array for an empty input", async () => {
    const fn = vi.fn(async () => "x");
    expect(await pLimit(1, [], fn)).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it("works with concurrency=1 (serial execution)", async () => {
    const order: number[] = [];
    const fn = async (n: number) => {
      order.push(n);
      return n;
    };
    await pLimit(1, [1, 2, 3], fn);
    expect(order).toEqual([1, 2, 3]);
  });
});

describe("ghFetch", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns the response on a 200 (no retry)", async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input) => {
      calls.push(String(input));
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    const res = await ghFetch("/repos/owner/repo");
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  it("retries on 5xx and succeeds on the second attempt", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      if (calls === 1) return new Response("oops", { status: 503 });
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    const res = await ghFetch("/repos/owner/repo", { attempts: 3 });
    expect(res.status).toBe(200);
    expect(calls).toBe(2);
  });

  it("returns the 5xx response on the final attempt (does NOT throw)", async () => {
    // Pin the *current* behaviour: ghFetch retries 5xx up to
    // `attempts - 1` times, then returns whatever the last
    // response was — even if it's a 5xx. The throw path is
    // reserved for network errors (the `catch (err)` block
    // around `fetch()` itself), not for HTTP error status codes.
    // This is the right contract for a "be tolerant of transient
    // 5xx" wrapper — callers check the status themselves.
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      return new Response("nope", { status: 500 });
    }) as typeof fetch;

    const res = await ghFetch("/repos/owner/repo", { attempts: 3 });
    expect(res.status).toBe(500);
    // 1 initial + 2 retries (3rd attempt is the final, no more
    // retry, returns the response).
    expect(calls).toBe(3);
  });

  it("throws after exhausting attempts when fetch itself errors (network failure)", async () => {
    // The throw path is for network errors, not HTTP status codes.
    globalThis.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch;

    await expect(ghFetch("/repos/owner/repo", { attempts: 2 })).rejects.toThrow(/ECONNREFUSED/);
  });

  it("does NOT retry on a non-retryable 4xx (e.g. 404)", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const res = await ghFetch("/repos/owner/repo", { attempts: 5 });
    expect(res.status).toBe(404);
    expect(calls).toBe(1);
  });

  it("waits for rate-limit reset on a 403 with x-ratelimit-remaining=0", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      if (calls === 1) {
        // Rate-limited. Reset in 1 second.
        return new Response("rate", {
          status: 403,
          headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 1) },
        });
      }
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    const res = await ghFetch("/repos/owner/repo", { attempts: 2 });
    expect(res.status).toBe(200);
    expect(calls).toBe(2);
  });
});
