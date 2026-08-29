import { applySort, filterRecords, filtersFromSearchParams } from '@grove-dev/core';
import { describe, expect, it } from 'vitest';

/**
 * Regression tests for the homepage three-lens sectioning logic.
 *
 * The audit surfaced a bug where the homepage's "Trending now",
 * "Recently added", and "Established" panels all echoed the same
 * record cards because the hot and mature lists were both sliced
 * from the index-order (alphabetical) and ~95% of mature items
 * also carried the hot label.
 *
 * The fix in `getHomePageModel` is twofold:
 *   1. Sort each lens by a meaningful key (stars, then date).
 *   2. Exclude items already surfaced in the previous panels so the
 *      three sections read as distinct perspectives.
 *
 * These tests exercise the underlying primitives the model uses —
 * applying them in the same order the model does — so the recipe
 * stays covered without spinning up the full Astro model layer.
 */
function record(
  slug: string,
  options: { labels?: string[]; stars?: number; reviewedAt?: string } = {},
) {
  return {
    kind: 'project' as const,
    slug,
    name: slug,
    description: `${slug} description`,
    category: 'tools',
    tags: [],
    stack: 'python',
    stacks: ['python'],
    platforms: ['linux'],
    projectType: 'real-app',
    bestFor: [],
    whyListed: [],
    caveats: [],
    links: {},
    distribution: { channels: [] },
    source: { type: 'manual' as const },
    visibility: 'keep' as const,
    github: {
      stars: options.stars ?? 0,
      forks: 0,
      openIssues: 0,
      language: 'Python',
      pushedAt: '2026-01-01T00:00:00Z',
      archived: false,
      license: 'MIT',
      fullName: `demo/${slug}`,
      topics: [],
    },
    curation: {
      reviewed: true,
      labels: options.labels ?? [],
      lenses: [],
      reviewedAt: options.reviewedAt,
    },
  };
}

function sectionLikeModel(records: ReturnType<typeof record>[]) {
  // Mirrors the filtering, sorting, and exclusion in `getHomePageModel`.
  const projects = records.filter((r) => r.kind === 'project');
  const hot = applySort(
    filterRecords(projects, filtersFromSearchParams(new URLSearchParams('label=hot'))),
    'most-starred',
  ).slice(0, 6);
  const hotSlugs = new Set(hot.map((r) => r.slug));
  const recentlyAdded = applySort(
    projects.filter((r) => !hotSlugs.has(r.slug)),
    'recently-added',
  ).slice(0, 6);
  const recentSlugs = new Set([...hotSlugs, ...recentlyAdded.map((r) => r.slug)]);
  const established = applySort(
    filterRecords(projects, filtersFromSearchParams(new URLSearchParams('label=mature'))).filter(
      (r) => !recentSlugs.has(r.slug),
    ),
    'most-starred',
  ).slice(0, 6);
  return {
    hot: hot.map((r) => r.slug),
    recentlyAdded: recentlyAdded.map((r) => r.slug),
    established: established.map((r) => r.slug),
  };
}

describe('homepage lens sectioning', () => {
  it('sorts hot by stars desc and surfaces mature-only items distinct from hot', () => {
    const records = [
      record('alpha', { labels: ['hot', 'mature'], stars: 1000 }),
      record('bravo', { labels: ['hot', 'mature'], stars: 500 }),
      record('charlie', { labels: ['mature'], stars: 50 }),
    ];

    const sections = sectionLikeModel(records);
    expect(sections.hot).toEqual(['alpha', 'bravo']);
    // Charlie is the only mature-only item; regardless of which lens
    // he lands in, he must not also appear in the hot panel.
    expect(sections.hot).not.toContain('charlie');
    expect([...sections.recentlyAdded, ...sections.established]).toContain('charlie');
  });

  it('never repeats a record across the three lens panels', () => {
    const records = [
      record('alpha', { labels: ['hot', 'mature'], stars: 1000, reviewedAt: '2025-01-01' }),
      record('bravo', { labels: ['hot', 'mature'], stars: 500, reviewedAt: '2025-02-01' }),
      record('charlie', { labels: ['hot', 'mature'], stars: 250, reviewedAt: '2025-03-01' }),
      record('delta', { labels: ['mature'], stars: 100, reviewedAt: '2024-01-01' }),
    ];

    const sections = sectionLikeModel(records);
    const seen = new Set<string>();
    for (const panel of [sections.hot, sections.recentlyAdded, sections.established]) {
      for (const slug of panel) {
        expect(seen.has(slug)).toBe(false);
        seen.add(slug);
      }
    }
  });

  it('keeps recently-added items out of the hot panel even when they share labels', () => {
    const records = [
      record('alpha', { labels: ['hot'], stars: 100, reviewedAt: '2025-06-01' }),
      record('bravo', { labels: [], stars: 50, reviewedAt: '2026-08-01' }),
    ];

    const sections = sectionLikeModel(records);
    expect(sections.hot).toEqual(['alpha']);
    expect(sections.recentlyAdded).toEqual(['bravo']);
    expect(sections.established).toEqual([]);
  });
});
