/**
 * @grove-dev/ui — filter primitive unit tests.
 *
 * Coverage:
 *   - multi-dimension AND (across q, stacks, platforms, etc.)
 *   - within-dimension OR (e.g. stacks: ["react", "vue"] matches either)
 *   - empty filter returns the input unchanged
 *   - filter that matches nothing returns []
 *   - case-insensitive q (the haystack is lowercased)
 *   - lens (single) AND labels (multi)
 *   - hasAnyFilter / activeFilterChips
 *   - isMaintained (only projects; active or mature)
 *
 * The test fixtures use the V1 `IndexRecord` discriminated union
 * (project | resource | entity) so the type-narrowed branches in
 * filter.ts are exercised.
 */
import { describe, it, expect } from "vitest";
import { filterRecords, hasAnyFilter, activeFilterChips, isMaintained } from "./filter.js";
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
    slug: "guide-1",
    kind: "resource",
    title: "A Guide",
    category: "guides",
    tags: [],
    links: {},
    description: "a guide",
    curation: { reviewed: false, labels: [], lenses: [] },
    type: "guide",
    topic: "tutorials",
    related: [],
    publishedAt: undefined,
    author: undefined,
    visibility: "keep",
    ...overrides,
  };
}

const projects: IndexRecord[] = [
  makeProject({ slug: "react-app", name: "React App", stack: "react", stacks: ["react"], platforms: ["web"] }),
  makeProject({ slug: "vue-app", name: "Vue App", stack: "vue", stacks: ["vue"], platforms: ["web"] }),
  makeProject({ slug: "native-app", name: "Native App", stack: "react-native", stacks: ["react-native"], platforms: ["ios"] }),
  makeProject({ slug: "untagged", name: "Untagged" }),
];

describe("filterRecords — AND across dimensions, OR within a dimension", () => {
  it("empty filter returns the input unchanged", () => {
    expect(filterRecords(projects, {})).toEqual(projects);
  });

  it("stacks is OR within, AND with other dimensions", () => {
    // stacks: [react, vue] matches any of those stacks.
    const r = filterRecords(projects, { stacks: ["react", "vue"] });
    expect(r.map((p) => p.slug).sort()).toEqual(["react-app", "vue-app"]);
  });

  it("stacks AND platforms — a project must have one of the stacks AND one of the platforms", () => {
    const r = filterRecords(projects, {
      stacks: ["react", "react-native"],
      platforms: ["ios"],
    });
    expect(r.map((p) => p.slug)).toEqual(["native-app"]);
  });

  it("non-project records are excluded when a project-only dimension is set (stacks / platforms / licenses / statuses)", () => {
    const records: IndexRecord[] = [
      ...projects,
      makeResource({ slug: "guide-react" }),
    ];
    const r = filterRecords(records, { stacks: ["react"] });
    // The resource doesn't carry stacks; it must be excluded.
    expect(r.every((rec) => rec.kind === "project")).toBe(true);
    expect(r.map((p) => p.slug).sort()).toEqual(["react-app"]);
  });

  it("q is a case-insensitive substring search across name + description + category", () => {
    const r = filterRecords(projects, { q: "REACT" });
    expect(r.map((p) => p.slug).sort()).toEqual(["native-app", "react-app"]);
  });

  it("q matches against the project's repo owner (lowercased)", () => {
    const records = [
      makeProject({ slug: "gh-owned", name: "Foo", repoUrl: "https://github.com/MyOwner/repo" }),
      makeProject({ slug: "other", name: "Bar" }),
    ];
    const r = filterRecords(records, { q: "myowner" });
    expect(r.map((p) => p.slug)).toEqual(["gh-owned"]);
  });

  it("categories is exact-match (not substring)", () => {
    const records = [
      makeProject({ slug: "tools-1", category: "tools" }),
      makeProject({ slug: "toollike", category: "toollike" }),
    ];
    const r = filterRecords(records, { categories: ["tools"] });
    expect(r.map((p) => p.slug)).toEqual(["tools-1"]);
  });

  it("lens matches a record that has that lens in its curation.lenses", () => {
    const records = [
      makeProject({ slug: "good", curation: { reviewed: false, labels: [], lenses: ["good-to-learn"] } }),
      makeProject({ slug: "bad" }),
    ];
    const r = filterRecords(records, { lens: "good-to-learn" });
    expect(r.map((p) => p.slug)).toEqual(["good"]);
  });

  it("statuses filters projects by health.status (resource/entity are excluded)", () => {
    const records = [
      makeProject({ slug: "active", health: { status: "active", maturity: "mature", tier: "curated", visibility: "keep", cleanupCandidate: false, staleReason: null, confidence: "high", reasons: [] } }),
      makeProject({ slug: "stale", health: { status: "stale", maturity: "useful", tier: "listed", visibility: "keep", cleanupCandidate: true, staleReason: "no_commits_365_days", confidence: "high", reasons: [] } }),
    ];
    const r = filterRecords(records, { statuses: ["active"] });
    expect(r.map((p) => p.slug)).toEqual(["active"]);
  });

  it("licenses matches projects by github.license (not project-shaped records without github)", () => {
    const records = [
      makeProject({ slug: "mit", github: { fullName: "o/r", stars: 0, forks: 0, openIssues: 0, language: null, pushedAt: null, archived: false, license: "MIT", topics: [] } }),
      makeProject({ slug: "apache", github: { fullName: "o/r", stars: 0, forks: 0, openIssues: 0, language: null, pushedAt: null, archived: false, license: "Apache-2.0", topics: [] } }),
      makeProject({ slug: "no-gh" }),
    ];
    const r = filterRecords(records, { licenses: ["MIT"] });
    expect(r.map((p) => p.slug)).toEqual(["mit"]);
  });

  it("a filter that matches nothing returns an empty array (NOT throws, NOT the input)", () => {
    const r = filterRecords(projects, { categories: ["nonexistent"] });
    expect(r).toEqual([]);
  });
});

