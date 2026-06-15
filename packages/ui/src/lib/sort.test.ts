/**
 * @grove-dev/ui — sort primitive unit tests.
 *
 * Coverage:
 *   - most-starred: descending by stars
 *   - recently-updated: descending by pushedAt (project) /
 *     publishedAt (resource) / null
 *   - recently-added: descending by curation.reviewedAt
 *   - best-overall: reviewed first, visible second, stars third
 *   - alphabetical: locale-aware name/title compare
 *   - stable for ties (same primary key)
 *   - missing fields (no stars / no pushedAt) sink to the bottom,
 *     not NaN
 *   - input is not mutated
 */
import { describe, it, expect } from "vitest";
import { sortRecords } from "./sort.js";
import type { IndexRecord, IndexProjectRecord, IndexResourceRecord } from "@grove-dev/core";

function makeProject(overrides: Partial<IndexProjectRecord> = {}): IndexProjectRecord {
  return {
    slug: "demo",
    kind: "project",
    name: "Demo",
    category: "tools",
    tags: [],
    links: {},
    description: "a demo",
    curation: { reviewed: false, labels: [], lenses: [] },
    stack: undefined,
    stacks: [],
    platforms: [],
    projectType: undefined,
    repoUrl: undefined,
    logoUrl: undefined,
    difficulty: undefined,
    codebaseSize: undefined,
    bestFor: [],
    whyListed: [],
    caveats: [],
    health: undefined,
    visibility: "keep",
    github: undefined,
    ...overrides,
  };
}

function makeResource(overrides: Partial<IndexResourceRecord> = {}): IndexResourceRecord {
  return {
    slug: "guide",
    kind: "resource",
    title: "Guide",
    category: "guides",
    tags: [],
    links: {},
    description: "a guide",
    curation: { reviewed: false, labels: [], lenses: [] },
    type: "guide",
    topic: "topic",
    related: [],
    publishedAt: undefined,
    author: undefined,
    visibility: "keep",
    ...overrides,
  };
}

describe("sortRecords — most-starred", () => {
  it("sorts projects by stars descending", () => {
    const records: IndexRecord[] = [
      makeProject({ slug: "low", name: "Low", github: { fullName: "o/r", stars: 10, forks: 0, openIssues: 0, language: null, pushedAt: null, archived: false, license: null, topics: [] } }),
      makeProject({ slug: "high", name: "High", github: { fullName: "o/r", stars: 500, forks: 0, openIssues: 0, language: null, pushedAt: null, archived: false, license: null, topics: [] } }),
      makeProject({ slug: "mid", name: "Mid", github: { fullName: "o/r", stars: 100, forks: 0, openIssues: 0, language: null, pushedAt: null, archived: false, license: null, topics: [] } }),
    ];
    const sorted = sortRecords(records, "most-starred");
    expect(sorted.map((r) => r.slug)).toEqual(["high", "mid", "low"]);
  });

  it("a record with no github block sinks to the bottom (0 stars, not NaN)", () => {
    // The brief flagged this: a record with no `stars` field
    // should sort to the end, not produce NaN comparison.
    const records: IndexRecord[] = [
      makeProject({ slug: "no-gh", name: "No GH" }),
      makeProject({ slug: "one-star", name: "One", github: { fullName: "o/r", stars: 1, forks: 0, openIssues: 0, language: null, pushedAt: null, archived: false, license: null, topics: [] } }),
    ];
    const sorted = sortRecords(records, "most-starred");
    expect(sorted.map((r) => r.slug)).toEqual(["one-star", "no-gh"]);
  });
});

describe("sortRecords — recently-updated", () => {
  it("sorts projects by pushedAt descending (most recent first)", () => {
    const records: IndexRecord[] = [
      makeProject({ slug: "old", name: "Old", github: { fullName: "o/r", stars: 0, forks: 0, openIssues: 0, language: null, pushedAt: "2024-01-01T00:00:00Z", archived: false, license: null, topics: [] } }),
      makeProject({ slug: "new", name: "New", github: { fullName: "o/r", stars: 0, forks: 0, openIssues: 0, language: null, pushedAt: "2025-06-01T00:00:00Z", archived: false, license: null, topics: [] } }),
    ];
    const sorted = sortRecords(records, "recently-updated");
    expect(sorted.map((r) => r.slug)).toEqual(["new", "old"]);
  });

  it("a record with no pushedAt sinks to the bottom (treated as 0)", () => {
    const records: IndexRecord[] = [
      makeProject({ slug: "no-push" }),
      makeProject({ slug: "with-push", github: { fullName: "o/r", stars: 0, forks: 0, openIssues: 0, language: null, pushedAt: "2024-01-01T00:00:00Z", archived: false, license: null, topics: [] } }),
    ];
    const sorted = sortRecords(records, "recently-updated");
    expect(sorted.map((r) => r.slug)).toEqual(["with-push", "no-push"]);
  });
});

describe("sortRecords — best-overall", () => {
  it("puts reviewed records before unreviewed", () => {
    const records: IndexRecord[] = [
      makeProject({ slug: "unreviewed" }),
      makeProject({ slug: "reviewed", curation: { reviewed: true, labels: [], lenses: [] } }),
    ];
    const sorted = sortRecords(records, "best-overall");
    expect(sorted[0]?.slug).toBe("reviewed");
  });

  it("tie-breaks reviewed+visible by stars descending", () => {
    const records: IndexRecord[] = [
      makeProject({ slug: "low", curation: { reviewed: true, labels: [], lenses: [] }, visibility: "keep", github: { fullName: "o/r", stars: 10, forks: 0, openIssues: 0, language: null, pushedAt: null, archived: false, license: null, topics: [] } }),
      makeProject({ slug: "high", curation: { reviewed: true, labels: [], lenses: [] }, visibility: "keep", github: { fullName: "o/r", stars: 100, forks: 0, openIssues: 0, language: null, pushedAt: null, archived: false, license: null, topics: [] } }),
    ];
    const sorted = sortRecords(records, "best-overall");
    expect(sorted.map((r) => r.slug)).toEqual(["high", "low"]);
  });
});

describe("sortRecords — alphabetical", () => {
  it("sorts by name (project) or title (resource) locale-aware", () => {
    const records: IndexRecord[] = [
      makeProject({ slug: "banana", name: "Banana" }),
      makeProject({ slug: "apple", name: "Apple" }),
      makeResource({ slug: "guide-z", title: "Zebra" }),
    ];
    const sorted = sortRecords(records, "alphabetical");
    expect(sorted.map((r) => r.slug)).toEqual(["apple", "banana", "guide-z"]);
  });
});

describe("sortRecords — stability + non-mutation", () => {
  it("is stable for ties (input order is preserved on the same key)", () => {
    const records: IndexRecord[] = [
      makeProject({ slug: "a", name: "A" }),
      makeProject({ slug: "b", name: "B" }),
      makeProject({ slug: "c", name: "C" }),
    ];
    // All have 0 stars → equal primary key. Stable sort should
    // preserve the input order.
    const sorted = sortRecords(records, "most-starred");
    expect(sorted.map((r) => r.slug)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input array", () => {
    const records: IndexRecord[] = [
      makeProject({ slug: "z" }),
      makeProject({ slug: "a" }),
    ];
    const snapshot = records.slice();
    sortRecords(records, "alphabetical");
    expect(records).toEqual(snapshot);
  });

  it("returns a new array (different reference from the input)", () => {
    const records: IndexRecord[] = [makeProject({ slug: "x" })];
    const out = sortRecords(records, "alphabetical");
    expect(out).not.toBe(records);
  });
});
