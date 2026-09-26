import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generate } from './build-data.js';
import { cleanupStale } from './decisions.js';
import {
  GITHUB_CACHE_MAX_FAILURES,
  type GithubCacheEntry,
  loadGithubCache,
  migrateRecordGithub,
  nextGithubCacheEntry,
  removeTopLevelYamlKeys,
  resolveRecordGithub,
  seedGithubCacheEntry,
  serializeGithubCacheEntry,
  writeGithubCacheEntry,
} from './github-cache.js';
import { type GroveConfig, groveConfigSchema } from './schema.js';
import { loadRecords, validateProject } from './validate.js';

const config: GroveConfig = groveConfigSchema.parse({
  site: { name: 'test', tagline: 'test' },
  blueprint: 'project-directory',
});

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
    await writeCache(entry({ health: { status: 'stale' }, github: { repository: {} } }));
    const all = await records();
    demo = all.find((r) => r.slug === 'demo');
    expect(demo?.health?.status).toBe('stale');
    expect(demo?.github).toEqual({ repository: {} });
    // Records with neither still fall back to health.yml.
    expect(all.find((r) => r.slug === 'side')?.health?.status).toBe('archived');
  });

  it('migration round-trip leaves the generated records identical', async () => {
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
    await writeCache(entry({ health: { status: 'active' } }));
    const original = process.cwd();
    process.chdir(cwd);
    try {
      const result = await validateProject(config);
      expect(result.issues).toEqual([]);
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
