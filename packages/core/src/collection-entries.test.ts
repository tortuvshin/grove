/**
 * `toCollectionEntries` — the one record → `CollectionEntry` projection.
 *
 * Coverage:
 *   - status comes from `health.status`, not the curation `visibility`
 *   - hidden / removed records never reach a collection
 *   - ranking scores fall back to the GitHub sync; explicit `scores` win
 *   - url, stack, licence and category fallbacks
 */
import { describe, expect, it } from 'vitest';
import { toCollectionEntries } from './collection-entries.js';
import { runCollection } from './collector.js';

const NOW = Date.parse('2026-09-01T00:00:00Z');
const opts = { routeSlug: 'apps', now: NOW };

describe('toCollectionEntries', () => {
  it('reads lifecycle status from health, so excludeStatuses has something to match', () => {
    const entries = toCollectionEntries(
      [
        { slug: 'live', visibility: 'keep', health: { status: 'active' } },
        { slug: 'gone', visibility: 'keep', health: { status: 'archived' } },
      ],
      opts,
    );
    expect(entries.map((e) => e.status)).toEqual(['active', 'archived']);

    const result = runCollection(
      {
        slug: 'c',
        kind: 'curated',
        title: 'C',
        description: 'c',
        query: { excludeStatuses: ['archived'] },
        ranking: { preset: 'curated' },
        seo: { index: true },
      },
      entries,
    );
    expect(result.entries.map((e) => e.slug)).toEqual(['live']);
  });

  it('falls back to the curation visibility when no health block is synced', () => {
    const [entry] = toCollectionEntries([{ slug: 'a', visibility: 'historical' }], opts);
    expect(entry?.status).toBe('historical');
  });

  it('drops hidden and removed records, whichever block says so', () => {
    const entries = toCollectionEntries(
      [
        { slug: 'a', visibility: 'hide' },
        { slug: 'b', visibility: 'remove' },
        { slug: 'c', visibility: 'keep', health: { visibility: 'hide' } },
        { slug: 'd', visibility: 'keep' },
        { name: 'no slug' },
      ],
      opts,
    );
    expect(entries.map((e) => e.slug)).toEqual(['d']);
  });

  it('derives ranking scores from the GitHub sync when no scores are curated', () => {
    const [fresh, quiet] = toCollectionEntries(
      [
        {
          slug: 'fresh',
          github: {
            latestReleaseAt: '2026-08-25T00:00:00Z',
            repository: { stargazers_count: 99_999, pushed_at: '2026-08-31T00:00:00Z' },
            activity: {
              monthlyCommits: [
                { month: '2026-05', commits: 10 },
                { month: '2026-06', commits: 30 },
                { month: '2026-07', commits: 30 },
                { month: '2026-08', commits: 30 },
              ],
            },
          },
        },
        {
          slug: 'quiet',
          github: { repository: { stargazers_count: 9, pushed_at: '2024-01-01T00:00:00Z' } },
        },
      ],
      opts,
    );
    expect(fresh?.stars).toBe(99_999);
    expect(fresh?.pushedAt).toBe('2026-08-31T00:00:00Z');
    expect(fresh?.curationScore).toBeCloseTo(1, 2);
    expect(fresh?.activityScore).toBeGreaterThan(0.9);
    expect(quiet?.curationScore).toBeCloseTo(0.2, 2);
    expect(quiet?.activityScore).toBe(0);
  });

  it('keeps curated scores over the derived ones', () => {
    const [entry] = toCollectionEntries(
      [
        {
          slug: 'a',
          scores: { curation: 0.5, activity: 0.25 },
          github: { repository: { stargazers_count: 50_000, pushed_at: '2026-08-31T00:00:00Z' } },
        },
      ],
      opts,
    );
    expect(entry?.curationScore).toBe(0.5);
    expect(entry?.activityScore).toBe(0.25);
  });

  it('leaves scores undefined for a record with no GitHub data at all', () => {
    const [entry] = toCollectionEntries([{ slug: 'a' }], opts);
    expect(entry?.curationScore).toBeUndefined();
    expect(entry?.activityScore).toBeUndefined();
  });

  it('builds a slashed detail url and fills stack, licence and category fallbacks', () => {
    const [entry] = toCollectionEntries(
      [
        {
          slug: 'a',
          name: 'A',
          category: 'tools',
          tags: ['tools', 'cli'],
          stacks: ['rust'],
          github: { repository: { license: { spdx_id: 'MIT' } } },
          links: { github: 'https://github.com/o/a', website: 'https://a.dev' },
        },
      ],
      opts,
    );
    expect(entry).toMatchObject({
      url: '/apps/a/',
      title: 'A',
      stack: 'rust',
      license: 'MIT',
      licenses: ['MIT'],
      categories: ['tools', 'cli'],
      repoHref: 'https://github.com/o/a',
      homepageHref: 'https://a.dev',
    });
  });
});

describe('toCollectionEntries — avatar and tags', () => {
  it('uses logoUrl first, then the GitHub owner avatar, and keeps tags', () => {
    const [withLogo, withOwner, bare] = toCollectionEntries(
      [
        { slug: 'a', logoUrl: 'https://cdn.example/a.png', repoUrl: 'https://github.com/o/a' },
        { slug: 'b', repoUrl: 'https://github.com/owner/b', tags: ['x', 'y'] },
        { slug: 'c' },
      ],
      { routeSlug: 'apps' },
    );
    expect(withLogo?.avatarUrl).toBe('https://cdn.example/a.png');
    expect(withOwner?.avatarUrl).toBe('https://avatars.githubusercontent.com/owner?v=4&s=80');
    expect(withOwner?.tags).toEqual(['x', 'y']);
    expect(bare?.avatarUrl).toBeUndefined();
  });
});
