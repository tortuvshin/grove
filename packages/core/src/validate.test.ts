/**
 * @grove-dev/core — `validateProject` unit tests.
 *
 * The brief calls out two silent try/catch blocks in validate.ts:
 *   - line 70:   `readdir(recordsDir).catch(() => [])` — missing
 *                 records dir is silently treated as zero records.
 *                 Tests pin this behaviour so a future "throw on
 *                 missing dir" change is visible.
 *   - line 54-69: the Zod parse step at line 109 is wrapped in a
 *                 try/catch that produces structured `zod_error`
 *                 issues. Tests cover BOTH the valid-input path
 *                 (no issues) and the malformed-input path
 *                 (one or more issues with the right codes).
 *
 * Tests use `tmpdir()` (per the brief — no fs mocks) and chdir
 * into the test dir for the duration of each test (validateProject
 * resolves paths against `process.cwd()`).
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GroveConfig } from './schema.js';
import { validateProject } from './validate.js';

function makeConfig(overrides: Partial<GroveConfig> = {}): GroveConfig {
  return {
    site: { name: 'test', tagline: 'test' },
    paths: {
      recordsDir: 'data/records',
      generatedDir: 'data/generated',
      health: 'data/health.yml',
      decisions: 'data/decisions.yml',
    },
    blueprint: 'project-directory',
    nav: [],
    theme: {},
    integrations: {},
    ...overrides,
  } as GroveConfig;
}

/**
 * Run `fn` with `process.cwd()` set to a fresh tmpdir. Restores
 * the original CWD in a finally block so test failures (or thrown
 * asserts) cannot leave the runner in a deleted directory.
 *
 * `mkdtemp` is the right helper here: `os.tmpdir({prefix})` (the
 * Node 22 form) does NOT create a subdir, it just returns the
 * env TMPDIR. `mkdtemp(prefix + '-')` creates a unique directory
 * under the env TMPDIR.
 */
async function withTmpCwd<T>(prefix: string, fn: (cwd: string) => Promise<T>): Promise<T> {
  const cwd = await mkdtemp(join(tmpdir(), prefix + '-'));
  const original = process.cwd();
  process.chdir(cwd);
  try {
    return await fn(cwd);
  } finally {
    process.chdir(original);
    await rm(cwd, { recursive: true, force: true });
  }
}

