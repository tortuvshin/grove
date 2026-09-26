import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCandidateCollector, REPOLOGY_MIN_INTERVAL_MS } from './candidate-collector.js';

const COMMIT = 'a'.repeat(40);
const NOW = new Date('2026-09-26T00:00:00.000Z');

type Route = (url: string, init: RequestInit) => Response | Promise<Response>;

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const text = (value: string, status = 200) => new Response(value, { status });
const notFound = () => new Response('not found', { status: 404 });

const TREE = [
  'fastlane/metadata/android/en-US/images/icon.png',
  'fastlane/metadata/android/en-US/images/phoneScreenshots/1.png',
  'fastlane/metadata/android/en-US/images/phoneScreenshots/2.png',
  'app/build.gradle',
  'linux/org.example.Demo.metainfo.xml',
  'web/public/manifest.json',
  'web/public/icon-512.png',
  'assets/logo.svg',
  'docs/readme-logo.png',
  'README.md',
].map((path, i) => ({ path, type: 'blob', sha: `blob${i}`, size: 1000 + i }));

/** A fake network: every host the collector talks to, with call log. */
function network(overrides: Record<string, Route> = {}) {
  const calls: string[] = [];
  const routes: Array<[RegExp, Route]> = [
    [/api\.github\.com\/repos\/owner\/demo\/commits\/HEAD$/, () => text(COMMIT)],
    [
      /api\.github\.com\/repos\/owner\/demo\/git\/trees\//,
      () => json({ tree: TREE, truncated: false }),
    ],
    [
      /api\.github\.com\/repos\/owner\/demo\/releases\/latest$/,
      () =>
        json({
          tag_name: 'v1.2.0',
          html_url: 'https://github.com/owner/demo/releases/tag/v1.2.0',
          assets: [{ name: 'demo.apk' }, { name: 'Demo.dmg' }, { name: 'source.zip' }],
        }),
    ],
    [
      /raw\.githubusercontent\.com\/.*\/app\/build\.gradle$/,
      () => text('applicationId "org.example.demo"'),
    ],
    [
      /raw\.githubusercontent\.com\/.*\.metainfo\.xml$/,
      () =>
        text(
          '<component><id>org.example.Demo</id><icon type="remote">https://example.org/icon.png</icon>' +
            '<screenshots><screenshot><image>https://example.org/shot.png</image></screenshot></screenshots></component>',
        ),
    ],
    [
      /raw\.githubusercontent\.com\/.*\/manifest\.json$/,
      () =>
        text(JSON.stringify({ name: 'Demo', icons: [{ src: '/icon-512.png', sizes: '512x512' }] })),
    ],
    [
      /raw\.githubusercontent\.com\/.*\.(png|svg)$/,
      () => new Response(png(512, 512), { status: 206 }),
    ],
    [
      /f-droid\.org\/api\/v1\/packages\/org\.example\.demo$/,
      () => json({ packageName: 'org.example.demo', suggestedVersionCode: 7 }),
    ],
    [
      /flathub\.org\/api\/v2\/appstream\/org\.example\.Demo$/,
      () => json({ id: 'org.example.Demo', urls: {} }),
    ],
    [
      /repology\.org\/api\/v1\/project\/demo$/,
      () =>
        json([
          { repo: 'homebrew_casks', srcname: 'demo', version: '1.2.0' },
          { repo: 'debian_13', srcname: 'demo', version: '1.0.0' },
        ]),
    ],
  ];
  const fetchImpl = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push(url);
    for (const [pattern, route] of Object.entries(overrides)) {
      if (new RegExp(pattern).test(url)) return route(url, init);
    }
    const match = routes.find(([pattern]) => pattern.test(url));
    return match ? match[1](url, init) : notFound();
  });
  return { calls, fetchImpl };
}

function collector(
  fetchImpl: typeof fetch,
  extra: Parameters<typeof createCandidateCollector>[0] = {},
) {
  let clock = 0;
  const sleeps: number[] = [];
  return {
    sleeps,
    collector: createCandidateCollector({
      fetch: fetchImpl,
      token: 'test-token',
      userAgent: 'grove-test',
      now: () => NOW,
      clock: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
      ...extra,
    }),
  };
}

