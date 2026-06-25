import { describe, expect, it } from "vitest";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const pagesDir = resolve(import.meta.dirname, "../templates/default/src/pages");

describe("default Astro route configuration", () => {
  it("ships TypeScript settings that resolve package exports and Node built-ins", async () => {
    const templateRoot = resolve(pagesDir, "../..");
    const tsconfig = JSON.parse(
      await readFile(resolve(templateRoot, "tsconfig.json"), "utf8"),
    ) as {
      extends?: string;
      compilerOptions?: {
        moduleResolution?: string;
        types?: string[];
      };
    };
    const manifest = JSON.parse(
      await readFile(resolve(templateRoot, "package.json"), "utf8"),
    ) as { devDependencies?: Record<string, string> };

    expect(tsconfig.extends).toBe("astro/tsconfigs/base");
    expect(tsconfig.compilerOptions?.moduleResolution).toBe("Bundler");
    expect(tsconfig.compilerOptions?.types).toContain("node");
    expect(manifest.devDependencies?.["@types/node"]).toMatch(/^\^/);
  });

  it("treats generated JSON as an untyped boundary before applying payload types", async () => {
    const recordsModule = await readFile(
      resolve(pagesDir, "../data/records.ts"),
      "utf8",
    );

    expect(recordsModule).toContain(
      "fullPayload as unknown as FullPayload",
    );
  });

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

  it("generates submission drafts accepted by the Grove record schema", async () => {
    const submitPage = await readFile(resolve(pagesDir, "submit.astro"), "utf8");

    expect(submitPage).toContain('"  type: manual"');
    expect(submitPage).not.toContain('"  type: github"');
  });

  it("keeps generic maintenance behavior in Grove instead of consumer scripts", async () => {
    const templateRoot = resolve(pagesDir, "../..");
    const manifest = JSON.parse(
      await readFile(resolve(templateRoot, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const scriptsDirExists = await stat(resolve(templateRoot, "scripts"))
      .then(() => true)
      .catch(() => false);

    expect(manifest.scripts?.["build:llms"]).toBe("grove llms");
    expect(manifest.scripts?.["sync:contributors"]).toBe(
      "grove sync contributors",
    );
    expect(scriptsDirExists).toBe(false);
  });

  it("hydrates static list pages with URL-driven search and pagination", async () => {
    const listPage = await readFile(resolve(pagesDir, "[slug]/index.astro"), "utf8");

    expect(listPage).toContain('id="grove-index-data"');
    expect(listPage).toContain("function applyClientFilters()");
    expect(listPage).toContain("const PAGE_SIZE = 20");
  });

  it("uses generated taxonomy names as display labels", async () => {
    const recordsModule = await readFile(
      resolve(pagesDir, "../data/records.ts"),
      "utf8",
    );
    const homePage = await readFile(resolve(pagesDir, "index.astro"), "utf8");
    const listPage = await readFile(resolve(pagesDir, "[slug]/index.astro"), "utf8");

    expect(recordsModule).toContain("export function taxonomyLabel");
    expect(recordsModule).toContain("?? prettySlug(id)");
    expect(homePage).toContain('taxonomyLabel("categories"');
    expect(listPage).toContain("labelFacetsWithTaxonomy");
  });
});
