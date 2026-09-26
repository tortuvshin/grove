import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { generate } from './build-data.js';
import { cleanupStale } from './decisions.js';
import {
  GITHUB_CACHE_MAX_FAILURES,
  GITHUB_SYNC_MAX_AGE_DAYS,
  type GithubCacheEntry,
  githubCacheEntrySchema,
  githubSyncFreshness,
  githubSyncFreshnessOptions,
  loadGithubCache,
  migrateRecordGithub,
  nextGithubCacheEntry,
  removeTopLevelYamlKeys,
  resolveRecordGithub,
  SYNC_STALE_REASON,
  seedGithubCacheEntry,
  serializeGithubCacheEntry,
  writeGithubCacheEntry,
} from './github-cache.js';
import { DAY_MS } from './health-thresholds.js';
import { type GroveConfig, groveConfigSchema } from './schema.js';
import { loadRecords, validateProject } from './validate.js';

const config: GroveConfig = groveConfigSchema.parse({
  site: { name: 'test', tagline: 'test' },
  blueprint: 'project-directory',
});

/** A cache entry field set for a sync that just succeeded. */
function synced(): Pick<GithubCacheEntry, 'lastSuccessAt'> {
  return { lastSuccessAt: new Date().toISOString() };
}

function entry(overrides: Partial<GithubCacheEntry> = {}): GithubCacheEntry {
  return {
    schemaVersion: 1,
    slug: 'demo',
    lastSuccessAt: null,
    partialFailures: [],
    ...overrides,
  };
}

const RECORD_WITH_INLINE = [
  '# Curated by hand — keep this comment.',
  'kind: project',
  'slug: demo',
  'name: Demo',
  'category: tools',
  'repoUrl: https://github.com/owner/demo',
  'health:',
  '  status: active',
  '  tier: listed',
  '  visibility: keep',
  'github:',
  '  repository:',
  '    full_name: owner/demo',
  '    stargazers_count: 10',
  '    pushed_at: 2026-08-01T00:00:00Z',
  '',
  '  latestReleaseAt: 2026-07-01T00:00:00Z',
  '  sync:',
  '    syncedAt: 2026-09-01T00:00:00.000Z',
  '    source: api',
  '# Trailing curator note.',
  'caveats:',
  '  - "Keeps its quoting: yes"',
  '',
].join('\n');

