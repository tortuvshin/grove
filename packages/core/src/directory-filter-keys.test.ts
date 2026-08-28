/**
 * @grove-dev/core — directory filter keys unit tests.
 *
 * The mapping table is the single source of truth for how the
 * browse-page controller, refine panel, and server view-model
 * agree on filter group keys, URL params, taxonomy kinds, and
 * display labels. Drift between these is a silent bug — a chip
 * would say "Stack" but clear the wrong URL param, for example.
 * These tests pin the table.
 */
import { describe, it, expect } from "vitest";
import {
  DIRECTORY_FILTER_KEYS,
  DIRECTORY_FILTER_LABELS,
  DIRECTORY_TAXONOMY_KINDS,
  FACET_DIMENSION_FOR_KEY,
  isDirectoryFilterGroupKey,
} from "./directory-filter-keys.js";

describe("DIRECTORY_FILTER_KEYS", () => {
  it("maps each group key to its singular URL param", () => {
    expect(DIRECTORY_FILTER_KEYS).toEqual({
      stacks: "stack",
      platforms: "platform",
      categories: "category",
      tags: "tag",
      licenses: "license",
    });
  });
});

describe("DIRECTORY_TAXONOMY_KINDS", () => {
  it("maps tags to the topics taxonomy kind (not tags)", () => {
    expect(DIRECTORY_TAXONOMY_KINDS.tags).toBe("topics");
  });

  it("leaves every other group as 1:1 with its taxonomy kind", () => {
    expect(DIRECTORY_TAXONOMY_KINDS.stacks).toBe("stacks");
    expect(DIRECTORY_TAXONOMY_KINDS.platforms).toBe("platforms");
    expect(DIRECTORY_TAXONOMY_KINDS.categories).toBe("categories");
    expect(DIRECTORY_TAXONOMY_KINDS.licenses).toBe("licenses");
  });
});

describe("DIRECTORY_FILTER_LABELS", () => {
  it("uses singular capitalized labels", () => {
    expect(DIRECTORY_FILTER_LABELS.stacks).toBe("Stack");
    expect(DIRECTORY_FILTER_LABELS.platforms).toBe("Platform");
    expect(DIRECTORY_FILTER_LABELS.categories).toBe("Category");
    expect(DIRECTORY_FILTER_LABELS.tags).toBe("Tag");
    expect(DIRECTORY_FILTER_LABELS.licenses).toBe("License");
  });
});

describe("FACET_DIMENSION_FOR_KEY (reverse map)", () => {
  it("is the inverse of DIRECTORY_FILTER_KEYS", () => {
    for (const [group, param] of Object.entries(DIRECTORY_FILTER_KEYS)) {
      expect(FACET_DIMENSION_FOR_KEY[param]).toBe(group);
    }
  });
});

describe("isDirectoryFilterGroupKey", () => {
  it("accepts known group keys", () => {
    expect(isDirectoryFilterGroupKey("stacks")).toBe(true);
    expect(isDirectoryFilterGroupKey("tags")).toBe(true);
  });

  it("rejects unknown keys", () => {
    expect(isDirectoryFilterGroupKey("stack")).toBe(false);
    expect(isDirectoryFilterGroupKey("unknown")).toBe(false);
    expect(isDirectoryFilterGroupKey("")).toBe(false);
  });
});
