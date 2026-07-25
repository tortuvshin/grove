import { describe, expect, it } from "vitest";
import { DEFAULT_BUDGET, evaluateBudget } from "./audit.js";
import type { AuditResult, PageManifestEntry } from "./audit.js";

function makeResult(overrides: Partial<AuditResult> = {}): AuditResult {
  return {
    url: "http://localhost:4321/",
    type: "home",
    profile: "mobile",
    scores: { performance: 1, accessibility: 1, bestPractices: 1, seo: 1 },
    metrics: { lcp: 1200, cls: 0.01, tbt: 50 },
    runs: 3,
    durationMs: 5000,
    ...overrides,
  };
}

const page: PageManifestEntry = { path: "/", type: "home", label: "Home" };

describe("DEFAULT_BUDGET", () => {
  it("requires 100×4 across all four categories", () => {
    expect(DEFAULT_BUDGET.scores).toEqual({
      performance: 1, accessibility: 1, bestPractices: 1, seo: 1,
    });
  });
  it("matches Web Vitals good thresholds", () => {
    expect(DEFAULT_BUDGET.metrics.lcp).toBe(1800);
    expect(DEFAULT_BUDGET.metrics.cls).toBe(0.05);
    expect(DEFAULT_BUDGET.metrics.tbt).toBe(100);
  });
});

describe("evaluateBudget", () => {
  it("returns no violations when result meets all budgets", () => {
    expect(evaluateBudget(makeResult(), page)).toEqual([]);
  });
  it("returns no violations for 404 pages", () => {
    const notFoundPage: PageManifestEntry = {
      path: "/this-page-does-not-exist/",
      type: "404",
      label: "Not found",
    };
    const result = makeResult({
      type: "404",
      scores: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 },
      metrics: { lcp: Infinity, cls: Infinity, tbt: Infinity },
    });

    expect(evaluateBudget(result, notFoundPage)).toEqual([]);
  });
  it("flags a performance score below 1", () => {
    const v = evaluateBudget(makeResult({
      scores: { performance: 0.99, accessibility: 1, bestPractices: 1, seo: 1 },
    }), page);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ category: "score", name: "performance", expected: 1, actual: 0.99 });
  });
  it("flags LCP above threshold", () => {
    const v = evaluateBudget(makeResult({ metrics: { lcp: 2500, cls: 0.01, tbt: 50 } }), page);
    expect(v[0]).toMatchObject({ category: "metric", name: "lcp", expected: 1800, actual: 2500 });
  });
  it("flags multiple violations at once", () => {
    const v = evaluateBudget(makeResult({
      scores: { performance: 0.5, accessibility: 0.5, bestPractices: 1, seo: 1 },
      metrics: { lcp: 5000, cls: 0.5, tbt: 500 },
    }), page);
    expect(v).toHaveLength(5);
  });
});
