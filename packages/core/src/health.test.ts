/**
 * @grove-dev/core — health classification unit tests.
 *
 * Pins the boundary cases around the threshold ladder in
 * `classifyHealth`. The thresholds are not a parameter — they're
 * burned into the function — so the only thing these tests can do
 * is pin them. A future PR that bumps any threshold will need to
 * update at least one test name, which is exactly the intent:
 * "the day someone raises the inactive cutoff from 730 to 800 days,
 * the build breaks at the test name so a deliberate decision is
 * made."
 *
 * The function also has a "fabricate" path — calling it with no
 * `github` arg returns the canonical unknown health block. This
 * shape is the V1 single source of truth that `applyDecision` in
 * `build-data.ts` reuses for its no-health-block merge, so pinning
 * it here means downstream code can't drift.
 */
import { describe, it, expect } from "vitest";
import { classifyHealth } from "./health.js";
import type { GithubMetadata } from "./schema.js";

function makeGithub(overrides: Partial<GithubMetadata> = {}): GithubMetadata {
  return {
    fullName: "owner/repo",
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
    defaultBranch: "main",
    ...overrides,
  };
}

describe("classifyHealth — fabrication path (no GitHub metadata)", () => {
  it("returns the canonical unknown health block when no github is supplied", () => {
    // The shape is the V1 single source of truth — applyDecision in
    // build-data.ts calls classifyHealth(slug) without github to
    // fabricate a default health block. Pin every field.
    const result = classifyHealth("my-slug");
    expect(result).toEqual({
      id: "my-slug",
      health: {
        status: "unknown",
        maturity: "unknown",
        tier: "experimental",
        visibility: "keep",
        cleanupCandidate: false,
        staleReason: null,
        confidence: "low",
        reasons: ["No GitHub metadata available"],
      },
    });
  });

  it("the unknown block is what applyDecision fabricates — verify the visibility override path", () => {
    // Without this test, a future refactor could change the
    // unknown shape (e.g. tier: "hidden") and silently break the
    // applyDecision merge in build-data.ts. The unknown block MUST
    // have visibility: "keep" so the override is a meaningful
    // *change*, not a no-op.
    const { health } = classifyHealth("x");
    expect(health.visibility).toBe("keep");
  });
});

describe("classifyHealth — status thresholds (pushedAt)", () => {
  const NOW = Date.now();
  const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

  it("active: pushed within 6 months (≤ 183 days)", () => {
    const result = classifyHealth("a", makeGithub({ pushedAt: daysAgo(0) }));
    expect(result.health.status).toBe("active");
  });

  it("active boundary: 180 days is well inside the active window", () => {
    // Pin the boundary just below 183 so the test is stable across
    // floating-point rounding of `Date.now() - N*86_400_000`. The
    // exact-183-day edge case is `183.0000000347` days, which the
    // `<= 183` check rejects — testing 180 instead makes the
    // intent (active window is ~6 months) obvious without
    // coupling to the float math.
    const result = classifyHealth("a", makeGithub({ pushedAt: daysAgo(180) }));
    expect(result.health.status).toBe("active");
  });

  it("stale boundary: 184 days is the first day a record becomes stale", () => {
    // 184 days is the first value that reliably falls on the
    // "stale" side of the 183-day cutoff. The 183-day mark itself
    // is load-bearing in production (a record turns 6 months old
    // on this exact day) but is sensitive to ms rounding — pin
    // 184 here so a future threshold bump is visible immediately
    // and the test does not flake.
    const result = classifyHealth("a", makeGithub({ pushedAt: daysAgo(184) }));
    expect(result.health.status).toBe("stale");
  });

  it("stale: pushed between 184 and 548 days (6-18 months)", () => {
    const result = classifyHealth("a", makeGithub({ pushedAt: daysAgo(400) }));
    expect(result.health.status).toBe("stale");
  });

  it("needs_review: pushed between 548 and 730 days (18-24 months)", () => {
    const result = classifyHealth("a", makeGithub({ pushedAt: daysAgo(600) }));
    expect(result.health.status).toBe("needs_review");
  });

  it("inactive: pushed > 730 days (2+ years)", () => {
    const result = classifyHealth("a", makeGithub({ pushedAt: daysAgo(800) }));
    expect(result.health.status).toBe("inactive");
  });
});

describe("classifyHealth — maturity ladder", () => {
  it("archived overrides everything: status='archived', tier='hidden'", () => {
    const result = classifyHealth("a", makeGithub({ archived: true, stars: 5000 }));
    expect(result.health.status).toBe("archived");
    expect(result.health.tier).toBe("hidden");
    expect(result.health.cleanupCandidate).toBe(true);
    expect(result.health.staleReason).toBe("github_archived");
  });

  it("popular + active → maturity='mature' and status gets promoted to 'mature'", () => {
    // 500+ stars AND active + maintained → the function promotes
    // status from 'active' to 'mature'. This is the threshold
    // where the "Recently active" filter would no longer match a
    // project even though it's actively maintained — pin it.
    const result = classifyHealth("a", makeGithub({
      stars: 600,
      pushedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      license: "MIT",
    }));
    expect(result.health.maturity).toBe("mature");
    expect(result.health.status).toBe("mature");
  });

  it("popular but no maintenance signals → maturity='useful' (NOT mature)", () => {
    // 500+ stars but no recent release/license — popular but the
    // maintenance boost does not apply. Maturity caps at 'useful'.
    const result = classifyHealth("a", makeGithub({
      stars: 600,
      pushedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      license: null,
      latestReleaseAt: null,
    }));
    expect(result.health.maturity).toBe("useful");
  });

  it("mid stars (50-499) + maintained → 'useful'", () => {
    const result = classifyHealth("a", makeGithub({
      stars: 100,
      pushedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      license: "MIT",
    }));
    expect(result.health.maturity).toBe("useful");
  });

  it("low stars and no signals → 'experimental'", () => {
    const result = classifyHealth("a", makeGithub({
      stars: 5,
      pushedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      license: null,
      latestReleaseAt: null,
    }));
    expect(result.health.maturity).toBe("experimental");
  });
});

describe("classifyHealth — tier ladder", () => {
  const pushed = new Date(Date.now() - 30 * 86_400_000).toISOString();

  it("hidden when status is archived", () => {
    const r = classifyHealth("a", makeGithub({ archived: true }));
    expect(r.health.tier).toBe("hidden");
    expect(r.health.visibility).toBe("hide");
  });

  it("hidden when status is inactive", () => {
    const r = classifyHealth("a", makeGithub({ pushedAt: new Date(Date.now() - 800 * 86_400_000).toISOString() }));
    expect(r.health.tier).toBe("hidden");
  });

  it("curated when stars >= 500", () => {
    const r = classifyHealth("a", makeGithub({ stars: 500, pushedAt: pushed }));
    expect(r.health.tier).toBe("curated");
  });

  it("listed when stars >= 50 (but < 500)", () => {
    const r = classifyHealth("a", makeGithub({ stars: 50, pushedAt: pushed }));
    expect(r.health.tier).toBe("listed");
  });

  it("experimental when stars < 50", () => {
    const r = classifyHealth("a", makeGithub({ stars: 49, pushedAt: pushed }));
    expect(r.health.tier).toBe("experimental");
  });
});
