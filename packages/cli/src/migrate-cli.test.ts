import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, type GroveConfig, loadNormalizedRecords } from '@grove-dev/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateMarkdownRecords } from './migrate-cli.js';

const config: GroveConfig = defineConfig({
  site: { name: 'test', tagline: 'test' },
  blueprint: 'project-directory',
});

/** YAML + pointer: the body lives in content/records/pointed.md. */
const POINTED = [
  'kind: project',
  'name: Pointed',
  'slug: pointed',
  'addedAt: 2026-08-11',
  'description: Body lives in a sidecar',
  'content: ./content/records/pointed.md',
  'category: tools',
  'repoUrl: https://github.com/owner/pointed',
  'links:',
  '  github: https://github.com/owner/pointed',
  '  website: https://pointed.example',
  'curation:',
  '  reviewed: true',
  '  reviewedBy: Curators',
  '  labels:',
  '    - mature',
  'visibility: keep',
  '',
].join('\n');
const POINTED_BODY = '# Pointed\n\nThe sidecar body, *verbatim*.\n\n---\n\nAfter a rule.\n';

/** YAML only, no body. */
const PLAIN = 'kind: project\nslug: plain\nname: Plain\ncategory: tools\naddedAt: 2026-01-02\n';

/** A record a curator decision hides. */
const DECIDED = 'kind: project\nslug: decided\nname: Decided\ncategory: tools\n';
const DECISIONS = [
  'decisions:',
  '  - id: decided',
  '    decision:',
  '      visibility: hide',
  '      reason: Out of scope',
  '',
].join('\n');

/** A record with no pointer whose slug is taken by a notes file nothing points at. */
const ORPHANED = 'kind: project\nslug: orphaned\nname: Orphaned\ncategory: tools\n';
const ORPHAN_BODY = 'Notes that no record points at.\n';