describe("hasAnyFilter / activeFilterChips", () => {
  it("hasAnyFilter returns false for an empty filter", () => {
    expect(hasAnyFilter({})).toBe(false);
  });

  it("hasAnyFilter returns true when any dimension is set", () => {
    expect(hasAnyFilter({ q: "x" })).toBe(true);
    expect(hasAnyFilter({ lens: "all" })).toBe(true);
    expect(hasAnyFilter({ stacks: ["react"] })).toBe(true);
  });

  it("activeFilterChips emits one chip per multi-value field", () => {
    const chips = activeFilterChips({
      stacks: ["react", "vue"],
      categories: ["tools"],
      q: "test",
    });
    const labels = chips.map((c) => c.label);
    expect(labels).toContain(`Stack: react`);
    expect(labels).toContain(`Stack: vue`);
    expect(labels).toContain(`Category: tools`);
    expect(labels).toContain(`\u201ctest\u201d`);
  });

  it("activeFilterChips collapses the stale+quiet status pair into a single chip", () => {
    // The status lens "needs-maintainer" maps to the URL
    // `?status=stale,quiet`. The chip builder keeps that as a
    // single chip rather than two. Pin the behaviour.
    const chips = activeFilterChips({ statuses: ["stale", "quiet"] });
    expect(chips).toHaveLength(1);
    expect(chips[0]?.value).toBe("stale,quiet");
  });
});

describe("isMaintained", () => {
  it("returns true for an active project", () => {
    expect(
      isMaintained(
        makeProject({ health: { status: "active", maturity: "mature", tier: "curated", visibility: "keep", cleanupCandidate: false, staleReason: null, confidence: "high", reasons: [] } }),
      ),
    ).toBe(true);
  });

  it("returns true for a mature project", () => {
    expect(
      isMaintained(
        makeProject({ health: { status: "mature", maturity: "mature", tier: "curated", visibility: "keep", cleanupCandidate: false, staleReason: null, confidence: "high", reasons: [] } }),
      ),
    ).toBe(true);
  });

  it("returns false for a stale project", () => {
    expect(
      isMaintained(
        makeProject({ health: { status: "stale", maturity: "useful", tier: "listed", visibility: "keep", cleanupCandidate: true, staleReason: "no_commits_365_days", confidence: "high", reasons: [] } }),
      ),
    ).toBe(false);
  });

  it("returns false for a non-project record (resources/entities can't be 'maintained')", () => {
    expect(isMaintained(makeResource())).toBe(false);
  });

  it("returns false for a project with no health block", () => {
    expect(isMaintained(makeProject())).toBe(false);
  });
});
