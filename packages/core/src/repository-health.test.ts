/**
 * @grove-dev/core — repository-health.ts (classifyRepositoryHealth)
 * unit tests.
 *
 * Pins the boundary cases around the day-since-push ladder, same
 * spirit as health.test.ts: a threshold change should force a
 * visible test-name update, not drift silently.
 */
import { describe, expect, it } from 'vitest';
import type { RepositoryEvidence } from './evidence.js';
import { classifyRepositoryHealth } from './repository-health.js';
import type { GithubMetadata } from './schema.js';

function makeGithub(overrides: Partial<GithubMetadata> = {}): GithubMetadata {
  return {
    fullName: 'owner/repo',
    stars: 10,
    forks: 0,
    archived: false,
    pushedAt: null,
    latestReleaseAt: null,
    license: null,
    topics: [],
    language: null,
    ...overrides,
  };
}

function makeEvidence(overrides: Partial<RepositoryEvidence> = {}): RepositoryEvidence {
  return {
    requestedUrl: 'https://github.com/owner/repo',
    status: 'ok',
    identity: { owner: 'owner', repo: 'repo' },
    canonicalUrl: 'https://github.com/owner/repo',
    redirected: false,
    source: 'api',
    github: makeGithub(),
    warnings: [],
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

const NOW = Date.now();
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

describe('classifyRepositoryHealth — non-ok evidence statuses', () => {
  it('not-found -> broken, high confidence', () => {
    const result = classifyRepositoryHealth(
      makeEvidence({ status: 'not-found', github: undefined, canonicalUrl: undefined }),
    );
    expect(result.status).toBe('broken');
    expect(result.confidence).toBe('high');
  });

  it('invalid-url -> unknown, low confidence', () => {
    const result = classifyRepositoryHealth(
      makeEvidence({ status: 'invalid-url', github: undefined, canonicalUrl: undefined }),
    );
    expect(result.status).toBe('unknown');
    expect(result.confidence).toBe('low');
  });

  it('rate-limited -> unknown, low confidence', () => {
    const result = classifyRepositoryHealth(
      makeEvidence({ status: 'rate-limited', github: undefined, canonicalUrl: undefined }),
    );
    expect(result.status).toBe('unknown');
    expect(result.confidence).toBe('low');
  });

  it('error -> unknown, low confidence, cites the error message', () => {
    const result = classifyRepositoryHealth(
      makeEvidence({
        status: 'error',
        error: 'network down',
        github: undefined,
        canonicalUrl: undefined,
      }),
    );
    expect(result.status).toBe('unknown');
    expect(result.evidence[0]).toContain('network down');
  });
});

describe('classifyRepositoryHealth — archived and partial evidence', () => {
  it('archived repo -> archived, high confidence, regardless of push recency', () => {
    const result = classifyRepositoryHealth(
      makeEvidence({ github: makeGithub({ archived: true, pushedAt: daysAgo(0) }) }),
    );
    expect(result.status).toBe('archived');
    expect(result.confidence).toBe('high');
  });

  it('html-fallback (partial) evidence -> unknown, low confidence, even if archived:false', () => {
    const result = classifyRepositoryHealth(
      makeEvidence({ source: 'html', github: makeGithub({ archived: false }) }),
    );
    expect(result.status).toBe('unknown');
    expect(result.confidence).toBe('low');
  });
});

describe('classifyRepositoryHealth — day-since-push ladder', () => {
  it('0 days -> active', () => {
    const result = classifyRepositoryHealth(
      makeEvidence({ github: makeGithub({ pushedAt: daysAgo(0) }) }),
    );
    expect(result.status).toBe('active');
  });

  it('180 days (just under the 183-day boundary) -> active', () => {
    // Pinned just below 183, not exactly at it: by the time
    // `daysSince` re-reads `Date.now()` inside the assertion, the
    // elapsed test-execution time pushes an exact `daysAgo(183)`
    // fixture a hair past 183.0 days, which the `<= 183` check
    // rejects. Same precedent as health.test.ts's boundary tests.
    const result = classifyRepositoryHealth(
      makeEvidence({ github: makeGithub({ pushedAt: daysAgo(180) }) }),
    );
    expect(result.status).toBe('active');
  });

  it('184 days -> stable', () => {
    const result = classifyRepositoryHealth(
      makeEvidence({ github: makeGithub({ pushedAt: daysAgo(184) }) }),
    );
    expect(result.status).toBe('stable');
  });

  it('545 days (just under the 548-day boundary) -> stable', () => {
    const result = classifyRepositoryHealth(
      makeEvidence({ github: makeGithub({ pushedAt: daysAgo(545) }) }),
    );
    expect(result.status).toBe('stable');
  });

  it('549 days -> likely-stale, medium confidence', () => {
    const result = classifyRepositoryHealth(
      makeEvidence({ github: makeGithub({ pushedAt: daysAgo(549) }) }),
    );
    expect(result.status).toBe('likely-stale');
    expect(result.confidence).toBe('medium');
  });

  it('725 days (just under the 730-day confidence boundary) -> likely-stale, medium confidence', () => {
    const result = classifyRepositoryHealth(
      makeEvidence({ github: makeGithub({ pushedAt: daysAgo(725) }) }),
    );
    expect(result.status).toBe('likely-stale');
    expect(result.confidence).toBe('medium');
  });

  it('731 days -> likely-stale, low confidence (never harsher, per plan rule)', () => {
    const result = classifyRepositoryHealth(
      makeEvidence({ github: makeGithub({ pushedAt: daysAgo(731) }) }),
    );
    expect(result.status).toBe('likely-stale');
    expect(result.confidence).toBe('low');
  });

  it('several years of silence is still only likely-stale, never a harsher status', () => {
    const result = classifyRepositoryHealth(
      makeEvidence({ github: makeGithub({ pushedAt: daysAgo(3650) }) }),
    );
    expect(result.status).toBe('likely-stale');
    expect(result.confidence).toBe('low');
  });
});

describe('classifyRepositoryHealth — active vs maintained split', () => {
  it('recent push + recent release -> maintained', () => {
    const result = classifyRepositoryHealth(
      makeEvidence({
        github: makeGithub({ pushedAt: daysAgo(10), latestReleaseAt: daysAgo(30), stars: 5 }),
      }),
    );
    expect(result.status).toBe('maintained');
  });

  it('recent push + no release + low stars -> active', () => {
    const result = classifyRepositoryHealth(
      makeEvidence({ github: makeGithub({ pushedAt: daysAgo(10), stars: 5 }) }),
    );
    expect(result.status).toBe('active');
  });

  it('recent push + high stars (no release) -> maintained', () => {
    const result = classifyRepositoryHealth(
      makeEvidence({ github: makeGithub({ pushedAt: daysAgo(10), stars: 10_000 }) }),
    );
    expect(result.status).toBe('maintained');
  });
});

describe('classifyRepositoryHealth — counterEvidence', () => {
  it('notes a recent release as counterEvidence for a stale-push repo', () => {
    const result = classifyRepositoryHealth(
      makeEvidence({
        github: makeGithub({ pushedAt: daysAgo(600), latestReleaseAt: daysAgo(30) }),
      }),
    );
    expect(result.status).toBe('likely-stale');
    expect(result.counterEvidence).toContain('A release was published within the last year');
  });
});
