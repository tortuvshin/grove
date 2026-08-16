import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  breadcrumbs,
  ogPath,
  recordSeoDescriptor,
  seoDescription,
  seoTitle,
  titleCaseFirst,
} from "./seo.js";

describe("seoTitle", () => {
  it("appends the site name with the pipe separator", () => {
    expect(seoTitle("Collections", "Open Apps")).toBe("Collections | Open Apps");
  });

  it("skips the suffix when the main part already names the site", () => {
    expect(seoTitle("Python projects on Open Apps", "Open Apps")).toBe(
      "Python projects on Open Apps",
    );
  });

  it("skips the suffix instead of exceeding the display cap", () => {
    const long = "A very long record name — with an equally long descriptor attached";
    expect(seoTitle(long, "Open Apps")).toBe(long);
  });

  it("falls back to the site name for an empty main part", () => {
    expect(seoTitle("  ", "Open Apps")).toBe("Open Apps");
  });

  it("returns the main part unchanged when no site name is given", () => {
    expect(seoTitle("Collections", "")).toBe("Collections");
  });
});

describe("seoDescription", () => {
  it("prefers the raw text and collapses whitespace", () => {
    expect(seoDescription("A  spaced\n\ntext.", "fallback")).toBe("A spaced text.");
  });

  it("uses the fallback when raw is empty", () => {
    expect(seoDescription(undefined, "The fallback.")).toBe("The fallback.");
    expect(seoDescription("   ", "The fallback.")).toBe("The fallback.");
  });

  it("truncates on a word boundary near 160 chars with an ellipsis", () => {
    const long = "word ".repeat(60).trim();
    const out = seoDescription(long, "");
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\swor…$/);
  });
});

describe("recordSeoDescriptor", () => {
  it("uses the summary's first clause when short enough", () => {
    expect(
      recordSeoDescriptor({
        summary: "Self-hosted photo backup. Works offline and syncs later.",
        singular: "app",
      }),
    ).toBe("Self-hosted photo backup");
  });

  it("falls back to the category phrase when the summary is too long", () => {
    expect(
      recordSeoDescriptor({
        summary:
          "A very long first clause that keeps going and going far past the cap",
        categoryLabel: "Photos",
        singular: "app",
      }),
    ).toBe("Open-source Photos app");
  });

  it("omits the category when it is missing or uncategorized", () => {
    expect(recordSeoDescriptor({ singular: "project" })).toBe("Open-source project");
    expect(
      recordSeoDescriptor({ categoryLabel: "Uncategorized", singular: "project" }),
    ).toBe("Open-source project");
  });
});

describe("titleCaseFirst", () => {
  it("capitalizes only the first character", () => {
    expect(titleCaseFirst("projects")).toBe("Projects");
    expect(titleCaseFirst("")).toBe("");
  });
});

describe("ogPath", () => {
  it("falls back to the static SVG when no generated image exists", () => {
    // Point at a directory with no public/og at all.
    expect(ogPath("record", "nothing-here", "/nonexistent-cwd")).toBe("/og-image.svg");
    expect(ogPath("home", undefined, "/nonexistent-cwd")).toBe("/og-image.svg");
  });
});

describe("absoluteUrl", () => {
  it("joins trailing-slash-safely", () => {
    expect(absoluteUrl("https://a.com/", "/x/")).toBe("https://a.com/x/");
    expect(absoluteUrl("https://a.com", "x/")).toBe("https://a.com/x/");
  });
});

describe("breadcrumbs", () => {
  it("builds an absolute BreadcrumbList with trailing slashes", () => {
    const node = breadcrumbs("https://a.com", [
      { path: "", name: "Home" },
      { path: "categories", name: "Categories" },
      { path: "categories/photos/", name: "Photos" },
    ]);
    expect(node["@type"]).toBe("BreadcrumbList");
    const items = node.itemListElement as Array<{ position: number; name: string; item: string }>;
    expect(items.map((i) => i.item)).toEqual([
      "https://a.com/",
      "https://a.com/categories/",
      "https://a.com/categories/photos/",
    ]);
    expect(items[2]).toMatchObject({ position: 3, name: "Photos" });
  });
});
