/**
 * Real-module tests for `getRecordDetailModel`'s pre-formatted date
 * fields (`firstCommitYear`, `lastFetchedLabel`, `reviewedAtLabel`).
 *
 * The audit found the sidebar template doing its own `new Date(...)`
 * business logic — this covers the server-side formatting that
 * replaced it, following the same real-module + mocked-generated-JSON
 * pattern as `models-home.test.ts`.
 */
import { describe, expect, it, vi } from 'vitest';

function projectRecord() {
  return {
    kind: 'project',
    slug: 'demo',
    name: 'demo',
    description: 'demo description',
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
    source: { type: 'manual' },
    visibility: 'keep',
    github: {
      repository: {
        full_name: 'demo/demo',
        stargazers_count: 10,
        forks_count: 2,
        pushed_at: '2026-01-15T00:00:00Z',
        created_at: '2019-03-02T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
        archived: false,
      },
    },
    curation: {
      reviewed: true,
      labels: [],
      lenses: [],
      reviewedAt: '2025-06-10T00:00:00Z',
    },
  };
}

function projectRecordWithoutDates() {
  const record = projectRecord();
  return {
    ...record,
    slug: 'no-dates',
    github: { repository: { full_name: 'demo/no-dates' } },
    curation: { reviewed: true, labels: [], lenses: [] },
  };
}

function projectRecordWithSeoOverride() {
  const record = projectRecord();
  return {
    ...record,
    slug: 'with-seo',
    seo: { title: 'A hand-written title', description: 'A hand-written description.' },
  };
}

function projectRecordWithChannels() {
  const record = projectRecord();
  return {
    ...record,
    slug: 'with-channels',
    repoUrl: 'https://github.com/demo-user/with-channels',
    links: { website: 'https://with-channels.example' },
    tags: ['backup'],
    distribution: {
      channels: [
        { type: 'fdroid', url: 'https://f-droid.org/packages/demo/', verified: true },
        { type: 'play-store', url: 'https://play.google.com/store/apps/details?id=demo' },
      ],
    },
    github: {
      repository: {
        ...record.github.repository,
        full_name: 'demo-user/with-channels',
        language: 'Dart',
        license: { spdx_id: 'MIT' },
        owner: { login: 'demo-user', type: 'User', html_url: 'https://github.com/demo-user' },
      },
    },
  };
}

const records = [
  projectRecord(),
  projectRecordWithoutDates(),
  projectRecordWithSeoOverride(),
  projectRecordWithChannels(),
];

vi.mock('@grove/generated/records.full.json', () => ({ default: { records } }));
vi.mock('@grove/generated/records.index.json', () => ({ default: { records: [] } }));
vi.mock('@grove/generated/site-config.json', () => ({ default: {} }));

const { getRecordDetailModel } = await import('./models.js');

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

describe('getRecordDetailModel date fields', () => {
  it('formats firstCommitYear, lastFetchedLabel, and reviewedAtLabel from the raw ISO fields', () => {
    const detail = getRecordDetailModel('demo', site as Parameters<typeof getRecordDetailModel>[1]);
    expect(detail).not.toBeNull();
    expect(detail!.firstCommitYear).toBe(new Date('2019-03-02T00:00:00Z').getUTCFullYear());
    expect(detail!.lastFetchedLabel).toBe(new Date('2026-02-01T00:00:00Z').toLocaleDateString());
    expect(detail!.reviewedAtLabel).toBe(new Date('2025-06-10T00:00:00Z').toLocaleDateString());
  });

  it('returns null for each field when the source data is missing', () => {
    const detail = getRecordDetailModel(
      'no-dates',
      site as Parameters<typeof getRecordDetailModel>[1],
    );
    expect(detail).not.toBeNull();
    expect(detail!.firstCommitYear).toBeNull();
    expect(detail!.lastFetchedLabel).toBeNull();
    expect(detail!.reviewedAtLabel).toBeNull();
  });
});

describe('getRecordDetailModel seo override', () => {
  it('uses record.seo.title verbatim instead of the computed descriptor', () => {
    const detail = getRecordDetailModel(
      'with-seo',
      site as Parameters<typeof getRecordDetailModel>[1],
    );
    expect(detail).not.toBeNull();
    expect(detail!.seo.title).toBe('A hand-written title');
  });

  it('uses record.seo.description over the curated summary and GitHub description', () => {
    const detail = getRecordDetailModel(
      'with-seo',
      site as Parameters<typeof getRecordDetailModel>[1],
    );
    expect(detail).not.toBeNull();
    expect(detail!.seo.description).toBe('A hand-written description.');
  });

  it('falls back to the computed title/description when no override is set', () => {
    const detail = getRecordDetailModel('demo', site as Parameters<typeof getRecordDetailModel>[1]);
    expect(detail).not.toBeNull();
    expect(detail!.seo.title).not.toBe('A hand-written title');
    expect(detail!.seo.title).toContain('demo');
  });
});

describe('getRecordDetailModel JSON-LD', () => {
  it('emits a SoftwareApplication node with verified fields only', async () => {
    const { SOFTWARE_APPLICATION_FIELDS } = await import('@grove-dev/core');
    const detail = getRecordDetailModel(
      'with-channels',
      site as Parameters<typeof getRecordDetailModel>[1],
    );
    const node = detail!.seo.jsonLd![0] as Record<string, unknown>;
    expect(node['@type']).toEqual(['SoftwareApplication', 'SoftwareSourceCode']);
    expect(node.codeRepository).toBe('https://github.com/demo-user/with-channels');
    expect(node.sameAs).toEqual([
      'https://github.com/demo-user/with-channels',
      'https://with-channels.example',
    ]);
    expect(node.license).toBe('https://spdx.org/licenses/MIT.html');
    // Only the channel a curator marked verified.
    expect(node.downloadUrl).toBe('https://f-droid.org/packages/demo/');
    expect(node.author).toEqual({
      '@type': 'Person',
      name: 'demo-user',
      url: 'https://github.com/demo-user',
    });
    for (const key of Object.keys(node)) expect(SOFTWARE_APPLICATION_FIELDS).toContain(key);
  });

  it('leaves out author and license when GitHub did not report them', () => {
    const detail = getRecordDetailModel('demo', site as Parameters<typeof getRecordDetailModel>[1]);
    const node = detail!.seo.jsonLd![0] as Record<string, unknown>;
    expect(node.author).toBeUndefined();
    expect(node.license).toBeUndefined();
    expect(node.downloadUrl).toBeUndefined();
    expect(node).not.toHaveProperty('isAccessibleForFree');
    expect(node).not.toHaveProperty('interactionStatistic');
  });
});
