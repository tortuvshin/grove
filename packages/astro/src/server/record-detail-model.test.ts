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

const records = [projectRecord(), projectRecordWithoutDates()];

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
