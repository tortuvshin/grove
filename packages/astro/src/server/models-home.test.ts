/**
 * Real-module tests for `getHomePageModel` — the homepage stack/category
 * count block.
 *
 * `models.ts` transitively imports `@grove/generated/*.json` at module
 * load, so (like `directory.test.ts`) we mock those build artifacts to
 * import the actual implementation instead of re-deriving it.
 *
 * Regression coverage for the audit's "Python 3 vs 4" drift: the count
 * block used to iterate `fullItems` (every record, hidden included)
 * and count only the singular `record.stack`, while browse filtered the
 * visible index by the primary+supporting union. The fix counts the
 * visible `items` via `projectStackIds`.
 */
import { describe, expect, it, vi } from 'vitest';

function indexRecord(
  slug: string,
  options: { stack?: string; stacks?: string[]; category?: string } = {},
) {
  return {
    kind: 'project',
    slug,
    name: slug,
    description: `${slug} description`,
    category: options.category ?? 'tools',
    tags: [],
    stack: options.stack ?? options.stacks?.[0],
    stacks: options.stacks ?? [],
    platforms: ['linux'],
    projectType: 'real-app',
    bestFor: [],
    whyListed: [],
    caveats: [],
    links: {},
    distribution: { channels: [] },
    source: { type: 'manual' },
    curation: { reviewed: true, labels: [], lenses: [] },
    visibility: 'keep',
  };
}

// The generated index payload is visible-only by contract; the hidden
// record exists ONLY in the full payload. If the model ever goes back
// to counting `fullItems`, the hidden "rust" stack would reappear.
const visible = [
  indexRecord('a', { stacks: ['python'] }),
  indexRecord('b', { stacks: ['python', 'go'] }),
  indexRecord('c', { stacks: ['typescript'] }),
  // Primary diverges from supporting (the open-webui shape): must
  // count as python via the union.
  indexRecord('d', { stack: 'typescript', stacks: ['typescript', 'python'] }),
];
const hidden = { ...indexRecord('ghost', { stacks: ['rust'] }), visibility: 'hide' };

vi.mock('@grove/generated/records.full.json', () => ({
  default: { records: [...visible, hidden] },
}));
vi.mock('@grove/generated/records.index.json', () => ({ default: { records: visible } }));
vi.mock('@grove/generated/site-config.json', () => ({ default: {} }));

const { getHomePageModel } = await import('./models.js');

const site = {
  name: 'Test Directory',
  blueprintConfig: {
    id: 'project-directory',
    kind: 'project',
    routeSlug: 'projects',
    itemSlug: 'project',
    labelSingular: 'project',
    labelPlural: 'projects',
  },
};

describe('getHomePageModel stack counts', () => {
  it('counts primary AND supporting stacks via the canonical union', () => {
    const home = getHomePageModel(site as Parameters<typeof getHomePageModel>[0]);
    const counts = new Map(home.stacks.map((s) => [s.slug, s.count]));
    expect(counts.get('python')).toBe(3); // a, b, d — d only via supporting
    expect(counts.get('typescript')).toBe(2);
    expect(counts.get('go')).toBe(1); // b's supporting stack
  });

  it('excludes hidden records from homepage counts', () => {
    const home = getHomePageModel(site as Parameters<typeof getHomePageModel>[0]);
    expect(home.stacks.find((s) => s.slug === 'rust')).toBeUndefined();
    const categoryTotal = home.categories.reduce((sum, c) => sum + c.count, 0);
    expect(categoryTotal).toBe(visible.length);
  });

  it('agrees with the browse facet counts for the same records', async () => {
    const { buildFacets } = await import('@grove-dev/core');
    const facets = buildFacets(visible as Parameters<typeof buildFacets>[0]);
    const facetCounts = new Map(facets.stacks.map((f) => [f.value, f.count]));
    const home = getHomePageModel(site as Parameters<typeof getHomePageModel>[0]);
    for (const stack of home.stacks) {
      expect(facetCounts.get(stack.slug), stack.slug).toBe(stack.count);
    }
  });
});
