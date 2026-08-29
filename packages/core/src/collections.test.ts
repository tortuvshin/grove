import { describe, expect, it } from 'vitest';
import type { CollectionEntry } from './collections.js';
import { filterEntries, rankEntries } from './collections.js';

const entries: CollectionEntry[] = [
  {
    slug: 'a',
    title: 'A',
    description: 'Flutter',
    url: '/a/',
    stack: 'flutter',
    platform: ['android'],
    status: 'active',
    stars: 1500,
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
    platform: ['ios'],
    status: 'archived',
    stars: 200,
    curationScore: 0.5,
    activityScore: 0.1,
    pushedAt: '2024-01-01',
  },
  {
    slug: 'c',
    title: 'C',
    description: 'Finance',
    url: '/c/',
    stack: 'flutter',
    platform: ['android', 'ios'],
    status: 'active',
    stars: 50,
    curationScore: 0.7,
    activityScore: 0.9,
    pushedAt: '2025-12-01',
  },
];

describe('filterEntries', () => {
  it('filters by stack', () => {
    expect(filterEntries(entries, { stacks: ['flutter'] }).map((e) => e.slug)).toEqual(['a', 'c']);
  });
  it('filters by platform', () => {
    expect(filterEntries(entries, { platforms: ['ios'] }).map((e) => e.slug)).toEqual(['b', 'c']);
  });
  it('excludes archived', () => {
    expect(filterEntries(entries, { excludeStatuses: ['archived'] }).map((e) => e.slug)).toEqual([
      'a',
      'c',
    ]);
  });
  it('ANDs across fields', () => {
    expect(
      filterEntries(entries, {
        stacks: ['flutter'],
        platforms: ['android'],
        excludeStatuses: ['archived'],
      }).map((e) => e.slug),
    ).toEqual(['a', 'c']);
  });
  it('filters by free-text q (case-insensitive)', () => {
    const out = filterEntries(entries, { q: 'Finance' });
    expect(out.map((e) => e.slug)).toEqual(['c']);
  });
  it('filters by categories (OR within field, AND across fields)', () => {
    const e2: CollectionEntry = {
      slug: 'd',
      title: 'D',
      description: 'x',
      url: '/d/',
      categories: ['finance', 'productivity'],
    };
    const all = [...entries, e2];
    expect(filterEntries(all, { categories: ['finance'] }).map((e) => e.slug)).toContain('d');
    expect(
      filterEntries(all, { stacks: ['flutter'], categories: ['finance'] }).map((e) => e.slug),
    ).toEqual([]);
  });
});

describe('rankEntries', () => {
  it('quality: by curation × activity', () => {
    expect(rankEntries(entries, { preset: 'quality' })[0].slug).toBe('a');
  });
  it('recency: by pushedAt desc', () => {
    expect(rankEntries(entries, { preset: 'recency' })[0].slug).toBe('a');
  });
  it('stars: by stars desc', () => {
    expect(rankEntries(entries, { preset: 'stars' })[0].slug).toBe('a');
  });
  it('curated: returns unchanged', () => {
    expect(rankEntries(entries, { preset: 'curated' })).toEqual(entries);
  });
});
