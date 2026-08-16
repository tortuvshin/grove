import { describe, expect, it } from "vitest";
import type { IndexRecord } from "./schema.js";
import {
  activeFilterChips,
  applySort,
  buildFacets,
  filterRecords,
  filtersFromSearchParams,
  hrefForClearedFilters,
  hrefForPage,
  pagePathHref,
} from "./directory-search.js";
import { hrefForLens, isLensActive, LENSES, PRIMARY_LENSES } from "./directory-lenses.js";
import { lensDisplay } from "./directory-display.js";

function record(
  slug: string,
  options: {
    labels?: string[];
    lenses?: string[];
    category?: string;
    stack?: string;
    stacks?: string[];
    platforms?: string[];
    tags?: string[];
    reviewedAt?: string;
  } = {},
): IndexRecord {
  return {
    kind: "project",
    slug,
    name: slug,
    description: `${slug} description`,
    category: options.category ?? "tools",
    tags: options.tags ?? [],
    stack: options.stack ?? options.stacks?.[0],
    stacks: options.stacks ?? [],
    platforms: options.platforms ?? [],
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

  it("builds single-select lens links that keep refinements but reset the view", () => {
    // Refinements (q, category, stack, ...) survive a view switch; the
    // view params — lens, label, status, sort, page — are reset, because
    // the tabs now own ordering as well as filtering.
    const current = new URLSearchParams("q=agent&category=agents&label=new&status=quiet&page=3&sort=alphabetical");
    expect(hrefForLens("hot", current, "/projects"))
      .toBe("/projects?q=agent&category=agents&label=hot");
    expect(hrefForLens("all", current, "/projects"))
      .toBe("/projects?q=agent&category=agents");
    expect(isLensActive("hot", new URL("https://example.com/projects?label=hot").searchParams)).toBe(true);
    expect(isLensActive("all", new URL("https://example.com/projects?category=agents").searchParams)).toBe(true);
  });

  it("gives a sort-based lens sole ownership of the active tab", () => {
    // Regression guard: "all" ignores sort when deciding whether it is
    // active, so without the cross-check both "all" and the sort-based
    // lens would render as the current tab at the same time.
    const sp = new URL("https://example.com/projects?sort=recently-updated").searchParams;
    expect(isLensActive("recently-updated", sp)).toBe(true);
    expect(isLensActive("all", sp)).toBe(false);

    const added = new URL("https://example.com/projects?sort=recently-added").searchParams;
    expect(isLensActive("new", added)).toBe(true);
    expect(isLensActive("all", added)).toBe(false);

    // A sort with no lens behind it still leaves "all" as the view.
    const plain = new URL("https://example.com/projects?sort=alphabetical").searchParams;
    expect(isLensActive("all", plain)).toBe(true);
  });

  it("keeps every tabbed lens renderable", () => {
    for (const id of PRIMARY_LENSES) {
      expect(LENSES.some((lens) => lens.id === id)).toBe(true);
      // SmartLensTabs takes its tab text from LENS_DISPLAY, not from
      // LensDef.label — a missing entry renders the raw id.
      expect(lensDisplay(id)).not.toBe(id);
    }
  });
});

/**
 * Facet intersection counts — the `filters` option of `buildFacets`.
 * Each facet's counts must reflect every OTHER active filter (so
 * Platform counts under an active Stack filter show the intersection)
 * while ignoring the facet's own selections (so Stack counts never
 * collapse to just the selected stack). This was the audit's P0:
 * `/projects?stack=python` narrowed the results but the platform
 * counts stayed global.
 */
describe("facet intersection counts", () => {
  const fleet = [
    record("a", { stacks: ["python"], platforms: ["linux", "macos"] }),
    record("b", { stacks: ["python", "go"], platforms: ["linux"] }),
    record("c", { stacks: ["typescript"], platforms: ["linux", "web"] }),
    // Primary stack diverges from the supporting array (the
    // open-webui shape): must count as python via the union.
    record("d", { stack: "typescript", stacks: ["typescript", "python"], platforms: ["web"] }),
  ];

  it("keeps global counts when no filters are passed", () => {
    const facets = buildFacets(fleet);
    expect(new Map(facets.platforms.map((f) => [f.value, f.count]))).toEqual(
      new Map([["linux", 3], ["macos", 1], ["web", 2]]),
    );
  });

  it("scopes other facets to the active stack filter", () => {
    const filters = filtersFromSearchParams(new URLSearchParams("stack=python"));
    expect(filterRecords(fleet, filters).map((r) => r.slug).sort()).toEqual(["a", "b", "d"]);
    const facets = buildFacets(fleet, { filters });
    expect(new Map(facets.platforms.map((f) => [f.value, f.count]))).toEqual(
      new Map([["linux", 2], ["macos", 1], ["web", 1]]),
    );
  });

  it("ignores a facet's own selections when counting that facet", () => {
    const filters = filtersFromSearchParams(new URLSearchParams("stack=python"));
    const facets = buildFacets(fleet, { filters });
    // Stack counts stay unscoped by the stack filter itself so the
    // user can still see and switch to the other options.
    expect(new Map(facets.stacks.map((f) => [f.value, f.count]))).toEqual(
      new Map([["python", 3], ["typescript", 2], ["go", 1]]),
    );
  });

  it("intersects across two active dimensions", () => {
    const filters = filtersFromSearchParams(new URLSearchParams("stack=python&platform=web"));
    const facets = buildFacets(fleet, { filters });
    // Stack counts scoped by platform=web only (c, d): union counting
    // gives typescript 2 and python 1 (d's supporting stack).
    expect(new Map(facets.stacks.map((f) => [f.value, f.count]))).toEqual(
      new Map([["typescript", 2], ["python", 1]]),
    );
    // Platform counts scoped by stack=python only (a, b, d).
    expect(new Map(facets.platforms.map((f) => [f.value, f.count]))).toEqual(
      new Map([["linux", 2], ["macos", 1], ["web", 1]]),
    );
  });
});

