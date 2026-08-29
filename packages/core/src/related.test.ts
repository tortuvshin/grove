import { describe, expect, it } from 'vitest';
import type { Collection } from './collections.js';
import { findRelated } from './related.js';

const collections: Collection[] = [
  {
    slug: 'top-flutter',
    kind: 'curated',
    title: 'Top Flutter',
    description: 'x',
    query: { stacks: ['flutter'] },
    ranking: { preset: 'quality' },
    seo: { index: true },
  },
  {
    slug: 'active-flutter',
    kind: 'curated',
    title: 'Active Flutter',
    description: 'x',
    query: { stacks: ['flutter'], excludeStatuses: ['archived'] },
    ranking: { preset: 'active' },
    seo: { index: true },
  },
  {
    slug: 'top-finance',
    kind: 'curated',
    title: 'Top Finance',
    description: 'x',
    query: { categories: ['finance'] },
    ranking: { preset: 'quality' },
    seo: { index: true },
  },
  {
    slug: 'flutter-mobile',
    kind: 'curated',
    title: 'Flutter Mobile',
    description: 'flutter for mobile',
    query: { stacks: ['flutter'] },
    ranking: { preset: 'quality' },
    seo: { index: true },
  },
];

describe('findRelated', () => {
  it('returns collections sharing query keys', () => {
    const out = findRelated(collections[0], collections, 5);
    expect(out.map((c) => c.slug)).toContain('active-flutter');
    expect(out.map((c) => c.slug)).toContain('flutter-mobile');
    expect(out.map((c) => c.slug)).not.toContain('top-flutter');
  });
  it('respects the limit and orders by overlap', () => {
    const out = findRelated(collections[0], collections, 1);
    expect(out).toHaveLength(1);
    // Both active-flutter and flutter-mobile have 1 overlapping key (stack:flutter).
    // With limit 1, the first one defined in the input array wins (stable sort).
    expect(out[0].slug).toBe('active-flutter');
  });
});
