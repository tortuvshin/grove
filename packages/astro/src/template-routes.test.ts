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

  it("does not ship an Open Apps-specific legacy route", async () => {
    const aliasExists = await stat(resolve(pagesDir, "apps/[recordSlug].astro"))
      .then(() => true)
      .catch(() => false);

    expect(aliasExists).toBe(false);
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

    // The record index is fetched, not inlined: a paginated page must
    // not carry the whole directory in its HTML.
    expect(listClient).toContain("/page/records.json");
    expect(listClient).not.toContain('id="grove-index-data"');
    expect(listClient).toContain('id="grove-index-config"');
    expect(listClient).toContain("function applyClientFilters()");
    expect(listClient).toContain('from "@grove-dev/core/directory"');
    expect(listClient).toContain("PAGE_SIZE,");
    expect(listClient).toContain("filterRecords(items, filters)");
  });

  it("keeps prerendered pages on real navigations", async () => {
    // `/{slug}/` and `/{slug}/page/N/` are documents, not states: page
    // 2's "Previous" link, "Clear all", and the header's own Browse
    // link all point at a different document. Adopting those in place
    // left page 2's records rendered under the page-1 URL. Only a URL
    // that carries a query — which no prerendered page has — is ours.
    const listClient = await readFile(
      resolve(import.meta.dirname, "components/DirectoryIndexClient.astro"),
      "utf8",
    );

    expect(listClient).toContain("if (!isListUrl || !url.search) return;");
    // The skip link lives on this same path; a hash is never ours.
    expect(listClient).toContain("if (url.hash) return;");
    // Sort is a client view too: every `/page/N/` document is built
    // with the default sort.
    expect(listClient).toContain(
      "const isClientView = () => hasAnyFilter(filters) || Boolean(filters.sort);",
    );
  });

  it("recomputes facet intersection counts from the live query string", async () => {
    // The route is prerendered with global (unfiltered) counts; the
    // client must re-run buildFacets with the URL's filters and patch
    // the count spans in place (audit P0: counts stayed global under
    // an active filter).
    const listClient = await readFile(
      resolve(import.meta.dirname, "components/DirectoryIndexClient.astro"),
      "utf8",
    );
    const filterOptions = await readFile(
      resolve(import.meta.dirname, "components/FilterOptions.astro"),
      "utf8",
    );

    expect(listClient).toContain("buildFacets,");
    expect(listClient).toContain("buildFacets(items, {");
    expect(listClient).toContain('querySelectorAll("[data-facet-count]")');
    expect(filterOptions).toContain("data-facet-count");
    expect(filterOptions).toContain("data-facet={filterKey}");
    expect(filterOptions).toContain("data-value={option.value}");
  });

  it("exposes filter popovers as groups of native inputs, never listboxes", async () => {
    // role="listbox" over label/input children has no valid a11y
    // tree; the popover is a group of native checkboxes/radios.
    const menu = await readFile(
      resolve(import.meta.dirname, "components/FilterGroupMenu.astro"),
      "utf8",
    );
    expect(menu).not.toContain('role="listbox"');
    expect(menu).not.toContain('aria-haspopup="listbox"');
    expect(menu).toContain('role="group"');
    expect(menu).toContain('aria-expanded="false"');
  });

  it("announces theme changes with a stateful label and live region", async () => {
    const toggle = await readFile(
      resolve(import.meta.dirname, "layouts/ThemeToggle.astro"),
      "utf8",
    );
    expect(toggle).toContain('role="status"');
    expect(toggle).toContain("switch to");
    expect(toggle).toContain('setAttribute("aria-label"');
    expect(toggle).not.toContain('aria-label="Toggle theme"');
  });

  it("builds the mobile filter drawer on a native dialog", async () => {
    const drawer = await readFile(
      resolve(import.meta.dirname, "ui/FilterDrawer.astro"),
      "utf8",
    );
    expect(drawer).toContain("<dialog");
    expect(drawer).toContain("showModal()");
    expect(drawer).toContain('aria-haspopup="dialog"');
  });

  it("restores focus to the trigger when Escape closes a filter popover", async () => {
    const panel = await readFile(
      resolve(import.meta.dirname, "components/RefinePanel.astro"),
      "utf8",
    );
    expect(panel).toContain('aria-expanded="true"');
    expect(panel).toContain(".focus()");
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
