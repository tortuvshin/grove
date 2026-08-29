/**
 * @grove-dev/core — decisions + cleanup-stale unit tests.
 *
 * `pickCleanupCandidates` is a pure predicate and trivially testable
 * without any I/O. `cleanupStale` reads from the filesystem and
 * writes `data/generated/cleanup-report.json` — the tests below use
 * `tmpdir()` (per the brief — no fs mocks) to spin up a real
 * project tree and exercise both the happy path and the missing-
 * files-dir / invalid-YAML silent-fallback paths.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupStale, pickCleanupCandidates } from './decisions.js';
import type { GroveConfig, Resource } from './schema.js';

function makeProjectResource(overrides: Partial<Resource> = {}): Resource {
  return {
    kind: 'project',
    slug: 'demo',
    name: 'Demo',
    description: 'A demo project',
    category: 'tools',
    tags: [],
    links: { github: 'https://github.com/owner/repo' },
    curation: { reviewed: false, labels: [], lenses: [] },
    scores: {},
    visibility: 'keep',
    ...overrides,
  } as Resource;
}

describe('pickCleanupCandidates — pure predicate', () => {
  it('returns records whose health.cleanupCandidate is true', () => {
    const r = makeProjectResource({
      health: {
        status: 'stale',
        maturity: 'useful',
        tier: 'listed',
        visibility: 'keep',
        cleanupCandidate: true,
        staleReason: 'no_commits_365_days',
        confidence: 'high',
        reasons: [],
      },
    });
    expect(pickCleanupCandidates([r])).toEqual([r]);
  });

  it("returns records whose health.status is 'unknown' or 'needs_review'", () => {
    const a = makeProjectResource({
      slug: 'a',
      health: {
        status: 'unknown',
        maturity: 'unknown',
        tier: 'experimental',
        visibility: 'keep',
        cleanupCandidate: false,
        staleReason: null,
        confidence: 'low',
        reasons: [],
      },
    });
    const b = makeProjectResource({
      slug: 'b',
      health: {
        status: 'needs_review',
        maturity: 'useful',
        tier: 'listed',
        visibility: 'keep',
        cleanupCandidate: false,
        staleReason: null,
        confidence: 'medium',
        reasons: [],
      },
    });
    const c = makeProjectResource({
      slug: 'c',
      health: {
        status: 'active',
        maturity: 'mature',
        tier: 'curated',
        visibility: 'keep',
        cleanupCandidate: false,
        staleReason: null,
        confidence: 'high',
        reasons: [],
      },
    });
    const out = pickCleanupCandidates([a, b, c]);
    expect(out.map((r) => r.slug).sort()).toEqual(['a', 'b']);
  });

  it('returns an empty array when no records need cleanup', () => {
    const a = makeProjectResource({
      health: {
        status: 'active',
        maturity: 'mature',
        tier: 'curated',
        visibility: 'keep',
        cleanupCandidate: false,
        staleReason: null,
        confidence: 'high',
        reasons: [],
      },
    });
    const b = makeProjectResource({
      slug: 'b',
      health: {
        status: 'mature',
        maturity: 'mature',
        tier: 'curated',
        visibility: 'keep',
        cleanupCandidate: false,
        staleReason: null,
        confidence: 'high',
        reasons: [],
      },
    });
    expect(pickCleanupCandidates([a, b])).toEqual([]);
  });

  it('treats a record with no health block as not-a-candidate', () => {
    const r = makeProjectResource(); // no health
    expect(pickCleanupCandidates([r])).toEqual([]);
  });
});

describe('cleanupStale — filesystem integration (real tmpdir)', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'grove-cleanup-test-'));
    await mkdir(join(cwd, 'data', 'records'), { recursive: true });
    await mkdir(join(cwd, 'data', 'generated'), { recursive: true });
    // cleanupStale → loadConfig → jiti-resolves grove.config.ts.
    // Write a minimal valid stub so the config loader doesn't throw.
    await writeFile(
      join(cwd, 'grove.config.ts'),
      [
        'export default {',
        "  site: { name: 'test', tagline: 'test' },",
        "  paths: { recordsDir: 'data/records', generatedDir: 'data/generated', health: 'data/health.yml', decisions: 'data/decisions.yml' },",
        "  blueprint: 'project-directory',",
        '  nav: [],',
        '  theme: {},',
        '  integrations: {},',
        '};',
      ].join('\n'),
    );
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('reads records, applies pickCleanupCandidates, writes cleanup-report.json', async () => {
    // One record whose health status is 'unknown' (cleanup candidate)
    // and one whose status is 'active' (not a candidate). The slug
    // field is in the YAML (matches the schema), and the file name
    // also carries it (cleanupStale overwrites normalized.slug
    // with the filename at line 88 — pinning that contract).
    await writeFile(
      join(cwd, 'data', 'records', 'stale-one.yml'),
      [
        'kind: project',
        'slug: stale-one',
        'name: Stale One',
        'description: an old project',
        'category: tools',
        "links: { github: 'https://github.com/owner/repo' }",
        'curation: { reviewed: false, labels: [], lenses: [] }',
        'scores: {}',
        'health:',
        '  status: unknown',
        '  maturity: unknown',
        '  tier: experimental',
        '  visibility: keep',
        '  cleanupCandidate: false',
        '  staleReason: null',
        '  confidence: low',
        '  reasons: []',
      ].join('\n'),
    );
    await writeFile(
      join(cwd, 'data', 'records', 'fresh.yml'),
      [
        'kind: project',
        'slug: fresh',
        'name: Fresh',
        'description: an active project',
        'category: tools',
        "links: { github: 'https://github.com/owner/fresh' }",
        'curation: { reviewed: false, labels: [], lenses: [] }',
        'scores: {}',
        'health:',
        '  status: active',
        '  maturity: mature',
        '  tier: curated',
        '  visibility: keep',
        '  cleanupCandidate: false',
        '  staleReason: null',
        '  confidence: high',
        '  reasons: []',
      ].join('\n'),
    );

    const { report, path } = await cleanupStale(cwd);
    expect(report.totalCandidates).toBe(1);
    expect(report.candidates[0]?.slug).toBe('stale-one');
    expect(report.candidates[0]?.status).toBe('unknown');
    expect(report.blueprint).toBe('project-directory');

    // Verify the file was actually written.
    const written = JSON.parse(await readFile(path, 'utf8')) as {
      totalCandidates: number;
      candidates: Array<{ slug: string }>;
    };
    expect(written.totalCandidates).toBe(1);
    expect(written.candidates[0]?.slug).toBe('stale-one');
  });

  it('skips records whose parsed YAML fails Zod (try/catch on recordsFileSchema.parse)', async () => {
    // The brief calls out the silent try/catch around
    // `recordsFileSchema.parse(raw)` in decisions.ts as audit
    // concern #1. Pin the *current* behaviour (skip, do not
    // throw) so a future change to throw is visible.
    //
    // Note: `parseYaml` itself is NOT in a try/catch — a totally
    // malformed YAML would crash the loop. The silent path the
    // audit flagged is the Zod parse step, not the YAML parse
    // step. So this test uses a YAML file that *parses* but
    // produces a value the Zod schema rejects (e.g. an array
    // where an object is required).
    await writeFile(
      join(cwd, 'data', 'records', 'broken.yml'),
      // YAML that parses to an array — fails Zod object validation.
      '- this\n- is\n- an\n- array\n',
    );
    // A second, valid record that IS a cleanup candidate.
    await writeFile(
      join(cwd, 'data', 'records', 'ok.yml'),
      [
        'kind: project',
        'slug: ok',
        'name: Ok',
        'description: candidate',
        'category: tools',
        'links: {}',
        'curation: { reviewed: false, labels: [], lenses: [] }',
        'scores: {}',
        'health:',
        '  status: needs_review',
        '  maturity: useful',
        '  tier: listed',
        '  visibility: keep',
        '  cleanupCandidate: false',
        '  staleReason: null',
        '  confidence: medium',
        '  reasons: []',
      ].join('\n'),
    );

    const { report } = await cleanupStale(cwd);
    // The broken record is dropped; only "ok" is reported.
    expect(report.totalCandidates).toBe(1);
    expect(report.candidates[0]?.slug).toBe('ok');
  });

  it('returns an empty report when the records directory does not exist', async () => {
    // The readdir call at decisions.ts:77 uses .catch(() => []),
    // so a missing dir is silently treated as zero records. Pin
    // that behaviour — the function should NOT throw, the report
    // should be empty, and the JSON file should still be written
    // (so downstream tooling can rely on its presence). We test
    // by pointing config.paths.recordsDir at a path that doesn't
    // exist, rather than rm-ing the records dir after beforeEach
    // created the config (which would also remove the config).
    const noRecordsConfig = {
      site: { name: 'test', tagline: 'test' },
      paths: {
        recordsDir: 'data/does-not-exist',
        generatedDir: 'data/generated',
        health: 'data/health.yml',
        decisions: 'data/decisions.yml',
      },
      blueprint: 'project-directory' as const,
      nav: [],
      theme: {},
      integrations: {},
    } as unknown as GroveConfig;
    const { report, path } = await cleanupStale(cwd, noRecordsConfig);
    expect(report.totalCandidates).toBe(0);
    expect(report.candidates).toEqual([]);
    // The file should still exist for downstream consumers.
    const written = JSON.parse(await readFile(path, 'utf8')) as { totalCandidates: number };
    expect(written.totalCandidates).toBe(0);
  });
});
