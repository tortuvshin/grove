import { describe, expect, it } from "vitest";
import { defineConfig } from "./config.js";

describe("Grove config", () => {
  it("accepts an optional GA4 measurement id", () => {
    const config = defineConfig({
      site: { name: "Directory" },
      analytics: { googleAnalyticsId: "G-TEST123" },
    });

    expect(config.analytics.googleAnalyticsId).toBe("G-TEST123");
  });

  it("rejects analytics ids that are not GA4 measurement ids", () => {
    expect(() =>
      defineConfig({
        site: { name: "Directory" },
        analytics: { googleAnalyticsId: "UA-123-1" },
      }),
    ).toThrow(/GA4 measurement ID/);
  });
});

describe("browse.facets contract", () => {
  it("preserves the configured facet order", () => {
    const config = defineConfig({
      site: { name: "Directory" },
      browse: { facets: ["stack", "license", "category"] },
    });
    expect(config.browse.facets).toEqual(["stack", "license", "category"]);
  });

  it("defaults to category + tags when browse is omitted", () => {
    const config = defineConfig({ site: { name: "Directory" } });
    expect(config.browse.facets).toEqual(["category", "tags"]);
  });

  it("rejects unknown facet ids instead of silently dropping them", () => {
    expect(() =>
      defineConfig({
        site: { name: "Directory" },
        // @ts-expect-error deliberate typo — must fail at runtime too
        browse: { facets: ["category", "platfrom"] },
      }),
    ).toThrow();
  });

  it("rejects plural spellings — canonical ids only", () => {
    expect(() =>
      defineConfig({
        site: { name: "Directory" },
        // @ts-expect-error plural spelling is not canonical
        browse: { facets: ["categories"] },
      }),
    ).toThrow();
  });

  it("rejects duplicate facet ids", () => {
    expect(() =>
      defineConfig({
        site: { name: "Directory" },
        browse: { facets: ["category", "category"] },
      }),
    ).toThrow(/duplicate/);
  });

  it("fails legacy top-level facets with a migration message", () => {
    expect(() =>
      defineConfig({
        site: { name: "Directory" },
        // @ts-expect-error legacy key — clean break with pointed error
        facets: ["category", "tags"],
      }),
    ).toThrow(/browse\.facets/);
  });
});

describe("theme.primaryColor validation", () => {
  it("defaults to the documented green", () => {
    const config = defineConfig({ site: { name: "Directory" } });
    expect(config.theme.primaryColor).toBe("#16a34a");
  });

  it("rejects non-hex values", () => {
    expect(() =>
      defineConfig({
        site: { name: "Directory" },
        theme: { primaryColor: "rebeccapurple" },
      }),
    ).toThrow(/hex color/);
  });
});