describe('serializeGithubCacheEntry', () => {
  it('writes a fixed top-level key order with a trailing newline', () => {
    const a = serializeGithubCacheEntry(
      entry({ health: { status: 'active' }, github: { repository: {} }, source: 'api' }),
    );
    // Same data, keys supplied in a different order.
    const b = serializeGithubCacheEntry({
      github: { repository: {} },
      source: 'api',
      health: { status: 'active' },
      partialFailures: [],
      lastSuccessAt: null,
      slug: 'demo',
      schemaVersion: 1,
    });
    expect(a).toBe(b);
    expect(a.endsWith('}\n')).toBe(true);
    expect(Object.keys(JSON.parse(a))).toEqual([
      'schemaVersion',
      'slug',
      'source',
      'lastSuccessAt',
      'partialFailures',
      'github',
      'health',
    ]);
  });

  it('leaves an identical file untouched on rewrite', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'grove-cache-write-'));
    try {
      const value = entry({ github: { repository: { stargazers_count: 1 } } });
      expect(await writeGithubCacheEntry(dir, value)).toBe(true);
      const first = await readFile(join(dir, 'demo.json'), 'utf8');
      expect(await writeGithubCacheEntry(dir, { ...value })).toBe(false);
      expect(await readFile(join(dir, 'demo.json'), 'utf8')).toBe(first);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('nextGithubCacheEntry', () => {
  const synced = entry({
    source: 'api',
    lastSuccessAt: '2026-09-01T00:00:00.000Z',
    github: { repository: { stargazers_count: 10 } },
    health: { status: 'active' },
  });

  it('moves lastSuccessAt and replaces data on an API refresh', () => {
    const next = nextGithubCacheEntry(synced, {
      slug: 'demo',
      at: '2026-09-08T00:00:00.000Z',
      source: 'api',
      github: { repository: { stargazers_count: 12 } },
      health: { status: 'mature' },
      failures: [],
    });
    expect(next.lastSuccessAt).toBe('2026-09-08T00:00:00.000Z');
    expect(next.github).toEqual({ repository: { stargazers_count: 12 } });
    expect(next.health).toEqual({ status: 'mature' });
    expect(next.partialFailures).toEqual([]);
  });

  it('keeps previous data and lastSuccessAt on failure, recording why', () => {
    const next = nextGithubCacheEntry(synced, {
      slug: 'demo',
      at: '2026-09-08T00:00:00.000Z',
      failures: [
        { source: 'api', reason: 'GitHub API 502 Bad Gateway' },
        { source: 'html', reason: 'rate limited' },
      ],
    });
    expect(next.lastSuccessAt).toBe('2026-09-01T00:00:00.000Z');
    expect(next.github).toEqual(synced.github);
    expect(next.health).toEqual(synced.health);
    expect(next.source).toBe('api');
    expect(next.partialFailures).toEqual([
      { at: '2026-09-08T00:00:00.000Z', source: 'api', reason: 'GitHub API 502 Bad Gateway' },
      { at: '2026-09-08T00:00:00.000Z', source: 'html', reason: 'rate limited' },
    ]);
  });

  it('treats an HTML fallback as partial: data updates, lastSuccessAt does not', () => {
    const next = nextGithubCacheEntry(synced, {
      slug: 'demo',
      at: '2026-09-08T00:00:00.000Z',
      source: 'html',
      github: { repository: { stargazers_count: 10 }, html: { language: 'Go' } },
      failures: [{ source: 'api', reason: 'rate limit' }],
    });
    expect(next.source).toBe('html');
    expect(next.lastSuccessAt).toBe('2026-09-01T00:00:00.000Z');
    expect(next.health).toEqual({ status: 'active' });
    expect(next.partialFailures).toHaveLength(1);
  });

  it(`keeps only the last ${GITHUB_CACHE_MAX_FAILURES} failures`, () => {
    let current: GithubCacheEntry | undefined;
    for (let day = 1; day <= 8; day += 1) {
      current = nextGithubCacheEntry(current, {
        slug: 'demo',
        at: `2026-09-${String(day).padStart(2, '0')}T00:00:00.000Z`,
        failures: [{ source: 'api', reason: `day ${day}` }],
      });
    }
    expect(current?.partialFailures.map((f) => f.reason)).toEqual([
      'day 4',
      'day 5',
      'day 6',
      'day 7',
      'day 8',
    ]);
    expect(current?.lastSuccessAt).toBeNull();
    expect(current?.github).toBeUndefined();
  });
});

describe('resolveRecordGithub', () => {
  const inline = {
    name: 'Demo',
    github: { repository: { stargazers_count: 10, pushed_at: '2026-08-01T00:00:00Z' } },
    health: { status: 'active', tier: 'listed', visibility: 'keep' },
  };

  it('uses the inline blocks when there is no cache entry', () => {
    const resolved = resolveRecordGithub(inline, undefined);
    expect(resolved.github).toBe('inline');
    expect(resolved.health).toBe('inline');
    expect(resolved.record).toEqual(inline);
    expect(resolved.conflicts).toEqual([]);
  });

  it('prefers the cache per block and reports disagreeing fields', () => {
    const cached = entry({
      github: { repository: { stargazers_count: 25, pushed_at: '2026-08-01T00:00:00.000Z' } },
      health: { status: 'stale', tier: 'listed', visibility: 'keep' },
    });
    const resolved = resolveRecordGithub(inline, cached);
    expect(resolved.github).toBe('cache');
    expect(resolved.health).toBe('cache');
    expect(resolved.record.github).toBe(cached.github);
    expect(resolved.record.health).toBe(cached.health);
    // Same instant written differently is not a disagreement.
    expect(resolved.conflicts).toEqual([
      'github stars 10 (inline) vs 25 (cache)',
      'health status active (inline) vs stale (cache)',
    ]);
    // The input record is not mutated.
    expect(inline.health.status).toBe('active');
  });

  it('keeps an inline block the cache entry does not carry', () => {
    const resolved = resolveRecordGithub(inline, entry({ health: { status: 'active' } }));
    expect(resolved.github).toBe('inline');
    expect(resolved.health).toBe('cache');
  });
});

describe('githubSyncFreshness', () => {
  const NOW = Date.parse('2026-09-26T00:00:00.000Z');
  const ago = (days: number, extraMs = 0) => new Date(NOW - days * DAY_MS - extraMs).toISOString();
  const failure = (at: string) => ({ at, source: 'api' as const, reason: 'HTTP 502' });

  it('is fresh up to and including maxAgeDays after the last success', () => {
    expect(githubSyncFreshness(entry({ lastSuccessAt: ago(0) }), { now: NOW })).toEqual({
      stale: false,
    });
    expect(
      githubSyncFreshness(entry({ lastSuccessAt: ago(GITHUB_SYNC_MAX_AGE_DAYS) }), { now: NOW })
        .stale,
    ).toBe(false);
  });

  it('is stale one millisecond past maxAgeDays', () => {
    const result = githubSyncFreshness(entry({ lastSuccessAt: ago(GITHUB_SYNC_MAX_AGE_DAYS, 1) }), {
      now: NOW,
    });
    expect(result).toMatchObject({ stale: true, cause: 'too_old' });
  });

  it('honours a configured maxAgeDays', () => {
    const e = entry({ lastSuccessAt: ago(20) });
    expect(githubSyncFreshness(e, { now: NOW }).stale).toBe(true);
    expect(githubSyncFreshness(e, { now: NOW, maxAgeDays: 30 }).stale).toBe(false);
    expect(
      githubSyncFreshnessOptions(
        groveConfigSchema.parse({ ...config, sync: { github: { maxAgeDays: 30 } } }),
      ),
    ).toEqual({ maxAgeDays: 30 });
    expect(githubSyncFreshnessOptions(config)).toEqual({ maxAgeDays: 14 });
  });

  it('is stale when the newest failure is later than lastSuccessAt, however recent', () => {
    const result = githubSyncFreshness(
      entry({ lastSuccessAt: ago(2), partialFailures: [failure(ago(1))] }),
      { now: NOW },
    );
    expect(result).toMatchObject({ stale: true, cause: 'failed_since_success' });
    if (result.stale) expect(result.detail).toContain('HTTP 502');
  });

  it('a failure older than the last success does not make it stale', () => {
    const result = githubSyncFreshness(
      entry({ lastSuccessAt: ago(1), partialFailures: [failure(ago(2))] }),
      { now: NOW },
    );
    expect(result.stale).toBe(false);
  });

  it('compares against the newest failure, not the last in the list', () => {
    const result = githubSyncFreshness(
      entry({ lastSuccessAt: ago(2), partialFailures: [failure(ago(1)), failure(ago(3))] }),
      { now: NOW },
    );
    expect(result).toMatchObject({ stale: true, cause: 'failed_since_success' });
  });

  it('is stale when the API never succeeded', () => {
    expect(githubSyncFreshness(entry(), { now: NOW })).toMatchObject({
      stale: true,
      cause: 'never_succeeded',
    });
    expect(
      githubSyncFreshness(entry({ partialFailures: [failure(ago(1))] }), { now: NOW }),
    ).toMatchObject({ stale: true, cause: 'failed_since_success' });
  });
});

describe('resolveRecordGithub — sync freshness', () => {
  const NOW = Date.parse('2026-09-26T00:00:00.000Z');
  const health = {
    status: 'mature',
    tier: 'curated',
    visibility: 'keep',
    staleReason: null,
    reasons: ['Strong adoption'],
  };
  const staleEntry = entry({
    lastSuccessAt: '2026-08-01T00:00:00.000Z',
    health,
    github: { repository: {} },
  });

  it('resolves a stale entry as unknown / sync_stale, keeping tier and visibility', () => {
    const resolved = resolveRecordGithub({}, staleEntry, { now: NOW });
    expect(resolved.syncStale).toMatchObject({ stale: true, cause: 'too_old' });
    expect(resolved.record.health).toMatchObject({
      status: 'unknown',
      staleReason: SYNC_STALE_REASON,
      confidence: 'low',
      tier: 'curated',
      visibility: 'keep',
      reasons: [expect.stringContaining('older than 14 days'), 'Last synced status: mature'],
    });
    // The github block is still the cached one; only health changes.
    expect(resolved.record.github).toBe(staleEntry.github);
    // The cache entry is not mutated.
    expect(staleEntry.health?.status).toBe('mature');
  });

  it('leaves a fresh entry untouched', () => {
    const fresh = entry({ lastSuccessAt: '2026-09-20T00:00:00.000Z', health });
    const resolved = resolveRecordGithub({}, fresh, { now: NOW });
    expect(resolved.syncStale).toBeUndefined();
    expect(resolved.record.health).toBe(health);
  });

  it('without freshness options, keeps the old behaviour', () => {
    const resolved = resolveRecordGithub({}, staleEntry);
    expect(resolved.syncStale).toBeUndefined();
    expect(resolved.record.health).toBe(health);
  });

  it('does not touch inline (legacy) health', () => {
    const resolved = resolveRecordGithub({ health }, entry({ github: {} }), { now: NOW });
    expect(resolved.syncStale).toBeUndefined();
    expect(resolved.record.health).toBe(health);
  });
});

describe('migration codemod', () => {
  it('seeds lastSuccessAt only from an inline API sync', () => {
    expect(
      seedGithubCacheEntry('a', { github: { sync: { source: 'api', syncedAt: 'T1' } } })
        .lastSuccessAt,
    ).toBe('T1');
    expect(
      seedGithubCacheEntry('a', { github: { sync: { source: 'html', syncedAt: 'T1' } } })
        .lastSuccessAt,
    ).toBeNull();
  });

  it('strips inline blocks and leaves every other byte of the record alone', () => {
    const result = migrateRecordGithub('demo', RECORD_WITH_INLINE);
    expect(result.moved).toEqual(['github', 'health']);
    expect(result.text).toBe(
      [
        '# Curated by hand — keep this comment.',
        'kind: project',
        'slug: demo',
        'name: Demo',
        'category: tools',
        'repoUrl: https://github.com/owner/demo',
        '# Trailing curator note.',
        'caveats:',
        '  - "Keeps its quoting: yes"',
        '',
      ].join('\n'),
    );
    expect(result.entry).toMatchObject({
      slug: 'demo',
      repoUrl: 'https://github.com/owner/demo',
      source: 'api',
      lastSuccessAt: '2026-09-01T00:00:00.000Z',
      health: { status: 'active', tier: 'listed', visibility: 'keep' },
      github: { repository: { stargazers_count: 10 } },
    });
  });

  it('leaves a record without inline blocks unchanged', () => {
    const text = 'kind: project\nname: Demo\n';
    expect(migrateRecordGithub('demo', text)).toEqual({ text, moved: [], conflicts: [] });
  });

  it('keeps an existing cache entry over the inline copy and reports the drop', () => {
    const existing = entry({
      github: { repository: { stargazers_count: 99 } },
      lastSuccessAt: '2026-09-20T00:00:00.000Z',
    });
    const result = migrateRecordGithub('demo', RECORD_WITH_INLINE, existing);
    expect(result.entry?.github).toBe(existing.github);
    expect(result.entry?.health).toMatchObject({ status: 'active' });
    expect(result.entry?.lastSuccessAt).toBe('2026-09-20T00:00:00.000Z');
    expect(result.conflicts).toEqual(['github stars 10 (inline) vs 99 (cache)']);
  });

  it('removes a flow-style block and one at the end of the file', () => {
    const text = 'name: Demo\nhealth: { status: active }\nlinks: {}\ngithub:\n  repository: {}\n';
    expect(removeTopLevelYamlKeys(text, ['github', 'health'])).toBe('name: Demo\nlinks: {}\n');
  });
});

describe('readers resolve github/health through the cache', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'grove-cache-readers-'));
    await mkdir(join(cwd, 'data', 'records'), { recursive: true });
    await mkdir(join(cwd, 'data', 'cache', 'github'), { recursive: true });
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  async function writeCache(value: GithubCacheEntry) {
    await writeGithubCacheEntry(join(cwd, 'data', 'cache', 'github'), value);
  }

  async function records(): Promise<
    Array<{ slug: string; health?: { status?: string }; github?: unknown }>
  > {
    await generate(cwd, config);
    return JSON.parse(await readFile(join(cwd, 'data', 'generated', 'records.full.json'), 'utf8'))
      .records;
  }

  it('generate: cache > inline > health.yml', async () => {
    await writeFile(join(cwd, 'data', 'records', 'demo.yml'), RECORD_WITH_INLINE);
    await writeFile(
      join(cwd, 'data', 'records', 'side.yml'),
      'kind: project\nslug: side\nname: Side\ncategory: tools\n',
    );
    await writeFile(
      join(cwd, 'data', 'health.yml'),
      'health:\n  - id: side\n    health: { status: archived }\n  - id: demo\n    health: { status: archived }\n',
    );

    // No cache yet → the inline block wins over health.yml.
    let demo = (await records()).find((r) => r.slug === 'demo');
    expect(demo?.health?.status).toBe('active');

    // A cache entry wins over the inline block.
    await writeCache(
      entry({ ...synced(), health: { status: 'stale' }, github: { repository: {} } }),
    );
    const all = await records();
    demo = all.find((r) => r.slug === 'demo');
    expect(demo?.health?.status).toBe('stale');
    expect(demo?.github).toEqual({ repository: {} });
    // Records with neither still fall back to health.yml.
    expect(all.find((r) => r.slug === 'side')?.health?.status).toBe('archived');
  });

  it('migration round-trip leaves the generated records identical', async () => {
    // The fixture's API sync (2026-09-01) must still be fresh once it
    // moves to the cache, or the cache copy would resolve as sync_stale.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse('2026-09-02T00:00:00.000Z'));
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const recordPath = join(cwd, 'data', 'records', 'demo.yml');
    await writeFile(recordPath, RECORD_WITH_INLINE);
    await generate(cwd, config);
    const before = await readFile(join(cwd, 'data', 'generated', 'records.full.json'), 'utf8');

    const migrated = migrateRecordGithub('demo', RECORD_WITH_INLINE);
    if (!migrated.entry) throw new Error('expected a cache entry');
    await writeCache(migrated.entry);
    await writeFile(recordPath, migrated.text);
    await generate(cwd, config);
    const after = await readFile(join(cwd, 'data', 'generated', 'records.full.json'), 'utf8');

    const strip = (text: string) => text.replace(/"generatedAt": "[^"]+"/, '');
    expect(strip(after)).toBe(strip(before));
  });

  it('cleanup and loadRecords read health and stars from the cache', async () => {
    await writeFile(join(cwd, 'data', 'records', 'demo.yml'), RECORD_WITH_INLINE);
    await writeCache(
      entry({
        ...synced(),
        health: { status: 'needs_review' },
        github: { repository: { stargazers_count: 42 } },
      }),
    );
    const { report } = await cleanupStale(cwd, config);
    expect(report.candidates).toMatchObject([{ slug: 'demo', status: 'needs_review', stars: 42 }]);
    const [loaded] = await loadRecords(config, { cwd });
    expect(loaded?.kind === 'project' && loaded.health?.status).toBe('needs_review');
  });

  it('validate: warns on inline/cache disagreement and orphans, errors on unreadable files', async () => {
    await writeFile(join(cwd, 'data', 'records', 'demo.yml'), RECORD_WITH_INLINE);
    await writeCache(
      entry({
        ...synced(),
        github: { repository: { stargazers_count: 11 } },
        health: { status: 'active', tier: 'listed', visibility: 'keep' },
      }),
    );
    await writeCache(entry({ slug: 'gone' }));
    await writeFile(join(cwd, 'data', 'cache', 'github', 'broken.json'), '{ nope');

    const original = process.cwd();
    process.chdir(cwd);
    try {
      const result = await validateProject(config);
      const mismatch = result.warnings.filter((w) => w.code === 'github_cache_mismatch');
      expect(mismatch).toHaveLength(1);
      expect(mismatch[0]?.message).toContain('demo');
      expect(mismatch[0]?.message).toContain('github stars 10 (inline) vs 11 (cache)');
      expect(mismatch[0]?.message).toContain('grove migrate github-cache');
      expect(result.warnings.map((w) => w.code)).toContain('github_cache_orphan');
      expect(result.errors.map((e) => e.code)).toContain('github_cache_invalid');
      // Cache health satisfies the "GitHub link needs health" rule.
      expect(result.warnings.map((w) => w.code)).not.toContain('missing_health_file');
    } finally {
      process.chdir(original);
    }
  });

  it('validate: a cache-only record needs no inline health', async () => {
    await writeFile(
      join(cwd, 'data', 'records', 'demo.yml'),
      "kind: project\nslug: demo\nname: Demo\ncategory: tools\naddedAt: '2026-01-01'\nrepoUrl: https://github.com/owner/demo\n",
    );
    await writeCache(entry({ ...synced(), health: { status: 'active' } }));
    const original = process.cwd();
    process.chdir(cwd);
    try {
      const result = await validateProject(config);
      expect(result.issues).toEqual([]);
    } finally {
      process.chdir(original);
    }
  });

  it('a stale sync surfaces as unknown in generate, cleanup and check', async () => {
    await writeFile(join(cwd, 'data', 'records', 'demo.yml'), RECORD_WITH_INLINE);
    await writeCache(
      entry({
        lastSuccessAt: '2026-01-01T00:00:00.000Z',
        partialFailures: [{ at: '2026-02-01T00:00:00.000Z', source: 'api', reason: 'HTTP 502' }],
        health: { status: 'mature', tier: 'curated', visibility: 'keep', reasons: ['old'] },
        github: { repository: {} },
      }),
    );
    const demo = (await records()).find((r) => r.slug === 'demo') as
      | { health?: Record<string, unknown> }
      | undefined;
    expect(demo?.health).toMatchObject({
      status: 'unknown',
      staleReason: 'sync_stale',
      tier: 'curated',
      visibility: 'keep',
    });
    const { report } = await cleanupStale(cwd, config);
    expect(report.candidates).toMatchObject([
      { slug: 'demo', status: 'unknown', staleReason: 'sync_stale' },
    ]);
    // The cache file keeps the last observed values as evidence.
    const cached = JSON.parse(
      await readFile(join(cwd, 'data', 'cache', 'github', 'demo.json'), 'utf8'),
    );
    expect(cached.health.status).toBe('mature');

    const original = process.cwd();
    process.chdir(cwd);
    try {
      const result = await validateProject(config);
      const stale = result.warnings.filter((w) => w.code === 'github_sync_stale');
      expect(stale).toHaveLength(1);
      expect(stale[0]?.message).toContain('1 record(s)');
      expect(stale[0]?.message).toContain('demo');
    } finally {
      process.chdir(original);
    }
  });

  it('loadGithubCache reports a slug that does not match the file name', async () => {
    await writeFile(
      join(cwd, 'data', 'cache', 'github', 'a.json'),
      serializeGithubCacheEntry(entry({ slug: 'b' })),
    );
    const cache = await loadGithubCache(config, cwd);
    expect(cache.entries.size).toBe(0);
    expect(cache.errors).toEqual([
      { file: 'a.json', message: 'slug "b" does not match the file name' },
    ]);
  });
});

describe('githubSyncFreshness and candidate failures', () => {
  it('ignores a candidates failure newer than the last success', () => {
    const entry = githubCacheEntrySchema.parse({
      schemaVersion: 1,
      slug: 'demo',
      lastSuccessAt: '2026-09-20T00:00:00.000Z',
      partialFailures: [
        { at: '2026-09-25T00:00:00.000Z', source: 'candidates', reason: 'repology: down' },
      ],
    });
    expect(githubSyncFreshness(entry, { now: Date.parse('2026-09-26T00:00:00.000Z') })).toEqual({
      stale: false,
    });
  });
});
