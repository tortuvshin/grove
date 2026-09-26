import type { Collection, CollectionEntry } from '@grove-dev/core';
import { describe, expect, it } from 'vitest';
import {
  getCollectionIndexModel,
  getCollectionPageModel,
  getCollectionTeaserModel,
  getRecordContextModel,
  recordsToCollectionEntries,
} from './collections.js';

describe('recordsToCollectionEntries', () => {
  it('maps a full record to a CollectionEntry', () => {
    const records = [
      {
        slug: 'crewai',
        name: 'CrewAI',
        description: 'Agent framework',
        stack: 'python',
        stacks: ['python'],
        platforms: ['linux', 'macos'],
        license: 'MIT',
        visibility: 'keep',
        stars: 100,
        pushedAt: '2026-01-15T00:00:00Z',
        lastCommitAt: '2026-02-01T00:00:00Z',
        category: 'agents',
        tags: ['multi-agent', 'automation'],
        scores: { curation: 0.8, activity: 0.7 },
      },
    ];
    const entries = recordsToCollectionEntries(records as never, { routeSlug: 'projects' });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      slug: 'crewai',
      title: 'CrewAI',
      description: 'Agent framework',
      url: '/projects/crewai/',
      stack: 'python',
      platform: ['linux', 'macos'],
      license: 'MIT',
      status: 'keep',
      stars: 100,
      pushedAt: '2026-01-15T00:00:00Z',
      curationScore: 0.8,
      activityScore: 0.7,
      categories: expect.arrayContaining(['agents', 'multi-agent', 'automation']),
    });
  });

  it('filters out hidden records', () => {
    const records = [
      { slug: 'a', name: 'A', visibility: 'keep' },
      { slug: 'b', name: 'B', visibility: 'hide' },
    ];
    const entries = recordsToCollectionEntries(records as never, { routeSlug: 'projects' });
    expect(entries.map((e) => e.slug)).toEqual(['a']);
  });

  it('falls back to stacks[0] when stack is missing', () => {
    const records = [{ slug: 'x', name: 'X', stacks: ['node'] }];
    const entries = recordsToCollectionEntries(records as never, { routeSlug: 'projects' });
    expect(entries[0].stack).toBe('node');
  });

  it('prefers lastCommitAt when pushedAt is missing', () => {
    const records = [{ slug: 'x', name: 'X', lastCommitAt: '2026-03-01T00:00:00Z' }];
    const entries = recordsToCollectionEntries(records as never, { routeSlug: 'projects' });
    expect(entries[0].pushedAt).toBe('2026-03-01T00:00:00Z');
  });

  it('deduplicates categories when category is also in tags', () => {
    const records = [{ slug: 'x', name: 'X', category: 'agents', tags: ['agents', 'x'] }];
    const entries = recordsToCollectionEntries(records as never, { routeSlug: 'projects' });
    expect(entries[0].categories).toEqual(['agents', 'x']);
  });

  it("defaults routeSlug to 'projects' when not provided", () => {
    const records = [{ slug: 'x', name: 'X' }];
    const entries = recordsToCollectionEntries(records as never, {});
    expect(entries[0].url).toBe('/projects/x/');
  });

  it('populates repoHref from repoUrl and homepageHref from links.website', () => {
    const records = [
      {
        slug: 'crewai',
        name: 'CrewAI',
        repoUrl: 'https://github.com/crewAIInc/crewAI',
        links: { github: 'https://github.com/other/repo', website: 'https://crewai.com' },
      },
    ];
    const entries = recordsToCollectionEntries(records as never, {});
    expect(entries[0].repoHref).toBe('https://github.com/crewAIInc/crewAI');
    expect(entries[0].homepageHref).toBe('https://crewai.com');
  });

  it('falls back to links.github when repoUrl is missing', () => {
    const records = [{ slug: 'x', name: 'X', links: { github: 'https://github.com/foo/bar' } }];
    const entries = recordsToCollectionEntries(records as never, {});
    expect(entries[0].repoHref).toBe('https://github.com/foo/bar');
  });
});

const collection: Collection = {
  slug: 'top-ai-agents',
  kind: 'curated',
  title: 'Top AI Agents',
  description: 'Best agent frameworks.',
  query: { stacks: ['python'] },
  ranking: { preset: 'quality' },
  seo: { index: true },
  editorial: { selectionNote: 'Ranked by activity and curation.' },
};

const otherCollection: Collection = {
  slug: 'top-tools',
  kind: 'curated',
  title: 'Top Tools',
  description: 'All tools.',
  query: { stacks: ['python'] },
  ranking: { preset: 'recency' },
  seo: { index: true },
};

const emptyCollection: Collection = {
  slug: 'no-matches',
  kind: 'curated',
  title: 'No Matches',
  description: "Won't match anything.",
  query: { stacks: ['rust'] },
  ranking: { preset: 'recency' },
  seo: { index: true },
};

