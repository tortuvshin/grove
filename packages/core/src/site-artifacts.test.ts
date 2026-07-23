import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { defineConfig } from "./config.js";
import { buildRobotsTxt } from "./robots.js";
import {
  buildOgImageSvg,
  buildSiteArtifacts,
} from "./site-artifacts.js";

const config = defineConfig({
  site: {
    name: "Open & Useful",
    tagline: "A directory controlled by config and data.",
    url: "https://directory.example",
  },
  labels: { plural: "apps" },
  theme: { primaryColor: "#123456" },
});

describe("site artifacts", () => {
  let cwd: string | undefined;

  afterEach(async () => {
    if (cwd) await rm(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  it("uses canonical config in robots and social metadata", () => {
    expect(buildRobotsTxt({ siteUrl: config.site.url ?? "" })).toContain(
      "Sitemap: https://directory.example/sitemap-index.xml",
    );
    const svg = buildOgImageSvg(config, {
      totalRecords: 149,
      repositoryStars: 4300,
    });
    expect(svg).toContain("Open &amp; Useful");
    expect(svg).toContain("149 apps · 4,300 stars");
    expect(svg).toContain("#123456");
  });

  it("updates Grove-owned files but preserves consumer-owned custom files", async () => {
    cwd = await mkdtemp(join(tmpdir(), "grove-artifacts-"));
    await mkdir(join(cwd, "public"), { recursive: true });
    await writeFile(join(cwd, "public", "robots.txt"), "# custom robots\n");

    const first = await buildSiteArtifacts(cwd, config, { totalRecords: 2 });
    expect(first.robotsWritten).toBe(false);
    expect(first.ogImageWritten).toBe(true);
    expect(await readFile(join(cwd, "public", "robots.txt"), "utf8")).toBe(
      "# custom robots\n",
    );

    const second = await buildSiteArtifacts(cwd, config, { totalRecords: 3 });
    expect(second.ogImageWritten).toBe(true);
    expect(await readFile(join(cwd, "public", "og-image.svg"), "utf8")).toContain(
      "3 apps",
    );
  });
});
