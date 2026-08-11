import { describe, expect, it } from "vitest";
import { buildRobotsTxt, isIndexableFilterPath } from "./robots.js";

describe("buildRobotsTxt", () => {
  it("emits default policy", () => {
    const out = buildRobotsTxt({ siteUrl: "https://example.com/" });
    expect(out).toMatch(/User-agent: \*/);
    expect(out).toMatch(/Sitemap: https:\/\/example\.com\/sitemap\.xml/);
  });
  it("adds Disallow rules", () => {
    const out = buildRobotsTxt({ siteUrl: "https://example.com/", disallow: ["/api/"] });
    expect(out).toMatch(/Disallow: \/api\//);
  });
});

describe("isIndexableFilterPath", () => {
  it("rejects filter URLs", () => {
    expect(isIndexableFilterPath("/browse?q=chat")).toBe(false);
    expect(isIndexableFilterPath("/browse?sort=stars")).toBe(false);
    expect(isIndexableFilterPath("/browse?page=99")).toBe(false);
  });
  it("accepts canonical paths", () => {
    expect(isIndexableFilterPath("/")).toBe(true);
    expect(isIndexableFilterPath("/apps/")).toBe(true);
    expect(isIndexableFilterPath("/collections/top/")).toBe(true);
  });
  it("accepts canonical paginated paths", () => {
    expect(isIndexableFilterPath("/projects/?page=2")).toBe(true);
    expect(isIndexableFilterPath("/posts/?sort=newest")).toBe(true);
  });
});
