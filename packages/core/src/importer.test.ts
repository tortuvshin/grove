/**
 * @grove-dev/core — markdown.ts importer unit tests.
 *
 * The `markdown.ts` module houses `parseAwesomeMarkdown`,
 * `detectGithubRepo`, `importAwesomeList`, and
 * `writeImportedRecords`. `importer.ts` re-exports the last two.
 *
 * Tests cover:
 *   - detectGithubRepo: URL + slug derivation, edge cases
 *   - parseAwesomeMarkdown: section grouping, link extraction,
 *     dedup, empty input
 *   - writeImportedRecords: real tmpdir round-trip
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  detectGithubRepo,
  importAwesomeList,
  parseAwesomeMarkdown,
  writeImportedRecords,
} from './markdown.js';

describe('detectGithubRepo', () => {
  it('returns the canonical GitHub URL for a github.com URL', () => {
    expect(detectGithubRepo('https://github.com/owner/repo')).toBe('https://github.com/owner/repo');
  });

  it('strips a trailing .git from the repo name', () => {
    expect(detectGithubRepo('https://github.com/owner/repo.git')).toBe(
      'https://github.com/owner/repo',
    );
  });

  it('returns undefined for an empty / non-URL string', () => {
    expect(detectGithubRepo('')).toBeUndefined();
    expect(detectGithubRepo('No link here.')).toBeUndefined();
  });

  it('returns undefined for a non-github URL (e.g. gitlab)', () => {
    expect(detectGithubRepo('https://gitlab.com/owner/repo')).toBeUndefined();
  });

  it('returns undefined for reserved GitHub paths (issues, pulls, etc.)', () => {
    // `https://github.com/owner/issues` is a tab on the repo page,
    // not a repo. detectGithubRepo must return undefined for
    // these so they don't get imported as a record.
    expect(detectGithubRepo('https://github.com/owner/issues')).toBeUndefined();
    expect(detectGithubRepo('https://github.com/owner/pulls')).toBeUndefined();
  });
});

describe('parseAwesomeMarkdown', () => {
  it('returns an empty result for empty input', () => {
    const r = parseAwesomeMarkdown('');
    expect(r.records).toEqual([]);
    expect(r.report.imported).toBe(0);
    expect(r.report.skipped).toBe(0);
  });

  it('groups links by section heading and extracts name + url', () => {
    const md = [
      '# Awesome',
      '',
      '## Tools',
      '',
      '- [Repo One](https://github.com/owner/one) - A great tool',
      '- [Repo Two](https://github.com/owner/two)',
      '',
      '## Libraries',
      '',
      '- [Repo Three](https://github.com/owner/three) - A nice library',
    ].join('\n');
    const r = parseAwesomeMarkdown(md);
    expect(r.report.imported).toBe(3);
    expect(r.records.map((rec) => rec.name)).toEqual(['Repo One', 'Repo Two', 'Repo Three']);
    // Category comes from the section heading.
    expect(r.records[0]?.category).toBe('Tools');
    expect(r.records[2]?.category).toBe('Libraries');
  });

  it('dedupes repeated names (same label slug → -2, -3, ...)', () => {
    // The parser's collision counter is NAME-based (via
    // `uniqueSlug`), not URL-based. Two lines with different
    // names both pointing at the same URL produce two records;
    // two lines with the same name produce the second with a
    // -2 suffix. Pinning the actual behaviour so a future
    // switch to URL-based dedup is visible.
    const md = [
      '## Tools',
      '',
      '- [A](https://github.com/owner/repo) - first',
      '- [A](https://github.com/owner/other) - second',
    ].join('\n');
    const r = parseAwesomeMarkdown(md);
    expect(r.report.imported).toBe(2);
    expect(r.records.map((rec) => rec.slug)).toEqual(['a', 'a-2']);
  });

  it('skips lines that are not list items (text between sections)', () => {
    const md = [
      '## Tools',
      '',
      'Some prose describing the section.',
      '',
      '- [Real](https://github.com/owner/real) - A real repo',
    ].join('\n');
    const r = parseAwesomeMarkdown(md);
    expect(r.records).toHaveLength(1);
    expect(r.records[0]?.name).toBe('Real');
  });
});

describe('writeImportedRecords — filesystem round-trip', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'grove-importer-test-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('writes one YAML file per record to the target directory', async () => {
    const result = {
      records: [
        {
          name: 'First',
          slug: 'first',
          description: 'first record',
          category: 'tools',
          links: { github: 'https://github.com/owner/first' },
        },
        {
          name: 'Second',
          slug: 'second',
          description: 'second record',
          category: 'tools',
          links: { github: 'https://github.com/owner/second' },
        },
      ],
      report: {
        imported: 2,
        skipped: 0,
        categories: [],
        duplicateSlugs: 0,
        tocSkipped: 0,
        anchorLinksSkipped: 0,
      },
    };
    const { written, dir } = await writeImportedRecords(result, cwd, 'project-directory');
    expect(written).toBe(2);
    expect(dir).toContain('data/records');

    const first = await readFile(join(dir, 'first.yml'), 'utf8');
    expect(first).toContain('name: First');
    expect(first).toContain('kind: project');
    expect(first).toContain('slug: first');
  });

  it('returns 0 and writes nothing for an empty input list', async () => {
    const result = {
      records: [],
      report: {
        imported: 0,
        skipped: 0,
        categories: [],
        duplicateSlugs: 0,
        tocSkipped: 0,
        anchorLinksSkipped: 0,
      },
    };
    const { written } = await writeImportedRecords(result, cwd, 'project-directory');
    expect(written).toBe(0);
  });
});

describe('importAwesomeList — end-to-end on a local README.md', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'grove-import-test-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('parses a local markdown file and returns ImportedRecord[]', async () => {
    const md = [
      '# Awesome Stuff',
      '',
      '## Frameworks',
      '',
      '- [Framework A](https://github.com/owner/framework-a) - A nice framework',
      '- [Framework B](https://github.com/owner/framework-b)',
    ].join('\n');
    const readme = join(cwd, 'README.md');
    await writeFile(readme, md);

    const result = await importAwesomeList(readme);
    expect(result.report.imported).toBe(2);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]?.name).toBe('Framework A');
    expect(result.records[0]?.category).toBe('Frameworks');
  });
});
