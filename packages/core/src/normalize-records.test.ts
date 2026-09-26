import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAwesomeReadme, toAwesomeReadmeRecord } from './awesome-readme.js';
import { generate } from './build-data.js';
import { cleanupStale } from './decisions.js';
import { loadNormalizedRecords } from './normalize-records.js';
import { type GroveConfig, groveConfigSchema } from './schema.js';
import { validateProject } from './validate.js';

const config: GroveConfig = groveConfigSchema.parse({
  site: { name: 'test', tagline: 'test', url: 'https://example.com' },
  blueprint: 'project-directory',
});

/** A record whose GitHub metadata and health live in the sync cache. */
const WITH_CACHE = [
  'slug: cached',
  'name: Cached',
  'description: Metadata comes from the sync cache',
  'category: tools',
  'repoUrl: https://github.com/owner/cached',
  'links:',
  '  github: https://github.com/owner/cached',
  '',
].join('\n');

const CACHE_ENTRY = {
  schemaVersion: 1,
  slug: 'cached',
  lastSuccessAt: new Date().toISOString(),
  partialFailures: [],
  github: {
    repository: {
      full_name: 'owner/cached',
      stargazers_count: 120,
      pushed_at: '2026-08-30T00:00:00Z',
    },
  },
  health: { status: 'active', tier: 'curated', visibility: 'highlight' },
};

/** A record with no health anywhere, hidden by a curator decision. */
const HIDDEN = [
  'slug: hidden',
  'name: Hidden',
  'description: Hidden by decisions.yml',
  'category: tools',
  '',
].join('\n');

/** A record still carrying a legacy inline github/health copy. */
const LEGACY = [
  'slug: legacy',
  'name: Legacy',
  'description: Inline github block from an older sync',
  'category: tools',
  'health:',
  '  status: stale',
  '  tier: listed',
  '  visibility: keep',
  '  cleanupCandidate: true',
  'github:',
  '  stars: 7',
  '  repository:',
  '    full_name: owner/legacy',
  '    stargazers_count: 7',
  '',
].join('\n');

const DECISIONS = [
  'decisions:',
  '  - id: hidden',
  '    decision:',
  '      visibility: hide',
  '      reason: Out of scope',
  '',
].join('\n');

