import { describe, expect, it } from "vitest";
import type { IndexRecord } from "./schema.js";
import { applySort, buildFacets, filterRecords, filtersFromSearchParams } from "./directory-search.js";
import { hrefForLens, isLensActive } from "./directory-lenses.js";

function record(
  slug: string,
  options: { labels?: string[]; lenses?: string[]; category?: string; stacks?: string[]; tags?: string[]; reviewedAt?: string } = {},
): IndexRecord {
  return {
    kind: "project",
    slug,
    name: slug,
    description: `${slug} description`,
    category: options.category ?? "tools",
    tags: options.tags ?? [],
    stack: options.stacks?.[0],
    stacks: options.stacks ?? [],
    platforms: [],
    projectType: "real-app",
    bestFor: [],
    whyListed: [],
    caveats: [],
    links: {},
    distribution: { channels: [] },
    source: { type: "manual" },
    curation: {
      reviewed: true,
      labels: options.labels ?? [],
      lenses: options.lenses ?? [],
      reviewedAt: options.reviewedAt,
    },
    visibility: "keep",
  } as unknown as IndexRecord;
}

const records = [
  record("trending", { labels: ["hot"], category: "agents", stacks: ["python"] }),
  record("new", { labels: ["new"], category: "agents", stacks: ["typescript"] }),
  record("learn", { lenses: ["good-to-learn"], category: "tools", stacks: ["python"] }),
];

describe("directory discovery state", () => {
  it("filters label-backed and curator-assigned lenses through the same canonical engine", () => {
    expect(filterRecords(records, filtersFromSearchParams(new URLSearchParams("label=hot"))).map((item) => item.slug))
      .toEqual(["trending"]);
    expect(filterRecords(records, filtersFromSearchParams(new URLSearchParams("lens=good-to-learn"))).map((item) => item.slug))
      .toEqual(["learn"]);
  });

  it("combines facets with a lens using AND across dimensions", () => {
    const filters = filtersFromSearchParams(new URLSearchParams("label=hot&category=agents&stack=python"));
    expect(filterRecords(records, filters).map((item) => item.slug)).toEqual(["trending"]);
  });

  it("keeps tags separate from category and stack facets", () => {
    const tagged = [
      record("agent-ui", { category: "interfaces", stacks: ["typescript"], tags: ["agents", "self-hosted"] }),
      record("agent-lib", { category: "agents", stacks: ["python"], tags: ["agents"] }),
    ];
    const facets = buildFacets(tagged);
    expect(facets.categories.map((facet) => facet.value)).toEqual(["agents", "interfaces"]);
    expect(facets.stacks.map((facet) => facet.value)).toEqual(["python", "typescript"]);
    expect(facets.tags).toEqual([
      { value: "agents", count: 2 },
      { value: "self-hosted", count: 1 },
    ]);
    expect(filterRecords(tagged, filtersFromSearchParams(new URLSearchParams("tag=self-hosted"))).map((item) => item.slug))
      .toEqual(["agent-ui"]);
  });

  it("recently added is a sort and never removes unlabeled records", () => {
    const dated = [
      record("older", { reviewedAt: "2026-01-01" }),
      record("newer", { reviewedAt: "2026-07-01" }),
      record("unreviewed"),
    ];
    expect(applySort(dated, "recently-added").map((item) => item.slug))
      .toEqual(["newer", "older", "unreviewed"]);
  });

  it("builds single-select lens links without dropping unrelated filters", () => {
    const current = new URLSearchParams("q=agent&category=agents&label=new&status=quiet&page=3&sort=alphabetical");
    expect(hrefForLens("hot", current, "/projects"))
      .toBe("/projects?q=agent&category=agents&sort=alphabetical&label=hot");
    expect(isLensActive("hot", new URL("https://example.com/projects?label=hot").searchParams)).toBe(true);
    expect(isLensActive("all", new URL("https://example.com/projects?category=agents").searchParams)).toBe(true);
  });
});

