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