describe('loadNormalizedRecords', () => {
  let cwd: string;

  beforeEach(async () => {
    vi.stubEnv('GITHUB_TOKEN', '');
    vi.stubEnv('GITHUB_ACTIONS', '');
    cwd = await mkdtemp(join(tmpdir(), 'grove-normalize-'));
    await mkdir(join(cwd, 'data', 'records'), { recursive: true });
    await mkdir(join(cwd, 'data', 'cache', 'github'), { recursive: true });
    await writeFile(join(cwd, 'data', 'records', 'cached.yml'), WITH_CACHE);
    await writeFile(join(cwd, 'data', 'records', 'hidden.yml'), HIDDEN);
    await writeFile(join(cwd, 'data', 'records', 'legacy.yml'), LEGACY);
    await writeFile(
      join(cwd, 'data', 'cache', 'github', 'cached.json'),
      JSON.stringify(CACHE_ENTRY),
    );
    await writeFile(join(cwd, 'data', 'decisions.yml'), DECISIONS);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(cwd, { recursive: true, force: true });
  });

  it('merges cache, decisions and legacy inline data into one record per file', async () => {
    const { records, issues } = await loadNormalizedRecords(config, cwd);
    expect(issues).toEqual([]);
    expect(records.map((r) => r.slug)).toEqual(['cached', 'hidden', 'legacy']);

    const [cached, hidden, legacy] = records;
    expect(cached).toMatchObject({
      slug: 'cached',
      file: join('data', 'records', 'cached.yml'),
      visibility: 'highlight',
      declaredSlug: 'cached',
      provenance: { github: 'cache', health: 'cache', decision: false, override: false },
      record: {
        kind: 'project',
        name: 'Cached',
        github: { repository: { full_name: 'owner/cached', stargazers_count: 120 } },
        health: { status: 'active', tier: 'curated', visibility: 'highlight' },
      },
    });

    // No health anywhere: the decision gets a fabricated "unknown" block
    // to carry its visibility, and `base` keeps the pre-decision record.
    expect(hidden).toMatchObject({
      visibility: 'hide',
      provenance: { github: 'none', health: 'decision', decision: true },
      record: { health: { status: 'unknown', visibility: 'hide' } },
    });
    expect(hidden?.base.kind === 'project' && hidden.base.health).toBeUndefined();

    expect(legacy).toMatchObject({
      visibility: 'keep',
      provenance: { github: 'inline', health: 'inline', decision: false },
      record: {
        github: { stars: 7, repository: { full_name: 'owner/legacy' } },
        health: { status: 'stale', cleanupCandidate: true },
      },
    });
  });

  it('applies overrides, then health.yml for a project with no health block', async () => {
    await writeFile(
      join(cwd, 'data', 'overrides.yml'),
      'overrides:\n  - id: legacy\n    patch:\n      description: Patched\n',
    );
    await writeFile(join(cwd, 'data', 'decisions.yml'), 'decisions: []\n');
    await writeFile(
      join(cwd, 'data', 'health.yml'),
      'health:\n  - id: hidden\n    health:\n      status: quiet\n      visibility: needs_review\n',
    );
    const { records } = await loadNormalizedRecords(config, cwd);
    const bySlug = new Map(records.map((r) => [r.slug, r]));
    expect(bySlug.get('legacy')?.record.description).toBe('Patched');
    expect(bySlug.get('legacy')?.provenance.override).toBe(true);
    expect(bySlug.get('hidden')).toMatchObject({
      visibility: 'needs_review',
      provenance: { health: 'file' },
      record: { health: { status: 'quiet' } },
    });
    // health.yml never replaces a cache or inline block.
    expect(bySlug.get('cached')?.provenance.health).toBe('cache');
  });

  it('takes the slug from the file name and keeps the declared one for validate', async () => {
    await writeFile(
      join(cwd, 'data', 'records', 'renamed.yml'),
      'slug: old-name\nname: Renamed\ncategory: tools\n',
    );
    const { records } = await loadNormalizedRecords(config, cwd);
    const renamed = records.find((r) => r.slug === 'renamed');
    expect(renamed?.record.slug).toBe('renamed');
    expect(renamed?.declaredSlug).toBe('old-name');
  });

  it('reports bad files as issues and leaves them out of records', async () => {
    await writeFile(join(cwd, 'data', 'records', 'empty.yml'), '');
    await writeFile(join(cwd, 'data', 'records', 'broken.yml'), 'name: [unclosed\n');
    await writeFile(
      join(cwd, 'data', 'records', 'invalid.yml'),
      'slug: invalid\ncategory: tools\n',
    );
    const { records, entries, issues } = await loadNormalizedRecords(config, cwd);
    expect(records.map((r) => r.slug)).toEqual(['cached', 'hidden', 'legacy']);
    expect(entries.map((e) => e.slug)).toEqual([
      'broken',
      'cached',
      'empty',
      'hidden',
      'invalid',
      'legacy',
    ]);
    expect(issues.map((i) => [i.slug, i.code])).toEqual([
      ['broken', 'schema_error'],
      ['empty', 'schema_error'],
      ['invalid', 'zod_error'],
    ]);
    expect(issues[2]?.message).toBe(
      'invalid: name Invalid input: expected string, received undefined',
    );
  });

  it('warns when an inline copy disagrees with the cache', async () => {
    await writeFile(
      join(cwd, 'data', 'records', 'cached.yml'),
      `${WITH_CACHE}health:\n  status: stale\n`,
    );
    const { issues, records } = await loadNormalizedRecords(config, cwd);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'github_cache_mismatch', severity: 'warning' });
    expect(issues[0]?.message).toContain('health status stale (inline) vs active (cache)');
    // The cache still wins.
    expect(records[0]?.record.kind === 'project' && records[0].record.health?.status).toBe(
      'active',
    );
  });

  it('resolves health from a stale sync as unknown and flags the entry', async () => {
    await writeFile(
      join(cwd, 'data', 'cache', 'github', 'cached.json'),
      JSON.stringify({ ...CACHE_ENTRY, lastSuccessAt: '2020-01-01T00:00:00.000Z' }),
    );
    const { records, entries } = await loadNormalizedRecords(config, cwd);
    expect(entries.map((e) => [e.slug, e.syncStale])).toEqual([
      ['cached', true],
      ['hidden', false],
      ['legacy', false],
    ]);
    expect(records[0]?.record).toMatchObject({
      health: { status: 'unknown', staleReason: 'sync_stale', visibility: 'highlight' },
    });
  });

  it('returns no records for a missing records directory', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'grove-normalize-empty-'));
    try {
      const result = await loadNormalizedRecords(config, empty);
      expect(result.records).toEqual([]);
      expect(result.issues).toEqual([]);
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });

  it('README and build agree on which records are visible', async () => {
    await writeFile(
      join(cwd, 'data', 'records', 'removed.yml'),
      [
        'slug: removed',
        'name: Removed',
        'category: tools',
        'visibility: remove',
        'links:',
        '  website: https://removed.example',
        '',
      ].join('\n'),
    );
    await generate(cwd, config);
    const index = JSON.parse(
      await readFile(join(cwd, 'data', 'generated', 'records.index.json'), 'utf8'),
    ) as { records: Array<{ slug: string }> };
    const built = index.records.map((r) => r.slug).sort();

    const { records } = await loadNormalizedRecords(config, cwd);
    const readmeRecords = records.map((r) => toAwesomeReadmeRecord(r.record));
    const listed = readmeRecords
      .filter((r) => r.visibility !== 'hide' && r.visibility !== 'remove')
      .map((r) => r.slug)
      .sort();
    expect(listed).toEqual(built);
    expect(built).toEqual(['cached', 'legacy']);

    const markdown = buildAwesomeReadme({
      site: { name: 'test' },
      categories: [{ id: 'tools', name: 'Tools' }],
      records: readmeRecords,
      generatedAt: '2026-09-26T00:00:00.000Z',
    });
    expect(markdown).toContain('[Cached](https://github.com/owner/cached)');
    expect(markdown).toContain('- Legacy - Inline github block');
    expect(markdown).not.toContain('Hidden');
    expect(markdown).not.toContain('Removed');
  });

  it('check and cleanup read the same normalized records', async () => {
    // validateProject resolves against process.cwd(); run it there.
    const previous = process.cwd();
    process.chdir(cwd);
    try {
      const checked = await validateProject(config);
      expect(checked.errors).toEqual([]);
      const { report } = await cleanupStale(cwd, config);
      // `legacy` is a stale cleanup candidate; `hidden` only has the
      // health block fabricated for its decision, which is no signal.
      expect(report.candidates.map((c) => c.slug)).toEqual(['legacy']);
      expect(report.candidates[0]?.stars).toBe(7);
    } finally {
      process.chdir(previous);
    }
  });
});