/**
 * Facet option ordering — the `order` option of `buildFacets`.
 * Taxonomy YAML owns display order; ids that exist only in record
 * data append after the curated ids in the count-desc fallback order.
 */
describe("facet option ordering", () => {
  const fleet = [
    record("a", { stacks: ["python"], platforms: ["linux", "macos"] }),
    record("b", { stacks: ["python"], platforms: ["linux"] }),
    record("c", { stacks: ["typescript", "zig"], platforms: ["linux", "web"] }),
  ];

  it("orders known ids by taxonomy position instead of count", () => {
    const facets = buildFacets(fleet, {
      order: { stacks: ["zig", "typescript", "python"] },
    });
    expect(facets.stacks.map((f) => f.value)).toEqual(["zig", "typescript", "python"]);
  });

  it("appends data-only ids after taxonomy ids in count-desc order", () => {
    const facets = buildFacets(fleet, {
      order: { platforms: ["web"] },
    });
    // web is curated → first; linux (3) then macos (1) follow by count.
    expect(facets.platforms.map((f) => f.value)).toEqual(["web", "linux", "macos"]);
  });

  it("keeps the count-desc default when no order is provided", () => {
    const facets = buildFacets(fleet);
    expect(facets.stacks.map((f) => f.value)).toEqual(["python", "typescript", "zig"]);
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

describe("browsable URLs", () => {
  it("keeps unfiltered pages on real paths, and filtered ones on ?page", () => {
    // Pages 2..n of an unfiltered directory are prerendered documents;
    // a filtered view exists only on the client, so it stays a query.
    expect(pagePathHref("/projects", 1)).toBe("/projects/");
    expect(pagePathHref("/projects", 3)).toBe("/projects/page/3/");
    expect(hrefForPage({ stacks: ["python"] }, 3, "/projects")).toBe(
      "/projects?stack=python&page=3",
    );
    // Defaults never reach the URL.
    expect(hrefForPage({ stacks: ["python"] }, 1, "/projects")).toBe("/projects?stack=python");
  });

  it("clears every filter but the chosen sort", () => {
    expect(
      hrefForClearedFilters({ q: "agents", stacks: ["python"], sort: "most-starred" }, "/projects"),
    ).toBe("/projects?sort=most-starred");
    expect(hrefForClearedFilters({ q: "agents", stacks: ["python"] }, "/projects")).toBe(
      "/projects",
    );
  });
});

describe("active filter chips", () => {
  const taxonomy = {
    stacks: [{ id: "react-native", name: "React Native" }],
    categories: [{ id: "agents", name: "Agents" }],
  };

  it("resolves ids to taxonomy display names", () => {
    // The server rendered `Stack: react-native` while the client
    // rewrote the same chip to `Stack: React Native`. One definition.
    const [chip] = activeFilterChips({ stacks: ["react-native"] }, { taxonomy });
    expect(chip.label).toBe("Stack: React Native");
  });

  it("falls back to the raw id when the taxonomy has no entry", () => {
    const [chip] = activeFilterChips({ stacks: ["unlisted"] }, { taxonomy });
    expect(chip.label).toBe("Stack: unlisted");
  });

  it("carries the URL that removes just that filter", () => {
    const chips = activeFilterChips(
      { stacks: ["react-native"], categories: ["agents"] },
      { taxonomy, pathPrefix: "/apps" },
    );
    const stack = chips.find((chip) => chip.key === "stacks");
    expect(stack?.href).toBe("/apps?category=agents");
    const category = chips.find((chip) => chip.key === "categories");
    expect(category?.href).toBe("/apps?stack=react-native");
  });

  it("sends a removal back to page 1", () => {
    const [chip] = activeFilterChips({ stacks: ["react-native"], page: 4 }, { pathPrefix: "/apps" });
    expect(chip.href).toBe("/apps");
  });
});
