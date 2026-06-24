import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const pagesDir = resolve(import.meta.dirname, "../templates/default/src/pages");

describe("default Astro route configuration", () => {
  it("derives the directory route from generated site config", async () => {
    const listPage = await readFile(resolve(pagesDir, "[slug]/index.astro"), "utf8");

    expect(listPage).toContain("siteConfig.blueprintConfig?.routeSlug");
  });

  it("does not generate the legacy apps alias when apps is canonical", async () => {
    const aliasPage = await readFile(resolve(pagesDir, "apps/[recordSlug].astro"), "utf8");

    expect(aliasPage).toContain('if (indexSlug() === "apps")');
    expect(aliasPage).toContain("return []");
  });

  it("renders consumer-authored about Markdown through the default page", async () => {
    const aboutPage = await readFile(resolve(pagesDir, "about.astro"), "utf8");

    expect(aboutPage).toContain('getPageContentHtml("about")');
  });
});