const entries: CollectionEntry[] = [
  {
    slug: 'crewai',
    title: 'CrewAI',
    description: 'Agent framework',
    url: '/projects/crewai/',
    stack: 'python',
    curationScore: 0.9,
    activityScore: 0.8,
  },
  {
    slug: 'dify',
    title: 'Dify',
    description: 'LLM platform',
    url: '/projects/dify/',
    stack: 'python',
    curationScore: 0.7,
    activityScore: 0.6,
  },
  {
    slug: 'flowise',
    title: 'Flowise',
    description: 'Node tool',
    url: '/projects/flowise/',
    stack: 'node',
    curationScore: 0.5,
    activityScore: 0.4,
  },
];

describe('getCollectionPageModel', () => {
  it('returns ranked entries filtered by query', () => {
    const model = getCollectionPageModel(collection, entries, [collection, otherCollection]);
    expect(model.total).toBe(2);
    expect(model.isEmpty).toBe(false);
    expect(model.entries.map((e) => e.slug)).toEqual(['crewai', 'dify']);
  });

  it('exposes editorial selection note', () => {
    const model = getCollectionPageModel(collection, entries, [collection]);
    expect(model.collection.selectionNote).toBe('Ranked by activity and curation.');
  });

  it('returns related collections (max 4)', () => {
    const model = getCollectionPageModel(collection, entries, [collection, otherCollection]);
    expect(model.related).toHaveLength(1);
    expect(model.related[0].slug).toBe('top-tools');
  });

  it('reports empty when no entries match, and keeps the empty page out of the index', () => {
    const model = getCollectionPageModel(emptyCollection, entries, [collection, otherCollection]);
    expect(model.isEmpty).toBe(true);
    expect(model.seo.noindex).toBe(true);
  });

  it('describes a hand-picked entry with its note and reports the full list size', () => {
    const picked: Collection = {
      ...collection,
      query: {},
      entries: [{ slug: 'dify', note: 'Pick it for the workflow editor.', pinned: true }],
    };
    const model = getCollectionPageModel(picked, entries, [picked], {
      siteUrl: 'https://example.com',
    });
    expect(model.entries.map((e) => e.slug)).toEqual(['dify']);
    expect(model.entries[0]?.note).toBe('Pick it for the workflow editor.');
    const list = (model.jsonLd as Array<Record<string, unknown>>).find(
      (node) => node['@type'] === 'ItemList',
    ) as { numberOfItems: number; itemListElement: Array<{ description?: string }> };
    expect(list.numberOfItems).toBe(1);
    expect(list.itemListElement[0]?.description).toBe('Pick it for the workflow editor.');
  });

  it('exposes faq, review date and body path, and emits FAQPage only when there are questions', () => {
    const withFaq: Collection = {
      ...collection,
      content: './content/collections/top.md',
      editorial: { ...collection.editorial, lastReviewedAt: '2026-09-01' },
      faq: [{ q: 'Is it free?', a: 'Yes.' }],
    };
    const model = getCollectionPageModel(withFaq, entries, [withFaq], {
      siteUrl: 'https://example.com',
    });
    expect(model.faq).toEqual([{ q: 'Is it free?', a: 'Yes.' }]);
    expect(model.collection.lastReviewedAt).toBe('2026-09-01');
    expect(model.collection.content).toBe('./content/collections/top.md');
    const types = (model.jsonLd as Array<Record<string, unknown>>).map((node) => node['@type']);
    expect(types).toContain('FAQPage');

    const plain = getCollectionPageModel(collection, entries, [collection]);
    expect(plain.faq).toEqual([]);
    expect(
      (plain.jsonLd as Array<Record<string, unknown>>).map((node) => node['@type']),
    ).not.toContain('FAQPage');
  });
});

describe('getCollectionPageModel index policy', () => {
  const editorialSite = { seo: { collectionIndexPolicy: 'editorial' as const } };

  it("indexes a non-empty collection by default and under 'all'", () => {
    for (const site of [undefined, { seo: { collectionIndexPolicy: 'all' as const } }]) {
      const model = getCollectionPageModel(collection, entries, [collection], site);
      expect(model.seo.noindex).toBe(false);
      expect(model.seo.robots).toBeUndefined();
    }
  });

  it("'editorial' noindexes (follow) a collection without an introduction", () => {
    const model = getCollectionPageModel(collection, entries, [collection], editorialSite);
    expect(model.seo.noindex).toBe(true);
    expect(model.seo.robots).toBe('noindex,follow');
  });

  it("'editorial' keeps a collection with an introduction indexable", () => {
    const introduced: Collection = {
      ...collection,
      editorial: { ...collection.editorial, introduction: 'Why these four, and for whom.' },
    };
    const model = getCollectionPageModel(introduced, entries, [introduced], editorialSite);
    expect(model.seo.noindex).toBe(false);
  });

  it('leaves an empty collection on its own noindex rule', () => {
    const model = getCollectionPageModel(emptyCollection, entries, [collection], editorialSite);
    expect(model.seo.noindex).toBe(true);
    expect(model.seo.robots).toBeUndefined();
  });
});

