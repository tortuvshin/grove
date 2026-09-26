/**
 * @grove-dev/core — health classification unit tests.
 *
 * Pins every edge of the push-age bands `classifyHealth` reads from
 * the shared table in `health-thresholds.ts`. The cutoffs are spelled
 * out as literals here on purpose: the day someone raises the inactive
 * cutoff from 730 to 800 days, these tests break and a deliberate
 * decision is made.
 *
 * The function also has a "fabricate" path — calling it with no
 * `github` arg returns the canonical unknown health block. This
 * shape is the V1 single source of truth that `applyDecision` in
 * `build-data.ts` reuses for its no-health-block merge, so pinning
 * it here means downstream code can't drift.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyHealth } from './health.js';
import { DAY_MS, PUSH_AGE_BANDS, pushAgeBand } from './health-thresholds.js';
import type { GithubMetadata } from './schema.js';

function makeGithub(overrides: Partial<GithubMetadata> = {}): GithubMetadata {
  return {
    fullName: 'owner/repo',
    stars: 10,
    forks: 0,
    openIssues: 0,
    archived: false,
    disabled: false,
    pushedAt: null,
    updatedAt: null,
    latestReleaseAt: null,
    license: null,
    topics: [],
    language: null,
    defaultBranch: 'main',
    ...overrides,
  };
}

describe('classifyHealth — fabrication path (no GitHub metadata)', () => {
  it('returns the canonical unknown health block when no github is supplied', () => {
    // The shape is the V1 single source of truth — applyDecision in
    // build-data.ts calls classifyHealth(slug) without github to
    // fabricate a default health block. Pin every field.
    const result = classifyHealth('my-slug');
    expect(result).toEqual({
      id: 'my-slug',
      health: {
        status: 'unknown',
        maturity: 'unknown',
        tier: 'experimental',
        visibility: 'keep',
        cleanupCandidate: false,
        staleReason: null,
        confidence: 'low',
        reasons: ['No GitHub metadata available'],
      },
    });
  });

  it('the unknown block is what applyDecision fabricates — verify the visibility override path', () => {
    // Without this test, a future refactor could change the
    // unknown shape (e.g. tier: "hidden") and silently break the
    // applyDecision merge in build-data.ts. The unknown block MUST
    // have visibility: "keep" so the override is a meaningful
    // *change*, not a no-op.
    const { health } = classifyHealth('x');
    expect(health.visibility).toBe('keep');
  });
});

describe('classifyHealth — push-age bands (pushedAt)', () => {
  // Frozen clock: each edge is tested exactly, and one millisecond past it.
  const NOW = Date.parse('2026-09-26T12:00:00.000Z');
  const ago = (days: number, extraMs = 0) => new Date(NOW - days * DAY_MS - extraMs).toISOString();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const ACTIVE = 'Pushed to within the last 6 months';
  const SIX = 'No push in the last 6 months';
  const EIGHTEEN = 'No push in the last 18 months';
  const TWENTY_FOUR = 'No push in the last 24 months';
  const cases: Array<[string, string | null, string, string | null, string]> = [
    ['pushed today', ago(0), 'active', null, ACTIVE],
    ['exactly 183 days (6 months, inclusive)', ago(183), 'active', null, ACTIVE],
    ['183 days + 1 ms', ago(183, 1), 'stale', 'no_push_6_months', SIX],
    ['exactly 548 days (18 months, inclusive)', ago(548), 'stale', 'no_push_6_months', SIX],
    ['548 days + 1 ms', ago(548, 1), 'needs_review', 'no_push_18_months', EIGHTEEN],
    [
      'exactly 730 days (24 months, inclusive)',
      ago(730),
      'needs_review',
      'no_push_18_months',
      EIGHTEEN,
    ],
    ['730 days + 1 ms', ago(730, 1), 'inactive', 'no_push_24_months', TWENTY_FOUR],
    ['no pushedAt at all', null, 'inactive', 'no_push_24_months', TWENTY_FOUR],
  ];

  it.each(cases)('%s → %s', (_label, pushedAt, status, staleReason, reason) => {
    const { health } = classifyHealth('a', makeGithub({ pushedAt }));
    expect(health.status).toBe(status);
    expect(health.staleReason).toBe(staleReason);
    expect(health.reasons[0]).toBe(reason);
  });

  it('reads the same cutoffs as the shared table', () => {
    expect(PUSH_AGE_BANDS.map((band) => [band.id, band.maxDays, band.staleReason])).toEqual([
      ['active', 183, null],
      ['stale', 548, 'no_push_6_months'],
      ['needs_review', 730, 'no_push_18_months'],
      ['inactive', Number.POSITIVE_INFINITY, 'no_push_24_months'],
    ]);
  });

  it('never calls push activity "commits"', () => {
    for (const days of [0, 200, 600, 800]) {
      const { health } = classifyHealth('a', makeGithub({ pushedAt: ago(days) }));
      expect(health.reasons.join(' ')).not.toMatch(/commit/i);
      expect(health.staleReason ?? '').not.toMatch(/commit/);
    }
  });

  it('every band past active is a cleanup candidate; active is not', () => {
    const at = (days: number) =>
      classifyHealth('a', makeGithub({ pushedAt: ago(days) })).health.cleanupCandidate;
    expect(at(10)).toBe(false);
    expect([at(200), at(600), at(800)]).toEqual([true, true, true]);
  });

  it('archived is a fact that wins over any push age', () => {
    const { health } = classifyHealth('a', makeGithub({ archived: true, pushedAt: ago(1) }));
    expect(health.status).toBe('archived');
    expect(health.staleReason).toBe('github_archived');
  });
});

describe('pushAgeBand', () => {
  it('maps a missing date (Infinity) and NaN to inactive', () => {
    expect(pushAgeBand(Number.POSITIVE_INFINITY).id).toBe('inactive');
    expect(pushAgeBand(Number.NaN).id).toBe('inactive');
  });
});

describe('classifyHealth — maturity ladder', () => {
  it("archived overrides everything: status='archived', tier='hidden'", () => {
    const result = classifyHealth('a', makeGithub({ archived: true, stars: 5000 }));
    expect(result.health.status).toBe('archived');
    expect(result.health.tier).toBe('hidden');
    expect(result.health.cleanupCandidate).toBe(true);
    expect(result.health.staleReason).toBe('github_archived');
  });

  it("popular + active → maturity='mature' and status gets promoted to 'mature'", () => {
    // 500+ stars AND active + maintained → the function promotes
    // status from 'active' to 'mature'. This is the threshold
    // where the "Recently active" filter would no longer match a
    // project even though it's actively maintained — pin it.
    const result = classifyHealth(
      'a',
      makeGithub({
        stars: 600,
        pushedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
        license: 'MIT',
      }),
    );
    expect(result.health.maturity).toBe('mature');
    expect(result.health.status).toBe('mature');
  });

  it("popular but no maintenance signals → maturity='useful' (NOT mature)", () => {
    // 500+ stars but no recent release/license — popular but the
    // maintenance boost does not apply. Maturity caps at 'useful'.
    const result = classifyHealth(
      'a',
      makeGithub({
        stars: 600,
        pushedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
        license: null,
        latestReleaseAt: null,
      }),
    );
    expect(result.health.maturity).toBe('useful');
  });

  it("mid stars (50-499) + maintained → 'useful'", () => {
    const result = classifyHealth(
      'a',
      makeGithub({
        stars: 100,
        pushedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
        license: 'MIT',
      }),
    );
    expect(result.health.maturity).toBe('useful');
  });

  it("low stars and no signals → 'experimental'", () => {
    const result = classifyHealth(
      'a',
      makeGithub({
        stars: 5,
        pushedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
        license: null,
        latestReleaseAt: null,
      }),
    );
    expect(result.health.maturity).toBe('experimental');
  });
});

describe('classifyHealth — tier ladder', () => {
  const pushed = new Date(Date.now() - 30 * 86_400_000).toISOString();

  it('hidden when status is archived', () => {
    const r = classifyHealth('a', makeGithub({ archived: true }));
    expect(r.health.tier).toBe('hidden');
    expect(r.health.visibility).toBe('hide');
  });

  it('hidden when status is inactive', () => {
    const r = classifyHealth(
      'a',
      makeGithub({ pushedAt: new Date(Date.now() - 800 * 86_400_000).toISOString() }),
    );
    expect(r.health.tier).toBe('hidden');
  });

  it('curated when stars >= 500', () => {
    const r = classifyHealth('a', makeGithub({ stars: 500, pushedAt: pushed }));
    expect(r.health.tier).toBe('curated');
  });

  it('listed when stars >= 50 (but < 500)', () => {
    const r = classifyHealth('a', makeGithub({ stars: 50, pushedAt: pushed }));
    expect(r.health.tier).toBe('listed');
  });

  it('experimental when stars < 50', () => {
    const r = classifyHealth('a', makeGithub({ stars: 49, pushedAt: pushed }));
    expect(r.health.tier).toBe('experimental');
  });
});
