/**
 * Real-module tests for `getRecordDetailModel`'s pre-formatted date
 * fields (`firstCommitYear`, `lastFetchedLabel`, `reviewedAtLabel`).
 *
 * The audit found the sidebar template doing its own `new Date(...)`
 * business logic — this covers the server-side formatting that
 * replaced it, following the same real-module + mocked-generated-JSON
 * pattern as `models-home.test.ts`.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const bodyDir = mkdtempSync(join(tmpdir(), 'grove-record-body-'));
const bodyPath = join(bodyDir, 'with-body.md');
writeFileSync(bodyPath, '# With body\n\nA written review of the project.\n');

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

function projectRecordWithBody(reviewed: boolean) {
  const record = projectRecord();
  return {
    ...record,
    slug: reviewed ? 'body-reviewed' : 'body-unreviewed',
    content: bodyPath,
    curation: { ...record.curation, reviewed },
  };
}

const records = [
  projectRecord(),
  projectRecordWithoutDates(),
  projectRecordWithSeoOverride(),
  projectRecordWithBody(true),
  projectRecordWithBody(false),
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

describe('getRecordDetailModel index policy', () => {
  type Site = Parameters<typeof getRecordDetailModel>[1];
  const withPolicy = (recordIndexPolicy: 'all' | 'editorial' | 'editorial-and-reviewed') =>
    ({ ...site, seo: { recordIndexPolicy } }) as Site;
  const robotsFor = (slug: string, s: Site) => {
    const { seo } = getRecordDetailModel(slug, s)!;
    return seo.noindex ? seo.robots : 'index';
  };

  it('indexes every record by default, with no robots override', () => {
    for (const slug of ['demo', 'body-reviewed', 'body-unreviewed']) {
      const { seo } = getRecordDetailModel(slug, site as Site)!;
      expect(seo.noindex).toBeUndefined();
      expect(seo.robots).toBeUndefined();
    }
  });

  it("'editorial' noindexes (follow) records without a written body", () => {
    const s = withPolicy('editorial');
    expect(robotsFor('demo', s)).toBe('noindex,follow');
    expect(robotsFor('body-unreviewed', s)).toBe('index');
    expect(robotsFor('body-reviewed', s)).toBe('index');
  });

  it("'editorial-and-reviewed' also needs curation.reviewed", () => {
    const s = withPolicy('editorial-and-reviewed');
    expect(robotsFor('demo', s)).toBe('noindex,follow');
    expect(robotsFor('body-unreviewed', s)).toBe('noindex,follow');
    expect(robotsFor('body-reviewed', s)).toBe('index');
  });
});
