import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSitemap } from "./sitemap.js";
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

    expect(xml).toContain("https://open-apps.dev.mn/apps");
    expect(xml).toContain("https://open-apps.dev.mn/apps/immich");
    expect(xml).not.toContain("/projects");
  });
});