describe('getCollectionIndexModel', () => {
  it('counts entries per collection', () => {
    const model = getCollectionIndexModel([collection, otherCollection], entries);
    expect(model.total).toBe(2);
    expect(model.collections).toHaveLength(2);
    const agentCol = model.collections.find((c) => c.slug === 'top-ai-agents');
    expect(agentCol?.count).toBe(2);
    expect(agentCol?.url).toBe('/collections/top-ai-agents/');
  });
});

describe('getCollectionTeaserModel', () => {
  it('respects the limit', () => {
    const model = getCollectionTeaserModel([collection, otherCollection], entries, 1);
    expect(model.collections).toHaveLength(1);
  });

  it("uses the project's route slug for entry URLs", () => {
    const model = getCollectionTeaserModel([collection], entries, 5);
    expect(model.collections[0].count).toBe(2);
  });
});

describe('getRecordContextModel', () => {
  const stream: CollectionEntry[] = [
    {
      slug: 'appflowy',
      title: 'AppFlowy',
      description: 'Docs and wikis.',
      url: '/apps/appflowy/',
      stars: 60000,
      relations: [{ type: 'alternative-to', to: 'notion' }],
    },
    {
      slug: 'affine',
      title: 'AFFiNE',
      description: 'Docs and whiteboards.',
      url: '/apps/affine/',
      stars: 40000,
      relations: [{ type: 'alternative-to', to: 'notion' }],
    },
    {
      slug: 'anytype',
      title: 'Anytype',
      description: 'Local-first notes.',
      url: '/apps/anytype/',
      stars: 5000,
      relations: [{ type: 'alternative-to', to: 'notion' }],
    },
    {
      slug: 'mattermost',
      title: 'Mattermost',
      description: 'Team chat.',
      url: '/apps/mattermost/',
      relations: [{ type: 'alternative-to', to: 'slack' }],
    },
  ];
  const base = {
    kind: 'curated' as const,
    description: 'd',
    ranking: { preset: 'curated' as const },
    seo: { index: true },
  };
  const hub: Collection = {
    ...base,
    slug: 'open-source-notion-alternatives',
    title: 'Open Source Notion Alternatives',
    subject: 'notion',
    query: { relatedTo: { type: 'alternative-to', subjects: ['notion'] } },
  };
  const chat: Collection = {
    ...base,
    slug: 'team-chat',
    title: 'Team chat',
    query: {},
    entries: [{ slug: 'mattermost' }],
  };
  const subjects = [
    { id: 'notion', name: 'Notion', url: 'https://www.notion.com' },
    { id: 'slack', name: 'Slack' },
  ];
  const input = { collections: [hub, chat], entries: stream, subjects };

  it('resolves relations against the vocabulary and links the hub', () => {
    const model = getRecordContextModel(
      {
        slug: 'appflowy',
        relations: [
          {
            type: 'alternative-to',
            to: 'notion',
            evidence: { type: 'self-described', quote: 'The open source Notion alternative' },
          },
          { type: 'alternative-to', to: 'not-in-vocabulary' },
        ],
      },
      input,
    );
    expect(model.relations).toEqual([
      {
        type: 'alternative-to',
        label: 'Alternative to',
        subject: { id: 'notion', name: 'Notion', url: 'https://www.notion.com' },
        evidence: { type: 'self-described', quote: 'The open source Notion alternative' },
        hub: {
          title: 'Open Source Notion Alternatives',
          url: '/collections/open-source-notion-alternatives/',
        },
      },
    ]);
  });

  it('lists sibling records by stars, without the record itself', () => {
    const model = getRecordContextModel(
      { slug: 'anytype', relations: [{ type: 'alternative-to', to: 'notion' }] },
      { ...input, relatedLimit: 1 },
    );
    expect(model.relatedRecords).toHaveLength(1);
    expect(model.relatedRecords[0]?.records.map((r) => r.slug)).toEqual(['appflowy']);
    expect(model.relatedRecords[0]?.hub?.url).toBe('/collections/open-source-notion-alternatives/');
  });

  it('omits the hub when no collection declares the subject, and sibling groups with nobody in them', () => {
    const model = getRecordContextModel(
      { slug: 'mattermost', relations: [{ type: 'alternative-to', to: 'slack' }] },
      input,
    );
    expect(model.relations[0]?.hub).toBeUndefined();
    expect(model.relatedRecords).toEqual([]);
  });

  it('reports the collections the record appears in, by query or by pick', () => {
    expect(
      getRecordContextModel({ slug: 'affine' }, input).collectionMembership.map((c) => c.slug),
    ).toEqual(['open-source-notion-alternatives']);
    expect(
      getRecordContextModel({ slug: 'mattermost' }, input).collectionMembership.map((c) => c.slug),
    ).toEqual(['team-chat']);
  });
});
