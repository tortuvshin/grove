import { describe, expect, it } from "vitest";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const siteRoot = resolve(import.meta.dirname, "../../../apps/example");
const pagesDir = resolve(siteRoot, "src/pages");

describe("default Astro route configuration", () => {
  it("ships TypeScript settings that resolve package exports and Node built-ins", async () => {
    const tsconfig = JSON.parse(
      await readFile(resolve(siteRoot, "tsconfig.json"), "utf8"),
    ) as {
      extends?: string;
      compilerOptions?: {
        moduleResolution?: string;
        types?: string[];
      };
    };
    const manifest = JSON.parse(
      await readFile(resolve(siteRoot, "package.json"), "utf8"),
    ) as { devDependencies?: Record<string, string> };

    expect(tsconfig.extends).toBe("astro/tsconfigs/base");
    expect(tsconfig.compilerOptions?.moduleResolution).toBe("Bundler");
    expect(tsconfig.compilerOptions?.types).toContain("node");
    expect(manifest.devDependencies?.["@types/node"]).toMatch(/^\^/);
  });

  it("treats generated JSON as an untyped boundary before applying payload types", async () => {
    const recordsModule = await readFile(
      resolve(import.meta.dirname, "server/directory.ts"),
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
    const submitClient = await readFile(
      resolve(import.meta.dirname, "components/SubmissionClient.astro"),
      "utf8",
    );

    expect(submitClient).toContain('"  type: manual"');
    expect(submitClient).not.toContain('"  type: github"');
  });

  it("keeps generic maintenance behavior in Grove instead of consumer scripts", async () => {
    const manifest = JSON.parse(
      await readFile(resolve(siteRoot, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const scriptsDirExists = await stat(resolve(siteRoot, "scripts"))
      .then(() => true)
      .catch(() => false);

    expect(manifest.scripts).toMatchObject({
      dev: "astro dev",
      build: "astro build",
      check: "astro check",
    });
    expect(manifest.scripts?.["sync:contributors"]).toBeUndefined();
    expect(scriptsDirExists).toBe(false);
  });

  it("hydrates static list pages with URL-driven search and pagination", async () => {
    const listClient = await readFile(
      resolve(import.meta.dirname, "components/DirectoryIndexClient.astro"),
      "utf8",
    );

    expect(listClient).toContain('id="grove-index-data"');
    expect(listClient).toContain("function applyClientFilters()");
    expect(listClient).toContain('from "@grove-dev/core/directory"');
    expect(listClient).toContain("PAGE_SIZE,");
    expect(listClient).toContain("filterRecords(items, filters)");
  });

  it("uses generated taxonomy names as display labels", async () => {
    const recordsModule = await readFile(
      resolve(import.meta.dirname, "server/directory.ts"),
      "utf8",
    );
    const models = await readFile(resolve(import.meta.dirname, "server/models.ts"), "utf8");

    expect(recordsModule).toContain("export function taxonomyLabel");
    expect(recordsModule).toContain("?? prettySlug(id)");
    expect(models).toContain('taxonomyLabel("categories"');
    expect(models).toContain("getDirectoryIndexModel");
  });

  it("ships community and final call-to-action sections on the homepage", async () => {
    const homePage = await readFile(resolve(pagesDir, "index.astro"), "utf8");

    expect(homePage).toContain("<ContributorsGrid");
    expect(homePage).toContain("<FinalCta");
    expect(homePage).toContain('viewAllLabel="Meet the community"');
  });

  it("keeps submission controls responsive and taxonomy-labelled", async () => {
    const submitPage = await readFile(resolve(pagesDir, "submit.astro"), "utf8");
    const models = await readFile(resolve(import.meta.dirname, "server/models.ts"), "utf8");

    expect(models).toContain('taxonomyLabel("categories"');
    expect(models).toContain("site.taxonomy?.stacks?.length");
    expect(models).not.toContain('return "typescript"');
    expect(submitPage).toContain("md:grid-cols-[minmax(0,1fr)_minmax(300px,0.72fr)]");
    expect(submitPage).toContain("md:sticky md:top-24");
  });

  it("keeps routes consumer-owned and package logic composable", async () => {
    const integration = await readFile(resolve(import.meta.dirname, "index.ts"), "utf8");
    const homePage = await readFile(resolve(pagesDir, "index.astro"), "utf8");
    const detailPage = await readFile(resolve(pagesDir, "[slug]/[recordSlug].astro"), "utf8");

    expect(integration).not.toContain("injectRoute");
    expect(homePage).toContain("getHomePageModel(siteConfig)");
    expect(detailPage).toContain("getRecordDetailModel(");
  });
});