describe('migrateMarkdownRecords', () => {
  let cwd: string;
  const records = () => join(cwd, 'data', 'records');
  const bodies = () => join(cwd, 'content', 'records');
  const normalized = async () => {
    const { records: out, issues } = await loadNormalizedRecords(config, cwd);
    return {
      issues,
      records: out.map(({ slug, record, base, body, visibility }) => ({
        slug,
        record,
        base,
        body,
        visibility,
      })),
    };
  };

  beforeEach(async () => {
    vi.stubEnv('GITHUB_TOKEN', '');
    cwd = await mkdtemp(join(tmpdir(), 'grove-migrate-md-'));
    await mkdir(records(), { recursive: true });
    await mkdir(bodies(), { recursive: true });
    await writeFile(join(records(), 'pointed.yml'), POINTED);
    await writeFile(join(bodies(), 'pointed.md'), POINTED_BODY);
    await writeFile(join(records(), 'plain.yml'), PLAIN);
    await writeFile(join(records(), 'decided.yml'), DECIDED);
    await writeFile(join(cwd, 'data', 'decisions.yml'), DECISIONS);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(cwd, { recursive: true, force: true });
  });

  it('reports without writing in check mode', async () => {
    const run = await migrateMarkdownRecords({ cwd, config, write: false });
    expect(run.migrated.map((m) => [m.slug, m.to, m.body, m.dropped])).toEqual([
      ['decided', join('content', 'records', 'decided.md'), false, ['slug', 'kind']],
      ['plain', join('content', 'records', 'plain.md'), false, ['slug', 'kind']],
      ['pointed', join('content', 'records', 'pointed.md'), true, ['content', 'slug', 'kind']],
    ]);
    expect(run.refused).toEqual([]);
    expect((await readdir(records())).sort()).toEqual(['decided.yml', 'plain.yml', 'pointed.yml']);
    expect(await readFile(join(bodies(), 'pointed.md'), 'utf8')).toBe(POINTED_BODY);
  });

  it('writes one Markdown file per record that normalizes identically', async () => {
    const before = await normalized();
    expect(before.issues).toEqual([]);

    await migrateMarkdownRecords({ cwd, config, write: true });

    expect(await readdir(records())).toEqual([]);
    expect((await readdir(bodies())).sort()).toEqual(['decided.md', 'plain.md', 'pointed.md']);
    const after = await normalized();
    expect(after.issues).toEqual([]);
    expect(after.records).toEqual(before.records);
    // The decision still hides the record; decisions.yml is not touched.
    expect(after.records.find((r) => r.slug === 'decided')?.visibility).toBe('hide');
    expect(await readFile(join(cwd, 'data', 'decisions.yml'), 'utf8')).toBe(DECISIONS);
  });

  it('keeps the body byte-for-byte after the frontmatter', async () => {
    await migrateMarkdownRecords({ cwd, config, write: true });
    const pointed = await readFile(join(bodies(), 'pointed.md'), 'utf8');
    expect(pointed.endsWith(`\n---\n${POINTED_BODY}`)).toBe(true);
    expect(
      pointed.startsWith('---\nname: Pointed\nrepoUrl: https://github.com/owner/pointed\n'),
    ).toBe(true);
    expect(pointed).not.toContain('content:');
    expect(await readFile(join(bodies(), 'plain.md'), 'utf8')).toBe(
      '---\nname: Plain\ncategory: tools\naddedAt: 2026-01-02\n---\n',
    );
  });

  it('has nothing left to do on a second run', async () => {
    await migrateMarkdownRecords({ cwd, config, write: true });
    const files = await Promise.all(
      ['decided.md', 'plain.md', 'pointed.md'].map((f) => readFile(join(bodies(), f), 'utf8')),
    );
    const again = await migrateMarkdownRecords({ cwd, config, write: true });
    expect(again).toEqual({ migrated: [], refused: [] });
    expect(
      await Promise.all(
        ['decided.md', 'plain.md', 'pointed.md'].map((f) => readFile(join(bodies(), f), 'utf8')),
      ),
    ).toEqual(files);
  });

  it('leaves a notes file nothing points at, and its namesake record, untouched', async () => {
    await writeFile(join(records(), 'orphaned.yml'), ORPHANED);
    await writeFile(join(bodies(), 'orphaned.md'), ORPHAN_BODY);
    const before = await normalized();

    const run = await migrateMarkdownRecords({ cwd, config, write: true });

    expect(run.refused).toEqual([
      {
        slug: 'orphaned',
        file: join('data', 'records', 'orphaned.yml'),
        reason: `${join('content', 'records', 'orphaned.md')} already exists and is not this record's body`,
      },
    ]);
    expect(await readFile(join(records(), 'orphaned.yml'), 'utf8')).toBe(ORPHANED);
    expect(await readFile(join(bodies(), 'orphaned.md'), 'utf8')).toBe(ORPHAN_BODY);
    // The loader still ignores the notes file: the YAML record reads as before.
    const after = await normalized();
    expect(after.issues).toEqual([]);
    expect(after.records).toEqual(before.records);
  });

  it('refuses a body stored under another name or with frontmatter of its own', async () => {
    await writeFile(
      join(records(), 'pointed.yml'),
      POINTED.replace('content/records/pointed.md', 'content/records/Pointed-Notes.md'),
    );
    await writeFile(join(bodies(), 'Pointed-Notes.md'), POINTED_BODY);
    await rm(join(bodies(), 'pointed.md'));
    await writeFile(
      join(records(), 'fronted.yml'),
      'name: Fronted\ncontent: ./content/records/fronted.md\n',
    );
    await writeFile(join(bodies(), 'fronted.md'), '---\ntitle: Old\n---\nBody\n');

    const run = await migrateMarkdownRecords({ cwd, config, write: true });

    expect(run.refused.map((r) => [r.slug, r.reason])).toEqual([
      [
        'fronted',
        `${join('content', 'records', 'fronted.md')} already has frontmatter; merge it by hand`,
      ],
      [
        'pointed',
        `its body is ${join('content', 'records', 'Pointed-Notes.md')}, not ${join('content', 'records', 'pointed.md')}; move the body there first`,
      ],
    ]);
    expect((await readdir(records())).sort()).toEqual(['fronted.yml', 'pointed.yml']);
    expect(await readFile(join(bodies(), 'Pointed-Notes.md'), 'utf8')).toBe(POINTED_BODY);
  });
});