/**
 * License filter behavior — covers the curated-array + GitHub-fallback
 * branch in `filterRecords` and the curated-license count in
 * `buildFacets`. The branch has subtle behavior around:
 *
 *   - case (curated ids are lowercase, GitHub spdx_id is uppercase),
 *   - records with no license value at all (silently excluded),
 *   - explicit `licenses: []` (suppresses the GitHub fallback).
 */
function licensedRecord(
  slug: string,
  options: { licenses?: string[]; githubLicense?: string | null } = {},
): IndexRecord {
  const base = record(slug) as Record<string, unknown>;
  // Distinguish "curated field absent" (no key on the object) from
  // "curated explicitly empty" (key present with an empty array) —
  // the filterRecords branch behaves differently for each.
  if (options.licenses !== undefined) base.licenses = options.licenses;
  base.github = options.githubLicense === undefined
    ? undefined
    : options.githubLicense === null
      ? undefined
      : {
          fullName: `demo/${slug}`,
          stars: 0,
          forks: 0,
          openIssues: 0,
          language: null,
          pushedAt: null,
          archived: false,
          license: options.githubLicense,
          topics: [],
        };
  return base as unknown as IndexRecord;
}

describe("license filter", () => {
  it("matches records with a curated lowercase SPDX id", () => {
    const records = [
      licensedRecord("curated", { licenses: ["mit"] }),
      licensedRecord("other", { licenses: ["apache-2.0"] }),
    ];
    expect(
      filterRecords(records, filtersFromSearchParams(new URLSearchParams("license=mit"))).map((r) => r.slug),
    ).toEqual(["curated"]);
  });

  it("matches GitHub-synced uppercase SPDX id through case normalization", () => {
    const records = [licensedRecord("synced", { githubLicense: "MIT" })];
    expect(
      filterRecords(records, filtersFromSearchParams(new URLSearchParams("license=mit"))).map((r) => r.slug),
    ).toEqual(["synced"]);
  });

  it("matches either casing from a filter regardless of curated casing", () => {
    const records = [
      licensedRecord("curated", { licenses: ["mit"] }),
      licensedRecord("synced", { githubLicense: "MIT" }),
    ];
    expect(
      filterRecords(records, filtersFromSearchParams(new URLSearchParams("license=MIT"))).map((r) => r.slug).sort(),
    ).toEqual(["curated", "synced"]);
  });

  it("falls back from curated to GitHub when curated is absent", () => {
    const records = [licensedRecord("github-only", { githubLicense: "Apache-2.0" })];
    expect(
      filterRecords(records, filtersFromSearchParams(new URLSearchParams("license=apache-2.0"))).map((r) => r.slug),
    ).toEqual(["github-only"]);
  });

  it("suppresses the GitHub fallback when the curated array is explicitly empty", () => {
    const records = [licensedRecord("opted-out", { licenses: [], githubLicense: "MIT" })];
    expect(
      filterRecords(records, filtersFromSearchParams(new URLSearchParams("license=mit"))),
    ).toEqual([]);
  });

  it("excludes records with no license value at all", () => {
    const records = [licensedRecord("no-license", {})];
    expect(
      filterRecords(records, filtersFromSearchParams(new URLSearchParams("license=mit"))),
    ).toEqual([]);
  });

  it("counts facets under the curated-array key (lowercased)", () => {
    const records = [
      licensedRecord("a", { licenses: ["mit"] }),
      licensedRecord("b", { licenses: ["mit", "apache-2.0"] }),
      licensedRecord("c", { githubLicense: "MIT" }),
    ];
    const facets = buildFacets(records);
    const licenseCounts = new Map(facets.licenses.map((entry) => [entry.value, entry.count]));
    expect(licenseCounts.get("mit")).toBe(3);
    expect(licenseCounts.get("apache-2.0")).toBe(1);
  });
});
