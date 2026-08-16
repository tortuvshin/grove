import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSitemap, buildSitemapIndex } from "./sitemap.js";
import type { GroveConfig } from "./schema.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("buildSitemap", () => {
  it("uses the configured directory route for index and record URLs", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "grove-sitemap-"));
    roots.push(cwd);
    const config = {
      blueprint: "project-directory",
      site: {
        name: "Open Apps",
        tagline: "Open-source apps with real codebases.",
        url: "https://open-apps.dev.mn",
      },
      routes: { directory: "apps" },
      labels: { singular: "app", plural: "apps" },
      paths: { publicDir: "public" },
    } as GroveConfig;

    const result = await buildSitemap(
      {
        generatedAt: "2026-06-24T00:00:00.000Z",
        items: [{ slug: "immich" }],
      },
      cwd,
      config,
    );
    const xml = await readFile(result.path, "utf8");

    // Trailing slashes: locs must match the pages' own canonicals
    // (`build.format: 'directory'`).
    expect(xml).toContain("<loc>https://open-apps.dev.mn/apps/</loc>");
    expect(xml).toContain("<loc>https://open-apps.dev.mn/apps/immich/</loc>");
    expect(xml).not.toContain("/projects");
  });

  it("lists collections, taxonomies, and static pages with trailing slashes", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "grove-sitemap-"));
    roots.push(cwd);
    const config = {
      blueprint: "project-directory",
      site: { name: "Open Apps", url: "https://open-apps.dev.mn" },
      routes: {},
      labels: { singular: "app", plural: "apps" },
      paths: { publicDir: "public" },
    } as GroveConfig;

    const result = await buildSitemap(
      {
        generatedAt: "2026-06-24T00:00:00.000Z",
        items: [{ slug: "immich" }],
        collections: [
          { slug: "top-photos", index: true, lastReviewedAt: "2026-06-01" },
          { slug: "secret-drafts", index: false },
        ],
        taxonomies: {
          categories: ["photos"],
          stacks: ["typescript"],
          licenses: ["agpl-3.0"],
        },
      },
      cwd,
      config,
    );
    const xml = await readFile(result.path, "utf8");

    expect(xml).toContain("<loc>https://open-apps.dev.mn/collections/</loc>");
    expect(xml).toContain("<loc>https://open-apps.dev.mn/collections/top-photos/</loc>");
    // `seo.index: false` collections must never be advertised.
    expect(xml).not.toContain("secret-drafts");
    expect(xml).toContain("<loc>https://open-apps.dev.mn/categories/</loc>");
    expect(xml).toContain("<loc>https://open-apps.dev.mn/categories/photos/</loc>");
    expect(xml).toContain("<loc>https://open-apps.dev.mn/stacks/typescript/</loc>");
    // Licenses have no index page — detail URL only.
    expect(xml).not.toContain("<loc>https://open-apps.dev.mn/licenses/</loc>");
    expect(xml).toContain("<loc>https://open-apps.dev.mn/licenses/agpl-3.0/</loc>");
    expect(xml).toContain("<loc>https://open-apps.dev.mn/about/</loc>");
    expect(xml).toContain("<loc>https://open-apps.dev.mn/contributors/</loc>");
    // lastReviewedAt drives the collection's lastmod.
    expect(xml).toMatch(/top-photos\/<\/loc>\s*<lastmod>2026-06-01<\/lastmod>/);
  });

  it("keeps hidden records out and never lists noindex routes", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "grove-sitemap-"));
    roots.push(cwd);
    const config = {
      blueprint: "project-directory",
      site: { name: "Open Apps", url: "https://open-apps.dev.mn" },
      routes: {},
      labels: { singular: "app", plural: "apps" },
      paths: { publicDir: "public" },
    } as GroveConfig;

    const result = await buildSitemap(
      {
        generatedAt: "2026-06-24T00:00:00.000Z",
        items: [{ slug: "visible" }, { slug: "ghost", visibility: "hide" }],
      },
      cwd,
      config,
    );
    const xml = await readFile(result.path, "utf8");
    expect(xml).toContain("/projects/visible/");
    expect(xml).not.toContain("ghost");
    expect(xml).not.toContain("/submit");
  });
});

describe("buildSitemapIndex", () => {
  it("includes only non-empty sections", () => {
    const xml = buildSitemapIndex("https://example.com", {
      pages: [],
      records: ["https://example.com/apps/a/"],
      collections: ["https://example.com/c/top/"],
      taxonomies: [],
    });
    expect(xml).toMatch(/<sitemapindex/);
    expect(xml).toMatch(/records\.xml/);
    expect(xml).toMatch(/collections\.xml/);
    expect(xml).not.toMatch(/pages\.xml/);
    expect(xml).not.toMatch(/taxonomies\.xml/);
  });
});
