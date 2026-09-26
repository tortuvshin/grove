import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAwesomeReadme, toAwesomeReadmeRecord } from './awesome-readme.js';
import { generate } from './build-data.js';
import { cleanupStale } from './decisions.js';
import { loadNormalizedRecords, readRecordSources } from './normalize-records.js';
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

describe('record formats: YAML and Markdown', () => {
  let cwd: string;
  const records = () => join(cwd, 'data', 'records');
  const bodies = () => join(cwd, 'content', 'records');

  const YAML_ONLY = 'slug: data-only\nname: Data Only\ncategory: tools\n';
  const YAML_POINTER = [
    'slug: pointed',
    'name: Pointed',
    'description: Body lives in a sidecar',
    'category: tools',
    'content: ./content/records/pointed.md',
    '',
  ].join('\n');
  const POINTED_BODY = '# Pointed\n\nThe sidecar body.\n';
  const MARKDOWN = [
    '---',
    'name: Written',
    'description: One file, frontmatter plus body',
    'category: tools',
    '---',
    '',
    '## Review',
    '',
    'The body of a Markdown record.',
    '',
  ].join('\n');

  beforeEach(async () => {
    vi.stubEnv('GITHUB_TOKEN', '');
    vi.stubEnv('GITHUB_ACTIONS', '');
    cwd = await mkdtemp(join(tmpdir(), 'grove-formats-'));
    await mkdir(records(), { recursive: true });
    await mkdir(bodies(), { recursive: true });
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(cwd, { recursive: true, force: true });
  });

  it('reads a YAML-only record with no body', async () => {
    await writeFile(join(records(), 'data-only.yml'), YAML_ONLY);
    const { records: out, issues } = await loadNormalizedRecords(config, cwd);
    expect(issues).toEqual([]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ slug: 'data-only', format: 'yaml' });
    expect(out[0]?.body).toBeUndefined();
    expect(out[0]?.record.content).toBeUndefined();
  });

  it('reads a YAML record with a content pointer, and its body', async () => {
    await writeFile(join(records(), 'pointed.yml'), YAML_POINTER);
    await writeFile(join(bodies(), 'pointed.md'), POINTED_BODY);
    const { records: out, issues } = await loadNormalizedRecords(config, cwd);
    // The pointed-at file is a body, not a second record, and the
    // pointer format does not warn unless the site opts in.
    expect(issues).toEqual([]);
    expect(out.map((r) => [r.slug, r.format])).toEqual([['pointed', 'yaml+content']]);
    expect(out[0]?.record.content).toBe('./content/records/pointed.md');
    expect(out[0]?.body).toBe(POINTED_BODY);
  });

  it('warns about content pointers only when records.deprecateContentPointer is set', async () => {
    await writeFile(join(records(), 'pointed.yml'), YAML_POINTER);
    await writeFile(join(bodies(), 'pointed.md'), POINTED_BODY);
    const strict = groveConfigSchema.parse({
      ...config,
      records: { deprecateContentPointer: true },
    });
    const { records: out, issues } = await loadNormalizedRecords(strict, cwd);
    expect(out).toHaveLength(1);
    expect(issues).toEqual([
      expect.objectContaining({
        code: 'record_format_deprecated',
        severity: 'warning',
        slug: 'pointed',
      }),
    ]);
    expect(issues[0]?.message).toContain('content/records/pointed.md');
  });

  it('reads a Markdown record: slug from the file name, body from the file', async () => {
    await writeFile(join(bodies(), 'written.md'), MARKDOWN);
    const { records: out, issues } = await loadNormalizedRecords(config, cwd);
    expect(issues).toEqual([]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      slug: 'written',
      format: 'markdown',
      file: join('content', 'records', 'written.md'),
      declaredSlug: undefined,
      record: {
        kind: 'project',
        slug: 'written',
        name: 'Written',
        description: 'One file, frontmatter plus body',
        // Renderers read the body through `content`, as for a pointer.
        content: './content/records/written.md',
      },
    });
    expect(out[0]?.body).toBe('\n## Review\n\nThe body of a Markdown record.\n');
  });

  it('validates frontmatter with the same schema as YAML', async () => {
    await writeFile(
      join(bodies(), 'bad.md'),
      '---\nname: Bad\ncategory: tools\nstacks: not-a-list\n---\nBody\n',
    );
    const { records: out, issues } = await loadNormalizedRecords(config, cwd);
    expect(out).toEqual([]);
    expect(issues.map((i) => [i.code, i.message])).toEqual([
      ['zod_error', 'bad: stacks Invalid input: expected array, received string'],
    ]);
  });

  it('reads both formats side by side and ignores Markdown that is not a record', async () => {
    await writeFile(join(records(), 'data-only.yml'), YAML_ONLY);
    await writeFile(join(records(), 'pointed.yml'), YAML_POINTER);
    await writeFile(join(bodies(), 'pointed.md'), POINTED_BODY);
    await writeFile(join(bodies(), 'written.md'), MARKDOWN);
    // A body nothing points at, and frontmatter with no `name`.
    await writeFile(join(bodies(), 'orphan.md'), 'Just prose.\n');
    await writeFile(join(bodies(), 'notes.md'), '---\ntitle: Notes\n---\nNot a record.\n');
    const { records: out, issues } = await loadNormalizedRecords(config, cwd);
    expect(issues).toEqual([]);
    expect(out.map((r) => [r.slug, r.format])).toEqual([
      ['data-only', 'yaml'],
      ['pointed', 'yaml+content'],
      ['written', 'markdown'],
    ]);
  });

  it('rejects one slug in both formats instead of picking one', async () => {
    await writeFile(join(records(), 'written.yml'), 'slug: written\nname: YAML copy\n');
    await writeFile(join(bodies(), 'written.md'), MARKDOWN);
    const { records: out, issues } = await loadNormalizedRecords(config, cwd);
    expect(out).toEqual([]);
    expect(issues.map((i) => [i.code, i.file])).toEqual([
      ['duplicate_slug_format', join('content', 'records', 'written.md')],
      ['duplicate_slug_format', join('data', 'records', 'written.yml')],
    ]);
    expect(issues[0]?.message).toBe(
      `written: record is defined twice (${join('data', 'records', 'written.yml')} and ${join('content', 'records', 'written.md')}); keep one format and delete the other`,
    );
    await expect(generate(cwd, config)).rejects.toThrow('generate failed');
  });

  it('keeps the file name as the slug when frontmatter declares another', async () => {
    await writeFile(join(bodies(), 'written.md'), MARKDOWN.replace('---\n', '---\nslug: other\n'));
    const { records: out } = await loadNormalizedRecords(config, cwd);
    expect(out[0]?.slug).toBe('written');
    expect(out[0]?.record.slug).toBe('written');
    expect(out[0]?.declaredSlug).toBe('other');
  });

  it('rejects a Markdown record that also points at a body', async () => {
    await writeFile(
      join(bodies(), 'written.md'),
      MARKDOWN.replace('---\n', '---\ncontent: ./elsewhere.md\n'),
    );
    const { records: out, issues } = await loadNormalizedRecords(config, cwd);
    expect(out).toEqual([]);
    expect(issues.map((i) => i.code)).toEqual(['markdown_content_pointer']);
  });

  it('normalizes a YAML + pointer record and its Markdown conversion identically', async () => {
    await writeFile(join(records(), 'pointed.yml'), YAML_POINTER);
    await writeFile(join(bodies(), 'pointed.md'), POINTED_BODY);
    const before = (await loadNormalizedRecords(config, cwd)).records[0];

    // Convert by hand: frontmatter = the YAML minus its pointer.
    const frontmatter = YAML_POINTER.replace('content: ./content/records/pointed.md\n', '');
    await writeFile(join(bodies(), 'pointed.md'), `---\n${frontmatter}---\n${POINTED_BODY}`);
    await rm(join(records(), 'pointed.yml'));
    const after = (await loadNormalizedRecords(config, cwd)).records[0];

    expect(after?.format).toBe('markdown');
    expect(after?.record).toEqual(before?.record);
    expect(after?.base).toEqual(before?.base);
    expect(after?.body).toBe(before?.body);
    expect(after?.visibility).toBe(before?.visibility);
    expect(after?.declaredSlug).toBe(before?.declaredSlug);
  });

  it('grove check accepts a Markdown-only site', async () => {
    await rm(records(), { recursive: true });
    await writeFile(join(bodies(), 'written.md'), MARKDOWN);
    const previous = process.cwd();
    process.chdir(cwd);
    try {
      const result = await validateProject(config);
      expect(result.errors).toEqual([]);
      // The body resolves through `content`, like a pointer would.
      expect(result.warnings.map((w) => w.code)).toEqual(['missing_added_at']);
    } finally {
      process.chdir(previous);
    }
  });
});

describe('readRecordSources', () => {
  it('returns raw data for both formats without merging any layer', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'grove-sources-'));
    try {
      await mkdir(join(cwd, 'data', 'records'), { recursive: true });
      await mkdir(join(cwd, 'content', 'records'), { recursive: true });
      await writeFile(join(cwd, 'data', 'records', 'a.yml'), 'name: A\n');
      await writeFile(join(cwd, 'content', 'records', 'b.md'), '---\nname: B\n---\nBody\n');
      const { sources } = await readRecordSources(config, cwd);
      expect(sources.map((s) => [s.slug, s.format, s.data, s.body])).toEqual([
        ['a', 'yaml', { name: 'A' }, undefined],
        ['b', 'markdown', { name: 'B' }, 'Body\n'],
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