describe('validateProject — happy path', () => {
  it('returns ok=true with no issues when the records dir is empty', async () => {
    await withTmpCwd('grove-validate-empty-', async (cwd) => {
      await mkdir(join(cwd, 'data', 'records'), { recursive: true });
      const result = await validateProject(makeConfig());
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });

  it('warns when a record uses a category missing from configured taxonomy', async () => {
    await withTmpCwd('grove-validate-taxonomy-', async (cwd) => {
      await mkdir(join(cwd, 'data', 'records'), { recursive: true });
      await mkdir(join(cwd, 'data', 'taxonomy'), { recursive: true });
      await writeFile(
        join(cwd, 'data', 'taxonomy', 'categories.yml'),
        '- id: news\n  name: News and Magazine\n',
      );
      await writeFile(
        join(cwd, 'data', 'records', 'reader.yml'),
        [
          'kind: project',
          'slug: reader',
          'name: Reader',
          'description: a reader',
          'category: news-and-magazine',
          'links: {}',
          'curation: { reviewed: false, labels: [], lenses: [] }',
          'scores: {}',
        ].join('\n'),
      );

      const result = await validateProject(makeConfig());
      expect(result.warnings).toContainEqual({
        code: 'unknown_taxonomy_value',
        message:
          'reader: category "news-and-magazine" is not defined in data/taxonomy/categories.yml',
        severity: 'warning',
      });
    });
  });

  it('allows open-ended supporting technologies outside the primary stack taxonomy', async () => {
    await withTmpCwd('grove-validate-supporting-stacks-', async (cwd) => {
      await mkdir(join(cwd, 'data', 'records'), { recursive: true });
      await mkdir(join(cwd, 'data', 'taxonomy'), { recursive: true });
      await writeFile(
        join(cwd, 'data', 'taxonomy', 'stacks.yml'),
        '- id: ios\n  name: Native iOS\n',
      );
      await writeFile(
        join(cwd, 'data', 'records', 'reader.yml'),
        [
          'kind: project',
          'slug: reader',
          'addedAt: 2026-01-01',
          'name: Reader',
          'description: a reader',
          'stack: ios',
          'stacks: [swiftui, spritekit]',
          'links: {}',
          'curation: { reviewed: false, labels: [], lenses: [] }',
          'scores: {}',
        ].join('\n'),
      );

      const result = await validateProject(makeConfig());
      expect(result.warnings).toEqual([]);
    });
  });

  it('validates a single well-formed record and returns ok=true', async () => {
    await withTmpCwd('grove-validate-ok-', async (cwd) => {
      await mkdir(join(cwd, 'data', 'records'), { recursive: true });
      await writeFile(
        join(cwd, 'data', 'records', 'demo.yml'),
        [
          'kind: project',
          'slug: demo',
          'addedAt: 2026-01-01',
          'name: Demo',
          'description: a demo',
          'category: tools',
          'links: {}',
          'curation: { reviewed: false, labels: [], lenses: [] }',
          'scores: {}',
        ].join('\n'),
      );

      const result = await validateProject(makeConfig());
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });

  it('warns when a record has no addedAt', async () => {
    await withTmpCwd('grove-validate-no-added-at-', async (cwd) => {
      await mkdir(join(cwd, 'data', 'records'), { recursive: true });
      await writeFile(
        join(cwd, 'data', 'records', 'demo.yml'),
        [
          'kind: project',
          'slug: demo',
          'name: Demo',
          'description: a demo',
          'category: tools',
          'links: {}',
          'curation: { reviewed: false, labels: [], lenses: [] }',
          'scores: {}',
        ].join('\n'),
      );

      const result = await validateProject(makeConfig());
      // A warning, not an error: the record still builds, it just
      // cannot sort correctly in `recently-added`.
      expect(result.ok).toBe(true);
      expect(result.warnings.map((w) => w.code)).toContain('missing_added_at');
    });
  });

  it('emits a slug_mismatch warning when filename and record.slug differ', async () => {
    await withTmpCwd('grove-validate-mismatch-', async (cwd) => {
      await mkdir(join(cwd, 'data', 'records'), { recursive: true });
      // Filename is "demo", record.slug is "different-slug". This
      // is a warning, not an error — the record is still considered
      // valid; the warning helps curators notice the mismatch.
      await writeFile(
        join(cwd, 'data', 'records', 'demo.yml'),
        [
          'kind: project',
          'slug: different-slug',
          'name: Demo',
          'description: a demo',
          'category: tools',
          'links: {}',
          'curation: { reviewed: false, labels: [], lenses: [] }',
          'scores: {}',
        ].join('\n'),
      );

      const result = await validateProject(makeConfig());
      expect(result.ok).toBe(true); // warnings do not fail by default
      expect(result.warnings.some((w) => w.code === 'slug_mismatch')).toBe(true);
    });
  });
});

describe('validateProject — silent try/catch at line 70 (missing records dir)', () => {
  it('returns a missing_records_dir error, NOT a throw, when recordsDir does not exist', async () => {
    await withTmpCwd('grove-validate-missing-', async () => {
      // validateProject at line 60 checks `exists(recordsDir)` first
      // and emits a `missing_records_dir` error. The brief flagged
      // the readdir at line 70 with a `.catch(() => [])` as audit
      // concern. Pin the *current* behaviour: a missing dir is a
      // top-level error with the code `missing_records_dir`, not a
      // throw and not a silent pass.
      const config = makeConfig({
        paths: {
          recordsDir: 'data/does-not-exist',
          generatedDir: 'data/generated',
          health: 'data/health.yml',
          decisions: 'data/decisions.yml',
        },
      } as Partial<GroveConfig>);
      const result = await validateProject(config);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === 'missing_records_dir')).toBe(true);
    });
  });
});

describe('validateProject — silent try/catch at lines 54-69 (Zod parse)', () => {
  it('emits zod_error issues for a record missing required fields', async () => {
    await withTmpCwd('grove-validate-bad-fields-', async (cwd) => {
      await mkdir(join(cwd, 'data', 'records'), { recursive: true });
      // project requires `name` (min 1). The minimal stub here is
      // missing it, so Zod should reject with one or more
      // zod_error issues — the validation pipeline's structured
      // error path that CLI's `grove validate` renders.
      await writeFile(
        join(cwd, 'data', 'records', 'broken.yml'),
        [
          'kind: project',
          'slug: broken',
          'description: missing the name field',
          'category: tools',
          'links: {}',
          'curation: { reviewed: false, labels: [], lenses: [] }',
          'scores: {}',
        ].join('\n'),
      );

      const result = await validateProject(makeConfig());
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // The error code from the Zod try/catch is "zod_error", and
      // the path should mention the missing field ("name").
      const zodErr = result.errors.find((e) => e.code === 'zod_error');
      expect(zodErr).toBeDefined();
      expect(zodErr?.message).toContain('name');
    });
  });

  it('emits a schema_error (not zod_error) when the YAML is an empty mapping', async () => {
    await withTmpCwd('grove-validate-empty-yml-', async (cwd) => {
      await mkdir(join(cwd, 'data', 'records'), { recursive: true });
      // Edge case the brief flagged: parseYaml returns `null` for
      // an empty document, and the code at line 79-88 treats that
      // as `schema_error` (not zod_error) because the value never
      // reaches the Zod parse step. Pin the specific code.
      await writeFile(join(cwd, 'data', 'records', 'empty.yml'), '');

      const result = await validateProject(makeConfig());
      expect(result.ok).toBe(false);
      const e = result.errors.find((err) => err.code === 'schema_error');
      expect(e).toBeDefined();
      expect(e?.message).toContain('empty');
    });
  });

  it('strict mode: a single warning causes ok=false', async () => {
    await withTmpCwd('grove-validate-strict-', async (cwd) => {
      await mkdir(join(cwd, 'data', 'records'), { recursive: true });
      // Pin the strict-mode contract: any warning becomes a
      // failure. The `slug_mismatch` test above returns ok=true
      // (warnings don't fail by default) — the same record with
      // `strict: true` returns ok=false.
      await writeFile(
        join(cwd, 'data', 'records', 'demo.yml'),
        [
          'kind: project',
          'slug: different-slug',
          'name: Demo',
          'description: a demo',
          'category: tools',
          'links: {}',
          'curation: { reviewed: false, labels: [], lenses: [] }',
          'scores: {}',
        ].join('\n'),
      );

      const lenient = await validateProject(makeConfig());
      expect(lenient.ok).toBe(true);

      const strict = await validateProject(makeConfig(), { strict: true });
      expect(strict.ok).toBe(false);
    });
  });
});

describe('validateProject — decision / health cross-references', () => {
  it('emits unknown_decision_record when a decisions.yml references a non-existent slug', async () => {
    await withTmpCwd('grove-validate-xref-decision-', async (cwd) => {
      await mkdir(join(cwd, 'data', 'records'), { recursive: true });
      await writeFile(
        join(cwd, 'data', 'records', 'real.yml'),
        [
          'kind: project',
          'slug: real',
          'name: Real',
          'description: real record',
          'category: tools',
          'links: {}',
          'curation: { reviewed: false, labels: [], lenses: [] }',
          'scores: {}',
        ].join('\n'),
      );
      // decisions.yml points at "ghost" which is not in records/
      await writeFile(
        join(cwd, 'data', 'decisions.yml'),
        [
          'decisions:',
          '  - id: ghost',
          '    decision:',
          '      visibility: hide',
          '      reason: tested as unknown reference',
        ].join('\n'),
      );

      const result = await validateProject(makeConfig());
      const e = result.errors.find((err) => err.code === 'unknown_decision_record');
      expect(e).toBeDefined();
      expect(e?.message).toContain('ghost');
    });
  });

  it('emits missing_health when a record points at GitHub but no health.yml exists', async () => {
    await withTmpCwd('grove-validate-xref-health-', async (cwd) => {
      await mkdir(join(cwd, 'data', 'records'), { recursive: true });
      await writeFile(
        join(cwd, 'data', 'records', 'needs-health.yml'),
        [
          'kind: project',
          'slug: needs-health',
          'name: Needs Health',
          'description: this record points at GitHub',
          'category: tools',
          "links: { github: 'https://github.com/owner/repo' }",
          'curation: { reviewed: false, labels: [], lenses: [] }',
          'scores: {}',
        ].join('\n'),
      );

      const result = await validateProject(makeConfig());
      const w = result.warnings.find((warn) => warn.code === 'missing_health_file');
      expect(w).toBeDefined();
    });
  });

  it('does not emit missing_health when the record carries an inline health block', async () => {
    await withTmpCwd('grove-validate-inline-health-', async (cwd) => {
      await mkdir(join(cwd, 'data', 'records'), { recursive: true });
      await writeFile(
        join(cwd, 'data', 'records', 'has-inline-health.yml'),
        [
          'kind: project',
          'slug: has-inline-health',
          'name: Has Inline Health',
          'description: this record points at GitHub and carries its own health block',
          'category: tools',
          "links: { github: 'https://github.com/owner/repo' }",
          'curation: { reviewed: false, labels: [], lenses: [] }',
          'scores: {}',
          'health: { status: active, maturity: useful, tier: listed, visibility: keep, cleanupCandidate: false, confidence: high, reasons: [] }',
        ].join('\n'),
      );

      const result = await validateProject(makeConfig());
      expect(result.errors.find((err) => err.code === 'missing_health')).toBeUndefined();
      expect(result.warnings.find((warn) => warn.code === 'missing_health_file')).toBeUndefined();
    });
  });
});

describe('validateProject — inline health vs health.yml parity', () => {
  const PARITY_CODES = [
    'health_source_mismatch',
    'health_source_missing_entry',
    'health_file_orphan_entry',
  ];

  async function writeInlineRecord(cwd: string, slug: string, status = 'active') {
    await mkdir(join(cwd, 'data', 'records'), { recursive: true });
    await writeFile(
      join(cwd, 'data', 'records', `${slug}.yml`),
      [
        'kind: project',
        `slug: ${slug}`,
        `name: ${slug}`,
        'description: record with inline health',
        "addedAt: '2026-01-01'",
        'category: tools',
        "links: { github: 'https://github.com/owner/repo' }",
        'curation: { reviewed: false, labels: [], lenses: [] }',
        'scores: {}',
        "github: { repository: { pushed_at: '2026-08-01T00:00:00Z' } }",
        `health: { status: ${status}, tier: listed, visibility: keep }`,
      ].join('\n'),
    );
  }

  async function writeHealthFile(
    cwd: string,
    entries: { id: string; status: string; pushedAt?: string }[],
  ) {
    await writeFile(
      join(cwd, 'data', 'health.yml'),
      [
        'health:',
        ...entries.flatMap((entry) => [
          `  - id: ${entry.id}`,
          `    github: { pushedAt: '${entry.pushedAt ?? '2026-08-01T00:00:00Z'}' }`,
          `    health: { status: ${entry.status}, tier: listed, visibility: keep }`,
        ]),
      ].join('\n'),
    );
  }

  const parityWarnings = (warnings: { code: string }[]) =>
    warnings.filter((warn) => PARITY_CODES.includes(warn.code));

  it('stays quiet when inline health matches the health.yml entry', async () => {
    await withTmpCwd('grove-validate-parity-match-', async (cwd) => {
      await writeInlineRecord(cwd, 'same');
      await writeHealthFile(cwd, [{ id: 'same', status: 'active' }]);

      const result = await validateProject(makeConfig());
      expect(parityWarnings(result.warnings)).toEqual([]);
    });
  });

  it('emits health_source_mismatch naming the record and the differing fields', async () => {
    await withTmpCwd('grove-validate-parity-mismatch-', async (cwd) => {
      await writeInlineRecord(cwd, 'drifted', 'active');
      await writeHealthFile(cwd, [{ id: 'drifted', status: 'stale' }]);

      const result = await validateProject(makeConfig());
      const mismatches = result.warnings.filter((w) => w.code === 'health_source_mismatch');
      expect(mismatches).toHaveLength(1);
      expect(mismatches[0]?.message).toContain('drifted');
      expect(mismatches[0]?.message).toContain('status active (inline) vs stale (file)');
      expect(mismatches[0]?.message).not.toContain('tier');
      expect(mismatches[0]?.message).not.toContain('lastCommitAt');
    });
  });

  it('emits health_source_missing_entry when an inline-health record is absent from health.yml', async () => {
    await withTmpCwd('grove-validate-parity-missing-', async (cwd) => {
      await writeInlineRecord(cwd, 'listed');
      await writeInlineRecord(cwd, 'unlisted');
      await writeHealthFile(cwd, [{ id: 'listed', status: 'active' }]);

      const result = await validateProject(makeConfig());
      const missing = parityWarnings(result.warnings);
      expect(missing.map((w) => w.code)).toEqual(['health_source_missing_entry']);
      expect(missing[0]?.message).toContain('unlisted');
    });
  });

  it('compares lastCommitAt against the health.yml entry pushedAt', async () => {
    await withTmpCwd('grove-validate-parity-commit-', async (cwd) => {
      await writeInlineRecord(cwd, 'old-file');
      await writeHealthFile(cwd, [
        { id: 'old-file', status: 'active', pushedAt: '2025-01-01T00:00:00Z' },
      ]);

      const result = await validateProject(makeConfig());
      const mismatch = result.warnings.find((w) => w.code === 'health_source_mismatch');
      expect(mismatch?.message).toContain('lastCommitAt 2026-08-01T00:00:00Z (inline)');
      expect(mismatch?.message).not.toContain('status');
    });
  });

  it('emits health_file_orphan_entry for a health.yml id with no record', async () => {
    await withTmpCwd('grove-validate-parity-orphan-', async (cwd) => {
      await writeInlineRecord(cwd, 'real');
      await writeHealthFile(cwd, [
        { id: 'real', status: 'active' },
        { id: 'ghost', status: 'active' },
      ]);

      const result = await validateProject(makeConfig());
      const orphans = parityWarnings(result.warnings);
      expect(orphans.map((w) => w.code)).toEqual(['health_file_orphan_entry']);
      expect(orphans[0]?.message).toContain('ghost');
      // The orphan is the only warning, so it alone is what --strict fails on.
      expect(result.warnings).toHaveLength(1);
      expect(result.ok).toBe(true);
      expect((await validateProject(makeConfig(), { strict: true })).ok).toBe(false);
    });
  });

  it('adds no parity warnings when health.yml does not exist', async () => {
    await withTmpCwd('grove-validate-parity-nofile-', async (cwd) => {
      await writeInlineRecord(cwd, 'solo');

      const result = await validateProject(makeConfig());
      expect(parityWarnings(result.warnings)).toEqual([]);
    });
  });
});

describe('validateProject — collections', () => {
  const record = (slug: string, extra: string[] = []) =>
    [
      'kind: project',
      `slug: ${slug}`,
      `name: ${slug}`,
      'description: a record',
      'addedAt: 2026-01-01',
      'category: tools',
      'links: {}',
      'curation: { reviewed: false, labels: [], lenses: [] }',
      'scores: {}',
      ...extra,
    ].join('\n');

  async function scaffold(cwd: string, collections: Record<string, string>) {
    await mkdir(join(cwd, 'data', 'records'), { recursive: true });
    await mkdir(join(cwd, 'data', 'collections'), { recursive: true });
    await mkdir(join(cwd, 'data', 'taxonomy'), { recursive: true });
    await writeFile(
      join(cwd, 'data', 'taxonomy', 'categories.yml'),
      '- id: tools\n  name: Tools\n',
    );
    await writeFile(join(cwd, 'data', 'records', 'alpha.yml'), record('alpha'));
    for (const [file, text] of Object.entries(collections)) {
      await writeFile(join(cwd, 'data', 'collections', file), text);
    }
  }

  it('accepts a valid collection that matches records', async () => {
    await withTmpCwd('grove-validate-collection-ok-', async (cwd) => {
      await scaffold(cwd, {
        'tools.yml':
          'slug: tools\ntitle: Tools\ndescription: All tools.\nquery: { categories: [tools] }\n',
      });
      const result = await validateProject(makeConfig());
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });

  it('reports every schema problem in a collection file as an error', async () => {
    await withTmpCwd('grove-validate-collection-bad-', async (cwd) => {
      await scaffold(cwd, {
        'bad.yml':
          'slug: bad\ntitle: Bad\ndescription: x\nranking: { preset: popularity }\nquery: { minStars: "5" }\n',
      });
      const result = await validateProject(makeConfig());
      expect(result.ok).toBe(false);
      const messages = result.errors
        .filter((e) => e.code === 'collection_invalid')
        .map((e) => e.message);
      expect(messages).toHaveLength(2);
      expect(messages.every((m) => m.startsWith('collections/bad.yml: '))).toBe(true);
    });
  });

  it('errors on a slug used by two files and warns when slug and file name differ', async () => {
    await withTmpCwd('grove-validate-collection-slugs-', async (cwd) => {
      const body = 'title: T\ndescription: d\n';
      await scaffold(cwd, {
        'a.yml': `slug: shared\n${body}`,
        'b.yml': `slug: shared\n${body}`,
      });
      const result = await validateProject(makeConfig());
      expect(result.errors.map((e) => e.code)).toEqual(['duplicate_collection_slug']);
      expect(result.warnings.map((w) => w.code)).toContain('collection_slug_mismatch');
    });
  });

  it('warns about unknown taxonomy values and an empty result', async () => {
    await withTmpCwd('grove-validate-collection-empty-', async (cwd) => {
      await scaffold(cwd, {
        'games.yml': 'slug: games\ntitle: Games\ndescription: d\nquery: { categories: [games] }\n',
      });
      const result = await validateProject(makeConfig());
      expect(result.errors).toEqual([]);
      expect(result.warnings.map((w) => w.code).sort()).toEqual([
        'collection_empty',
        'unknown_taxonomy_value',
      ]);
    });
  });

  it('errors on an unknown pick and a missing body, warns on a hidden pick', async () => {
    await withTmpCwd('grove-validate-collection-picks-', async (cwd) => {
      await scaffold(cwd, {
        'picks.yml': [
          'slug: picks',
          'title: Picks',
          'description: d',
          'content: ./content/collections/picks.md',
          'entries:',
          '  - slug: alpha',
          '  - slug: ghost',
          '  - slug: hidden-one',
        ].join('\n'),
      });
      await writeFile(
        join(cwd, 'data', 'records', 'hidden-one.yml'),
        record('hidden-one', ['visibility: hide']),
      );
      const result = await validateProject(makeConfig());
      expect(result.errors.map((e) => e.code).sort()).toEqual([
        'collection_body_missing',
        'collection_unknown_entry',
      ]);
      expect(result.warnings.map((w) => w.code)).toEqual(['collection_hidden_entry']);
    });
  });
});

describe('validateProject — subjects and relations', () => {
  const record = (slug: string, relationTo?: string) =>
    [
      'kind: project',
      `slug: ${slug}`,
      `name: ${slug}`,
      'description: a record',
      'addedAt: 2026-01-01',
      'category: tools',
      'links: {}',
      'curation: { reviewed: false, labels: [], lenses: [] }',
      'scores: {}',
      ...(relationTo ? ['relations:', '  - type: alternative-to', `    to: ${relationTo}`] : []),
    ].join('\n');

  async function scaffold(
    cwd: string,
    files: {
      subjects?: string;
      records: Record<string, string>;
      collections?: Record<string, string>;
    },
  ) {
    await mkdir(join(cwd, 'data', 'records'), { recursive: true });
    await mkdir(join(cwd, 'data', 'collections'), { recursive: true });
    await mkdir(join(cwd, 'data', 'taxonomy'), { recursive: true });
    await writeFile(
      join(cwd, 'data', 'taxonomy', 'categories.yml'),
      '- id: tools\n  name: Tools\n',
    );
    if (files.subjects !== undefined) {
      await writeFile(join(cwd, 'data', 'taxonomy', 'subjects.yml'), files.subjects);
    }
    for (const [slug, text] of Object.entries(files.records)) {
      await writeFile(join(cwd, 'data', 'records', `${slug}.yml`), text);
    }
    for (const [file, text] of Object.entries(files.collections ?? {})) {
      await writeFile(join(cwd, 'data', 'collections', file), text);
    }
  }

  it('errors when a relation points at a subject that is not defined', async () => {
    await withTmpCwd('grove-validate-unknown-subject-', async (cwd) => {
      await scaffold(cwd, { records: { alpha: record('alpha', 'notion') } });
      const result = await validateProject(makeConfig());
      expect(result.errors.map((e) => e.code)).toEqual(['unknown_subject']);
    });
  });

  it('reports an invalid and a duplicated subject', async () => {
    await withTmpCwd('grove-validate-bad-subjects-', async (cwd) => {
      await scaffold(cwd, {
        subjects:
          '- id: notion\n  name: Notion\n- id: notion\n  name: Notion again\n- id: Bad_Id\n  name: Bad\n',
        records: { alpha: record('alpha') },
      });
      const result = await validateProject(makeConfig());
      expect(result.errors.map((e) => e.code).sort()).toEqual([
        'duplicate_subject',
        'subject_invalid',
      ]);
    });
  });

  it('errors on an unknown collection subject and on two hubs for one subject', async () => {
    await withTmpCwd('grove-validate-hubs-', async (cwd) => {
      const hub = (slug: string, subject: string) =>
        `slug: ${slug}\ntitle: ${slug}\ndescription: d\nsubject: ${subject}\nquery: { relatedTo: { subjects: [${subject}] } }\n`;
      await scaffold(cwd, {
        subjects: '- id: notion\n  name: Notion\n',
        records: { alpha: record('alpha', 'notion') },
        collections: {
          'a.yml': hub('a', 'notion'),
          'b.yml': hub('b', 'notion'),
          'c.yml': hub('c', 'slack'),
        },
      });
      const result = await validateProject(makeConfig());
      expect(result.errors.map((e) => e.code).sort()).toEqual([
        'collection_unknown_subject',
        'duplicate_subject_hub',
      ]);
    });
  });

  it('warns when three records share a subject and no collection is its hub', async () => {
    await withTmpCwd('grove-validate-hubless-', async (cwd) => {
      await scaffold(cwd, {
        subjects: '- id: notion\n  name: Notion\n',
        records: {
          alpha: record('alpha', 'notion'),
          beta: record('beta', 'notion'),
          gamma: record('gamma', 'notion'),
        },
      });
      const result = await validateProject(makeConfig());
      expect(result.errors).toEqual([]);
      expect(result.warnings.map((w) => w.code)).toEqual(['subject_without_collection']);
    });
  });
});

describe('validateProject — record content pointers', () => {
  /** Write one record, optionally with a `content` pointer and its body. */
  async function scaffoldRecord(cwd: string, content?: string, body?: string) {
    await mkdir(join(cwd, 'data', 'records'), { recursive: true });
    await writeFile(
      join(cwd, 'data', 'records', 'demo.yml'),
      [
        'kind: project',
        'slug: demo',
        'addedAt: 2026-01-01',
        'name: Demo',
        'description: a demo',
        'category: tools',
        'links: {}',
        ...(content ? [`content: ${content}`] : []),
      ].join('\n'),
    );
    if (body !== undefined) {
      await mkdir(join(cwd, 'content', 'records'), { recursive: true });
      await writeFile(join(cwd, 'content', 'records', 'demo.md'), body);
    }
  }

  it('accepts a pointer to a body with real prose', async () => {
    await withTmpCwd('grove-validate-content-ok-', async (cwd) => {
      await scaffoldRecord(
        cwd,
        './content/records/demo.md',
        ['---', 'title: Demo', '---', '# Demo', '', 'Demo keeps notes in plain files.'].join('\n'),
      );
      const result = await validateProject(makeConfig(), { strict: true });
      expect(result.ok).toBe(true);
      expect(result.issues).toEqual([]);
    });
  });

  it('does not check a record without a content pointer', async () => {
    await withTmpCwd('grove-validate-content-none-', async (cwd) => {
      await scaffoldRecord(cwd);
      const result = await validateProject(makeConfig(), { strict: true });
      expect(result.issues).toEqual([]);
    });
  });

  it('errors when the pointer does not resolve to a file', async () => {
    await withTmpCwd('grove-validate-content-missing-', async (cwd) => {
      await scaffoldRecord(cwd, './content/records/demo.md');
      const result = await validateProject(makeConfig());
      expect(result.ok).toBe(false);
      expect(result.errors.map((e) => e.code)).toEqual(['content_pointer_missing']);
    });
  });

  it('warns on a body with only headings, and fails it under --strict', async () => {
    await withTmpCwd('grove-validate-content-headings-', async (cwd) => {
      await scaffoldRecord(
        cwd,
        './content/records/demo.md',
        ['---', 'title: Demo', '---', '# Demo', '', '## Overview', '', '## Setup', ''].join('\n'),
      );
      const result = await validateProject(makeConfig());
      expect(result.ok).toBe(true);
      expect(result.warnings.map((w) => w.code)).toEqual(['content_body_skeleton']);
      expect((await validateProject(makeConfig(), { strict: true })).ok).toBe(false);
    });
  });

  it('warns on a body of headings, comments and TODO placeholders', async () => {
    await withTmpCwd('grove-validate-content-todo-', async (cwd) => {
      await scaffoldRecord(
        cwd,
        './content/records/demo.md',
        [
          '## Overview',
          '',
          'TODO: write the overview',
          '<!-- describe the setup',
          'in a few sentences -->',
          '## Setup',
          '- TBD',
        ].join('\n'),
      );
      const result = await validateProject(makeConfig());
      expect(result.warnings.map((w) => w.code)).toEqual(['content_body_skeleton']);
    });
  });
});

describe('validateProject — readme.entryLinkTarget', () => {
  it("errors when entryLinkTarget is 'detail' and site.url is missing", async () => {
    await withTmpCwd('grove-validate-readme-detail-', async (cwd) => {
      await mkdir(join(cwd, 'data', 'records'), { recursive: true });
      const config = makeConfig({
        readme: { entryLinkTarget: 'detail' },
      } as Partial<GroveConfig>);
      const result = await validateProject(config);
      expect(result.errors.some((e) => e.code === 'readme_detail_link_requires_site_url')).toBe(
        true,
      );
    });
  });

  it("accepts 'detail' when site.url is set", async () => {
    await withTmpCwd('grove-validate-readme-detail-ok-', async (cwd) => {
      await mkdir(join(cwd, 'data', 'records'), { recursive: true });
      const config = makeConfig({
        site: { name: 'test', tagline: 'test', url: 'https://example.org' },
        readme: { entryLinkTarget: 'detail' },
      } as Partial<GroveConfig>);
      const result = await validateProject(config);
      expect(result.errors.some((e) => e.code === 'readme_detail_link_requires_site_url')).toBe(
        false,
      );
    });
  });
});
