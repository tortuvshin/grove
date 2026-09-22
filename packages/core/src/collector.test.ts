import { describe, expect, it } from 'vitest';
import type { Collection, CollectionEntry } from './collections.js';
import { runCollection } from './collector.js';

const entries: CollectionEntry[] = [
  {
    slug: 'a',
    title: 'A',
    description: 'Flutter',
    url: '/a/',
    stack: 'flutter',
    stars: 1000,
    curationScore: 0.9,
    activityScore: 0.9,
    pushedAt: '2026-06-01',
  },
  {
    slug: 'b',
    title: 'B',
    description: 'Archived',
    url: '/b/',
    stack: 'react-native',
    status: 'archived',
    stars: 200,
    curationScore: 0.5,
    activityScore: 0.1,
    pushedAt: '2024-01-01',
  },
];

describe('runCollection', () => {
  it('returns ranked entries for matching collection', () => {
    const c: Collection = {
      slug: 'top',
      kind: 'curated',
      title: 'Top',
      description: 'x',
      query: { stacks: ['flutter'] },
      ranking: { preset: 'quality' },
      seo: { index: true },
    };
    const r = runCollection(c, entries);
    expect(r.entries.map((e) => e.slug)).toEqual(['a']);
    expect(r.isEmpty).toBe(false);
  });
  it('flags empty collection', () => {
    const c: Collection = {
      slug: 'empty',
      kind: 'generated',
      title: 'Empty',
      description: 'x',
      query: { stacks: ['none'] },
      ranking: { preset: 'quality' },
      seo: { index: true },
    };
    const r = runCollection(c, entries);
    expect(r.isEmpty).toBe(true);
  });
  it('flags stale collection when all entries are archived', () => {
    const c: Collection = {
      slug: 'archived',
      kind: 'generated',
      title: 'Archived',
      description: 'x',
      query: { stacks: ['react-native'] },
      ranking: { preset: 'recency' },
      seo: { index: true },
    };
    const r = runCollection(c, entries);
    expect(r.isStale).toBe(true);
  });
});

describe('runCollection — hand-picked entries', () => {
  const stream: CollectionEntry[] = [
    { slug: 'a', title: 'A', description: 'about a', url: '/x/a/', stack: 'rust', stars: 10 },
    { slug: 'b', title: 'B', description: 'about b', url: '/x/b/', stack: 'rust', stars: 300 },
    { slug: 'c', title: 'C', description: 'about c', url: '/x/c/', stack: 'go', stars: 200 },
    {
      slug: 'd',
      title: 'D',
      description: 'about d',
      url: '/x/d/',
      stack: 'go',
      status: 'archived',
    },
  ];
  const base: Collection = {
    slug: 'picks',
    kind: 'curated',
    title: 'Picks',
    description: 'picks',
    query: {},
    ranking: { preset: 'curated' },
    seo: { index: true },
  };

  it('uses only the picks when the query states no criterion', () => {
    const result = runCollection({ ...base, entries: [{ slug: 'c' }, { slug: 'a' }] }, stream);
    expect(result.entries.map((e) => e.slug)).toEqual(['c', 'a']);
  });

  it('still means "everything" for a query-less collection with no picks', () => {
    expect(runCollection(base, stream).entries).toHaveLength(4);
  });

  it('adds query matches after the picks, without duplicates', () => {
    const result = runCollection(
      { ...base, entries: [{ slug: 'c' }, { slug: 'a' }], query: { stacks: ['rust'] } },
      stream,
    );
    expect(result.entries.map((e) => e.slug)).toEqual(['c', 'a', 'b']);
  });

  it('keeps pinned picks on top, in file order, above the ranking', () => {
    const result = runCollection(
      {
        ...base,
        ranking: { preset: 'stars' },
        entries: [{ slug: 'a', pinned: true }, { slug: 'c' }],
        query: { stacks: ['rust'] },
      },
      stream,
    );
    expect(result.entries.map((e) => e.slug)).toEqual(['a', 'b', 'c']);
    expect(result.entries[0]?.pinned).toBe(true);
  });

  it('attaches the note to the picked entry only', () => {
    const result = runCollection(
      { ...base, entries: [{ slug: 'a', note: 'Best for small teams.' }, { slug: 'b' }] },
      stream,
    );
    expect(result.entries[0]?.note).toBe('Best for small teams.');
    expect(result.entries[1]?.note).toBeUndefined();
    expect(stream[0]?.note).toBeUndefined();
  });

  it('lets a pick through excludeStatuses but skips a slug missing from the stream', () => {
    const result = runCollection(
      {
        ...base,
        entries: [{ slug: 'd' }, { slug: 'ghost' }, { slug: 'd' }],
        query: { stacks: ['go'], excludeStatuses: ['archived'] },
      },
      stream,
    );
    expect(result.entries.map((e) => e.slug)).toEqual(['d', 'c']);
  });
});
