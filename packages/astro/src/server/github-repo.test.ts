import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRepoMetadata } from './github-repo.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('fetchRepoMetadata', () => {
  it('returns 400 for invalid owner names', async () => {
    const result = await fetchRepoMetadata({ owner: '../etc', repo: 'passwd' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it('returns 400 for invalid repo names', async () => {
    const result = await fetchRepoMetadata({ owner: 'owner', repo: 'bad name' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it('returns the parsed repo on a 200 response', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            name: 'demo',
            description: 'desc',
            html_url: 'https://github.com/owner/demo',
            homepage: 'https://demo.example',
            language: 'TypeScript',
            private: false,
            topics: ['x', 'y'],
          }),
          { status: 200 },
        ),
    );
    const result = await fetchRepoMetadata({ owner: 'owner', repo: 'demo' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe('demo');
      expect(result.data.html_url).toBe('https://github.com/owner/demo');
      expect(result.data.topics).toEqual(['x', 'y']);
    }
  });

  it('forwards an Authorization header when a token is provided', async () => {
    const spy = vi.fn(async () => new Response('{}', { status: 200 }));
    globalThis.fetch = spy;
    await fetchRepoMetadata({ owner: 'owner', repo: 'demo', token: 'gh_test_123' });
    const headers = spy.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer gh_test_123');
  });

  it('maps a 404 to a structured error', async () => {
    globalThis.fetch = vi.fn(async () => new Response('not found', { status: 404 }));
    const result = await fetchRepoMetadata({ owner: 'owner', repo: 'missing' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.message).toMatch(/not found/i);
    }
  });

  it('maps a 403 to a rate-limit error', async () => {
    globalThis.fetch = vi.fn(async () => new Response('forbidden', { status: 403 }));
    const result = await fetchRepoMetadata({ owner: 'owner', repo: 'demo' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.message).toMatch(/rate limit/i);
    }
  });

  it('maps network errors to a 502', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    const result = await fetchRepoMetadata({ owner: 'owner', repo: 'demo' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(502);
      expect(result.message).toBe('ECONNRESET');
    }
  });
});
