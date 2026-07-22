import { describe, expect, it } from "vitest";
import type { IndexRecord } from "./schema.js";
import { filterRecords, filtersFromSearchParams } from "./directory-search.js";
import { hrefForLens, isLensActive } from "./directory-lenses.js";

function record(
  slug: string,
  options: { labels?: string[]; lenses?: string[]; category?: string; stacks?: string[] } = {},
): IndexRecord {
  return {
    kind: "project",
    slug,
    name: slug,
    description: `${slug} description`,
    category: options.category ?? "tools",
    tags: [],
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

  it("builds single-select lens links without dropping unrelated filters", () => {
    const current = new URLSearchParams("q=agent&category=agents&label=new&status=quiet&page=3&sort=alphabetical");
    expect(hrefForLens("hot", current, "/projects"))
      .toBe("/projects?q=agent&category=agents&sort=alphabetical&label=hot");
    expect(isLensActive("hot", new URL("https://example.com/projects?label=hot").searchParams)).toBe(true);
    expect(isLensActive("all", new URL("https://example.com/projects?category=agents").searchParams)).toBe(true);
  });
});