describe('createCandidateCollector', () => {
  beforeEach(() => {
    vi.stubEnv('GH_TOKEN', '');
    vi.stubEnv('GITHUB_TOKEN', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('collects channels, logos and screenshots with commit-pinned provenance', async () => {
    const { fetchImpl } = network();
    const { collector: c } = collector(fetchImpl as unknown as typeof fetch);
    const result = await c.collect({ owner: 'owner', repo: 'demo' });
    expect(result.failures).toEqual([]);

    const channels = result.candidates.channels.map((ch) => [ch.type, ch.platform, ch.url]);
    expect(channels).toEqual([
      ['fdroid', 'android', 'https://f-droid.org/packages/org.example.demo/'],
      ['flathub', 'linux', 'https://flathub.org/apps/org.example.Demo'],
      ['github-releases', 'android', 'https://github.com/owner/demo/releases/latest'],
      ['github-releases', 'macos', 'https://github.com/owner/demo/releases/latest'],
      ['package-manager', 'macos', 'https://formulae.brew.sh/cask/demo'],
    ]);
    const fdroid = result.candidates.channels[0];
    expect(fdroid?.facts).toMatchObject({
      appId: 'org.example.demo',
      evidence: `https://github.com/owner/demo/blob/${COMMIT}/app/build.gradle`,
    });
    expect(fdroid?.provenance).toEqual({
      source: 'fdroid',
      url: 'https://f-droid.org/api/v1/packages/org.example.demo',
      fetchedAt: NOW.toISOString(),
    });
    const brew = result.candidates.channels[4];
    expect(brew?.facts).toMatchObject({ match: 'project-name', versionMatchesRelease: true });

    const logos = result.candidates.logos.map((l) => [l.provenance.source, l.path ?? l.url]);
    expect(logos).toEqual([
      ['fastlane', 'fastlane/metadata/android/en-US/images/icon.png'],
      ['appstream', 'https://example.org/icon.png'],
      ['web-manifest', 'web/public/icon-512.png'],
      ['repo-asset', 'assets/logo.svg'],
    ]);
    const icon = result.candidates.logos[0];
    expect(icon).toMatchObject({
      url: `https://github.com/owner/demo/blob/${COMMIT}/fastlane/metadata/android/en-US/images/icon.png`,
      blobSha: 'blob0',
      locale: 'en-US',
      format: 'png',
      bytes: 1000,
      width: 512,
      height: 512,
    });
    // README and docs images are never picked.
    expect(JSON.stringify(result.candidates)).not.toContain('readme-logo');
    expect(result.candidates.screenshots.map((s) => s.path ?? s.url)).toEqual([
      'fastlane/metadata/android/en-US/images/phoneScreenshots/1.png',
      'fastlane/metadata/android/en-US/images/phoneScreenshots/2.png',
      'https://example.org/shot.png',
    ]);
  });

  it('sends the token to api.github.com only, and a User-Agent everywhere', async () => {
    const { fetchImpl } = network();
    const { collector: c } = collector(fetchImpl as unknown as typeof fetch);
    await c.collect({ owner: 'owner', repo: 'demo' });
    for (const [url, init] of fetchImpl.mock.calls) {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers['User-Agent']).toBe('grove-test');
      if (String(url).startsWith('https://api.github.com/')) {
        expect(headers.Authorization).toBe('Bearer test-token');
      } else {
        expect(headers.Authorization).toBeUndefined();
      }
    }
  });

  it('reads image sizes with a small range request, never a full download', async () => {
    const { fetchImpl } = network();
    const { collector: c } = collector(fetchImpl as unknown as typeof fetch);
    await c.collect({ owner: 'owner', repo: 'demo' });
    const probes = fetchImpl.mock.calls.filter(([url]) => /\.(png|svg)$/.test(String(url)));
    expect(probes.length).toBeGreaterThan(0);
    for (const [, init] of probes) {
      expect((init?.headers as Record<string, string> | undefined)?.Range).toMatch(/^bytes=0-\d+$/);
    }
  });

  it('follows a Git LFS pointer to the media host for the size', async () => {
    const pointer = 'version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 48213\n';
    const { fetchImpl } = network({
      'raw\\.githubusercontent\\.com/.*/images/icon\\.png$': () => text(pointer, 206),
      'media\\.githubusercontent\\.com/media/owner/demo/': () =>
        new Response(png(256, 256), { status: 206 }),
    });
    const { collector: c } = collector(fetchImpl as unknown as typeof fetch);
    const result = await c.collect({ owner: 'owner', repo: 'demo' });
    expect(result.candidates.logos[0]).toMatchObject({ bytes: 48213, width: 256, height: 256 });
  });

  it('spaces Repology requests and skips a host after repeated network errors', async () => {
    const refused = Object.assign(new TypeError('fetch failed'), {
      cause: { code: 'ECONNREFUSED' },
    });
    const { fetchImpl, calls } = network({
      'repology\\.org': () => {
        throw refused;
      },
    });
    const { collector: c, sleeps } = collector(fetchImpl as unknown as typeof fetch);
    const first = await c.collect({ owner: 'owner', repo: 'demo' });
    const second = await c.collect({ owner: 'owner', repo: 'demo' });
    const third = await c.collect({ owner: 'owner', repo: 'demo' });
    expect(first.failures).toEqual(['repology: fetch failed (ECONNREFUSED)']);
    expect(second.failures).toEqual(['repology: fetch failed (ECONNREFUSED)']);
    expect(third.failures[0]).toMatch(/repology\.org skipped for this run/);
    expect(calls.filter((u) => u.includes('repology.org'))).toHaveLength(2);
    // The second request waited out Repology's one-per-second limit.
    expect(sleeps).toContain(REPOLOGY_MIN_INTERVAL_MS);
    // Everything else still worked.
    expect(third.candidates.channels.some((ch) => ch.type === 'fdroid')).toBe(true);
  });

  it('stops asking a host that answers 429', async () => {
    const { fetchImpl, calls } = network({
      'f-droid\\.org': () => new Response('slow down', { status: 429 }),
    });
    const { collector: c } = collector(fetchImpl as unknown as typeof fetch);
    const first = await c.collect({ owner: 'owner', repo: 'demo' });
    await c.collect({ owner: 'owner', repo: 'demo' });
    expect(first.failures).toContain('fdroid: f-droid.org rate limited (HTTP 429)');
    expect(calls.filter((u) => u.includes('f-droid.org'))).toHaveLength(1);
  });

  it('keeps previous candidates of a failed source and never throws', async () => {
    const { fetchImpl } = network({ 'git/trees': () => new Response('boom', { status: 500 }) });
    const { collector: c } = collector(fetchImpl as unknown as typeof fetch);
    const previousLogo = {
      url: 'https://github.com/owner/demo/blob/old/assets/logo.svg',
      path: 'assets/logo.svg',
      blobSha: 'blob7',
      provenance: {
        source: 'repo-asset' as const,
        url: 'https://github.com/owner/demo/blob/old/assets/logo.svg',
        fetchedAt: '2026-09-01T00:00:00.000Z',
      },
    };
    const result = await c.collect({
      owner: 'owner',
      repo: 'demo',
      previous: { channels: [], logos: [previousLogo], screenshots: [] },
    });
    expect(result.failures[0]).toMatch(/^tree: /);
    expect(result.candidates.logos).toEqual([previousLogo]);
    // Releases and Repology do not depend on the tree.
    expect(result.candidates.channels.map((ch) => ch.type)).toContain('github-releases');
  });

  it('stays within the per-record request budget', async () => {
    const { fetchImpl } = network();
    const { collector: c } = collector(fetchImpl as unknown as typeof fetch, {
      requestsPerRecord: 4,
    });
    const result = await c.collect({ owner: 'owner', repo: 'demo' });
    expect(result.requests).toBe(4);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(result.failures.some((f) => f.includes('request budget of 4 used up'))).toBe(true);
  });

  it('finds a Flathub app by search only when its AppStream URLs point at the repository', async () => {
    const { fetchImpl } = network({
      'metainfo\\.xml$': () => notFound(),
      'flathub\\.org/api/v2/search': () =>
        json({
          hits: [
            { app_id: 'io.other.Demo', name: 'Demo' },
            { app_id: 'org.example.Demo', name: 'Demo' },
          ],
        }),
      'appstream/io\\.other\\.Demo$': () => json({ urls: { homepage: 'https://other.example' } }),
      'appstream/org\\.example\\.Demo$': () =>
        json({ urls: { vcs_browser: 'https://github.com/owner/demo' } }),
    });
    const { collector: c } = collector(fetchImpl as unknown as typeof fetch);
    const result = await c.collect({ owner: 'owner', repo: 'demo' });
    const flathub = result.candidates.channels.filter((ch) => ch.type === 'flathub');
    expect(flathub.map((ch) => [ch.url, ch.facts.match])).toEqual([
      ['https://flathub.org/apps/org.example.Demo', 'appstream-urls'],
    ]);
  });

  it('keeps the previous fetchedAt when nothing changed', async () => {
    const { fetchImpl } = network();
    const first = await collector(fetchImpl as unknown as typeof fetch).collector.collect({
      owner: 'owner',
      repo: 'demo',
    });
    const later = createCandidateCollector({
      fetch: fetchImpl as unknown as typeof fetch,
      now: () => new Date('2026-10-03T00:00:00.000Z'),
      sleep: async () => {},
    });
    const second = await later.collect({
      owner: 'owner',
      repo: 'demo',
      previous: first.candidates,
    });
    expect(JSON.stringify(second.candidates)).toBe(JSON.stringify(first.candidates));
  });
});
