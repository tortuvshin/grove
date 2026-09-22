/**
 * Collection file parsing — `parseCollectionFile` / `loadCollections`.
 *
 * Coverage: defaults applied, loose top-level keys kept, malformed
 * files raise `CollectionFileError` with the file and every problem,
 * missing directory → [].
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CollectionFileError, loadCollections, parseCollectionFile } from './collections-io.js';

const minimal = ['slug: top-tools', 'title: Top tools', 'description: The best tools.'].join('\n');

describe('parseCollectionFile', () => {
  it('applies defaults to a minimal file', () => {
    expect(parseCollectionFile('top-tools.yml', minimal)).toEqual({
      slug: 'top-tools',
      kind: 'curated',
      title: 'Top tools',
      description: 'The best tools.',
      query: {},
      ranking: { preset: 'curated' },
      seo: { index: true },
    });
  });

  it('keeps consumer-owned top-level keys', () => {
    const parsed = parseCollectionFile('top-tools.yml', `${minimal}\nowner: editorial-team\n`);
    expect((parsed as Record<string, unknown>).owner).toBe('editorial-team');
  });

  it('lists every failing field with its path', () => {
    const text = [
      'slug: Top_Tools',
      'title: Top tools',
      'description: x',
      'query: { minStars: "500" }',
      'ranking: { preset: popularity }',
    ].join('\n');
    try {
      parseCollectionFile('bad.yml', text);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CollectionFileError);
      const { file, problems } = err as CollectionFileError;
      expect(file).toBe('bad.yml');
      expect(problems.some((p) => p.startsWith('slug:'))).toBe(true);
      expect(problems.some((p) => p.startsWith('query.minStars:'))).toBe(true);
      expect(problems.some((p) => p.startsWith('ranking.preset:'))).toBe(true);
    }
  });

  it('rejects a file that is not a mapping', () => {
    expect(() => parseCollectionFile('list.yml', '- a\n- b\n')).toThrow(/expected a YAML mapping/);
  });

  it('reports broken YAML against the file', () => {
    expect(() => parseCollectionFile('broken.yml', 'slug: [unclosed')).toThrow(CollectionFileError);
  });
});

describe('loadCollections', () => {
  it('returns [] when data/collections does not exist', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'grove-collections-io-'));
    try {
      expect(await loadCollections(cwd)).toEqual([]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('parses every .yml file and throws on an invalid one', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'grove-collections-io-'));
    try {
      await mkdir(join(cwd, 'data', 'collections'), { recursive: true });
      await writeFile(join(cwd, 'data', 'collections', 'top-tools.yml'), minimal);
      const loaded = await loadCollections(cwd);
      expect(loaded).toHaveLength(1);
      expect(loaded[0]?.seo.index).toBe(true);

      await writeFile(join(cwd, 'data', 'collections', 'bad.yml'), 'slug: bad\n');
      await expect(loadCollections(cwd)).rejects.toThrow(/Invalid collection bad\.yml/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
