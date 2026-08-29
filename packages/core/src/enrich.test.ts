/**
 * @grove-dev/core — enrich.ts unit tests.
 *
 * `enrichFromGithubHtml` makes network calls to github.com and
 * img.shields.io. The unit suite is offline, so we test:
 *   - the validation gate (an unparseable repo URL returns
 *     `{error: "invalid_repo_url"}` with empty fields)
 *   - the 404 / 429 / generic error short-circuits
 *   - the HTML parsing for license, language, topics, homepage
 *     via `fetch` mock
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enrichFromGithubHtml } from './enrich.js';

const SAMPLE_HTML = `
<html>
  <head>
    <title>owner/repo: A real project</title>
  </head>
  <body>
    <a href="/topics/awesome" rel="nofollow">awesome</a>
    <a href="/topics/list" rel="nofollow">list</a>
    <a href="/topics/awesome" rel="nofollow">awesome</a>
    <span class="color-fg-default text-bold mr-1">TypeScript</span>
    <a href="https://example.com" rel="nofollow">Homepage</a>
    <span>
      <a href="/owner/repo/blob/main/LICENSE" itemprop="license">MIT License</a>
    </span>
  </body>
</html>
`;

describe('enrichFromGithubHtml — input validation', () => {
  it('returns an empty-fields + error result for an unparseable URL', async () => {
    // `getOwnerRepoFromUrl` only matches github.com URLs, so
    // anything else gets the "invalid_repo_url" short-circuit
    // without a network round-trip. Pin the exact shape.
    const r = await enrichFromGithubHtml('https://example.com/owner/repo');
    expect(r).toEqual({
      fields: { license: null, language: null, topics: [], homepage: null },
      error: 'invalid_repo_url',
    });
  });
});

describe('enrichFromGithubHtml — HTTP short-circuits', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns notFound=true on a 404', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('not found', { status: 404 }),
    ) as typeof fetch;
    const r = await enrichFromGithubHtml('https://github.com/owner/does-not-exist');
    expect(r.notFound).toBe(true);
    expect(r.fields).toEqual({ license: null, language: null, topics: [], homepage: null });
  });

  it('returns rateLimited=true on a 429', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('slow down', { status: 429 }),
    ) as typeof fetch;
    const r = await enrichFromGithubHtml('https://github.com/owner/repo');
    expect(r.rateLimited).toBe(true);
  });

  it("returns error='<status>' on other non-2xx responses", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('server error', { status: 500 }),
    ) as typeof fetch;
    const r = await enrichFromGithubHtml('https://github.com/owner/repo');
    expect(r.error).toContain('500');
  });

  it('returns the error message string when fetch itself throws', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('ECONNRESET');
    }) as typeof fetch;
    const r = await enrichFromGithubHtml('https://github.com/owner/repo');
    expect(r.error).toBe('ECONNRESET');
  });
});

describe('enrichFromGithubHtml — HTML extraction', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('extracts license, language, topics (deduped), and homepage from a sample page', async () => {
    // Mock only the github.com page; the shields.io fallback is
    // not exercised here because the HTML already contains the
    // license link.
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.startsWith('https://github.com/')) {
        return new Response(SAMPLE_HTML, { status: 200 });
      }
      // shields.io (not called in this test, but keep the mock honest).
      return new Response('not found', { status: 404 });
    }) as typeof fetch;

    const r = await enrichFromGithubHtml('https://github.com/owner/repo');
    expect(r.error).toBeUndefined();
    expect(r.fields.license).toBe('MIT');
    expect(r.fields.language).toBe('TypeScript');
    expect(r.fields.topics).toEqual(['awesome', 'list']); // deduped
    expect(r.fields.homepage).toBe('https://example.com');
  });
});
