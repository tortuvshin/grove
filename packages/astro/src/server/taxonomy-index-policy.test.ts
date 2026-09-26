/**
 * `getTaxonomyPageModel` under `seo.taxonomyIndexPolicy`: a category or
 * stack page without intro copy renders `noindex,follow` when the site
 * asks for editorial pages only. Real module, mocked generated JSON
 * (same pattern as `models-home.test.ts`).
 */
import { describe, expect, it, vi } from 'vitest';

function indexRecord(slug: string, category: string, stack: string) {
  return {
    kind: 'project',
    slug,
    name: slug,
    description: `${slug} description`,
    category,
    tags: [],
    stack,
    stacks: [stack],
    platforms: ['linux'],
    projectType: 'real-app',
    bestFor: [],
    whyListed: [],
    caveats: [],
    links: {},
    distribution: { channels: [] },
    source: { type: 'manual' },
    curation: { reviewed: false, labels: [], lenses: [] },
    visibility: 'keep',
  };
}

const visible = [indexRecord('a', 'finance', 'flutter'), indexRecord('b', 'games', 'svelte')];

vi.mock('@grove/generated/records.full.json', () => ({ default: { records: visible } }));
vi.mock('@grove/generated/records.index.json', () => ({ default: { records: visible } }));
vi.mock('@grove/generated/site-config.json', () => ({ default: {} }));

const { getTaxonomyPageModel } = await import('./models.js');
type Site = Parameters<typeof getTaxonomyPageModel>[3];

const site = {
  name: 'Test Directory',
  blueprintConfig: { routeSlug: 'apps', labelSingular: 'app', labelPlural: 'apps' },
  taxonomy: {
    categories: [
      { id: 'finance', name: 'Finance', description: 'Budgeting apps you can self-host.' },
      { id: 'games', name: 'Games' },
      { id: 'travel', name: 'Travel' },
    ],
    stacks: [
      { id: 'flutter', name: 'Flutter', description: 'Flutter apps with real codebases.' },
      { id: 'svelte', name: 'Svelte' },
    ],
  },
} satisfies Site;
const editorial = { ...site, seo: { taxonomyIndexPolicy: 'editorial' as const } };

describe('getTaxonomyPageModel index policy', () => {
  it('sets no robots override by default', () => {
    for (const [kind, id, name] of [
      ['categories', 'games', 'Games'],
      ['stacks', 'svelte', 'Svelte'],
    ] as const) {
      const { seo } = getTaxonomyPageModel(kind, id, name, site);
      expect(seo.noindex).toBeUndefined();
      expect(seo.robots).toBeUndefined();
    }
  });

  it("'editorial' noindexes (follow) a term without a description", () => {
    expect(getTaxonomyPageModel('categories', 'games', 'Games', editorial).seo.robots).toBe(
      'noindex,follow',
    );
    expect(getTaxonomyPageModel('stacks', 'svelte', 'Svelte', editorial).seo.robots).toBe(
      'noindex,follow',
    );
  });

  it("'editorial' keeps a described term indexable", () => {
    expect(getTaxonomyPageModel('categories', 'finance', 'Finance', editorial).seo.noindex).toBe(
      undefined,
    );
    expect(getTaxonomyPageModel('stacks', 'flutter', 'Flutter', editorial).seo.noindex).toBe(
      undefined,
    );
  });

  it('leaves empty terms and licenses to the page', () => {
    expect(getTaxonomyPageModel('categories', 'travel', 'Travel', editorial).seo.robots).toBe(
      undefined,
    );
    expect(getTaxonomyPageModel('licenses', 'mit', 'MIT License', editorial).seo.robots).toBe(
      undefined,
    );
  });
});
