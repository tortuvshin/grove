/**
 * @grove-dev/core — evidence.ts (inspectRepository orchestration) unit
 * tests.
 *
 * Unlike `github.test.ts` (which leaves `fetchGithubMetadata`'s
 * network path to production), the branching this module adds —
 * not-found / rate-limit → HTML fallback / redirect detection / cache
 * dedup — is new orchestration logic, so it's covered here with
 * `globalThis.fetch` mocked the same way `enrich.test.ts` does.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canonicalRepoKey,
  createMemoryCache,
  inspectRepositories,
  inspectRepository,
} from './evidence.js';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('canonicalRepoKey', () => {
  it('lowercases and joins owner/repo', () => {
    expect(canonicalRepoKey('Owner', 'Repo')).toBe('owner/repo');
  });
});

describe('inspectRepository — invalid url', () => {
  it('returns invalid-url without calling fetch', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const evidence = await inspectRepository('https://example.com/not-github');
    expect(evidence.status).toBe('invalid-url');
    expect(evidence.source).toBe('none');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('inspectRepository — REST API path', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns not-found on a 404', async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 404 })) as typeof fetch;
    const evidence = await inspectRepository('https://github.com/owner/missing');
    expect(evidence.status).toBe('not-found');
    expect(evidence.source).toBe('none');
  });

  it('returns ok + api source + github metadata on success', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/releases/latest')) return new Response(null, { status: 404 });
      return jsonResponse({
        full_name: 'owner/repo',
        stargazers_count: 42,
        archived: false,
        topics: ['cli'],
      });
    }) as typeof fetch;
    const evidence = await inspectRepository('https://github.com/owner/repo');
    expect(evidence.status).toBe('ok');
    expect(evidence.source).toBe('api');
    expect(evidence.github?.stars).toBe(42);
    expect(evidence.redirected).toBe(false);
    expect(evidence.canonicalUrl).toBe('https://github.com/owner/repo');
  });

  it('detects a rename via full_name mismatch', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/releases/latest')) return new Response(null, { status: 404 });
      return jsonResponse({ full_name: 'new-owner/new-repo', archived: false });
    }) as typeof fetch;
    const evidence = await inspectRepository('https://github.com/old-owner/old-repo');
    expect(evidence.redirected).toBe(true);
    expect(evidence.canonicalUrl).toBe('https://github.com/new-owner/new-repo');
  });

  it('falls back to HTML scraping when the REST API is rate-limited', async () => {
    let apiCalled = false;
    let htmlCalled = false;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('https://api.github.com')) {
        apiCalled = true;
        return new Response(null, {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0' },
        });
      }
      if (url.startsWith('https://github.com/')) {
        htmlCalled = true;
        return new Response('<html><body>no license markers here</body></html>', {
          status: 200,
        });
      }
      if (url.startsWith('https://img.shields.io')) {
        return new Response('<svg><title>license: MIT</title></svg>', { status: 200 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as typeof fetch;

    const evidence = await inspectRepository('https://github.com/owner/repo');
    expect(apiCalled).toBe(true);
    expect(htmlCalled).toBe(true);
    expect(evidence.status).toBe('ok');
    expect(evidence.source).toBe('html');
    expect(evidence.warnings).toContain('partial-evidence-html-fallback');
    expect(evidence.github?.license).toBe('MIT');
  });

  it('returns rate-limited when both the API and the HTML fallback are blocked', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('https://api.github.com')) {
        return new Response(null, { status: 403, headers: { 'x-ratelimit-remaining': '0' } });
      }
      return new Response(null, { status: 429 });
    }) as typeof fetch;

    const evidence = await inspectRepository('https://github.com/owner/repo');
    expect(evidence.status).toBe('rate-limited');
  });

  it('caches a definitive result and skips the second network call', async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/releases/latest')) return new Response(null, { status: 404 });
      return jsonResponse({ full_name: 'owner/repo', archived: false });
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const cache = createMemoryCache();
    await inspectRepository('https://github.com/owner/repo', { cache });
    const callsAfterFirst = fetchSpy.mock.calls.length;
    await inspectRepository('https://github.com/Owner/Repo', { cache });
    expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);
  });
});

describe('inspectRepositories — dedup', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('fetches each distinct canonical repo once, regardless of casing or duplicates', async () => {
    const repoCalls = new Set<string>();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/releases/latest')) return new Response(null, { status: 404 });
      const match = url.match(/\/repos\/([^/]+)\/([^/]+)$/);
      if (match) repoCalls.add(`${match[1]}/${match[2]}`.toLowerCase());
      return jsonResponse({ full_name: match ? `${match[1]}/${match[2]}` : 'owner/repo' });
    }) as typeof fetch;

    const results = await inspectRepositories([
      'https://github.com/owner/repo',
      'https://github.com/Owner/Repo',
      'https://github.com/other/thing',
    ]);

    expect(repoCalls.size).toBe(2);
    expect(results).toHaveLength(3);
    expect(results[0]?.requestedUrl).toBe('https://github.com/owner/repo');
    expect(results[1]?.requestedUrl).toBe('https://github.com/Owner/Repo');
  });
});
