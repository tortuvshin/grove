/**
 * `getTaxonomyPageModel` under `seo.taxonomyIndexPolicy`: a category or
 * stack page without intro copy renders `noindex,follow` when the site
 * asks for editorial pages only. Real module, mocked generated JSON
 * (same pattern as `models-home.test.ts`).
 */
import { describe, expect, it, vi } from 'vitest';

function indexRecord(slug: string, category: string, stack: string, license: string) {
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
    licenses: [license],
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

const visible = [
  indexRecord('a', 'finance', 'flutter', 'mit'),
  indexRecord('b', 'games', 'svelte', 'apache-2.0'),
];

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
    licenses: [
      {
        id: 'mit',
        name: 'MIT License',
        heading: 'Open Source MIT-Licensed Apps',
        description: 'Apps under the permissive MIT License.',
      },
      { id: 'apache-2.0', name: 'Apache License 2.0' },
      { id: 'gpl-3.0', name: 'GNU GPL v3.0' },
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

  it('leaves empty terms to the page', () => {
    expect(getTaxonomyPageModel('categories', 'travel', 'Travel', editorial).seo.robots).toBe(
      undefined,
    );
    expect(getTaxonomyPageModel('licenses', 'gpl-3.0', 'GNU GPL v3.0', editorial).seo.robots).toBe(
      undefined,
    );
  });

  it("applies 'editorial' to licence pages too", () => {
    expect(
      getTaxonomyPageModel('licenses', 'apache-2.0', 'Apache License 2.0', editorial).seo.robots,
    ).toBe('noindex,follow');
    expect(getTaxonomyPageModel('licenses', 'mit', 'MIT License', editorial).seo.noindex).toBe(
      undefined,
    );
  });

  it('returns the term heading and description as page copy', () => {
    const model = getTaxonomyPageModel('licenses', 'mit', 'MIT License', site);
    expect(model.heading).toBe('Open Source MIT-Licensed Apps');
    expect(model.lede).toBe('Apps under the permissive MIT License.');
    expect(model.seo.title).toContain('Open Source MIT-Licensed Apps');
    expect(model.seo.description).toBe('Apps under the permissive MIT License.');
    expect(getTaxonomyPageModel('stacks', 'svelte', 'Svelte', site).heading).toBeUndefined();
  });
});
