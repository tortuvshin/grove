import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initDirectory, scaffoldSource } from "./init.js";

describe("grove init", () => {
  it("uses the real Grove example app as its only scaffold", () => {
    expect(scaffoldSource()).toMatch(/\/apps\/example$/);
  });

  it("creates a clean standalone directory", async () => {
    const parent = await mkdtemp(join(tmpdir(), "grove-init-"));
    const target = join(parent, "ai-stack");
    await initDirectory(target, { projectName: "AI Stack", version: "9.8.7" });

    const pkg = JSON.parse(await readFile(join(target, "package.json"), "utf8"));
    expect(pkg.name).toBe("ai-stack");
    expect(pkg.dependencies["@grove-dev/astro"]).toBe("^9.8.7");
    expect(pkg.dependencies["@grove-dev/core"]).toBe("^9.8.7");
    expect(await readFile(join(target, "grove.config.ts"), "utf8")).toContain(
      'name: "AI Stack"',
    );
    expect(await readFile(join(target, "src/pages/index.astro"), "utf8")).toContain(
      "getHomePageModel(siteConfig)",
    );
    expect(await readFile(join(target, "src/pages/[slug]/index.astro"), "utf8")).toContain(
      "getDirectoryIndexModel(Astro.url.searchParams, siteConfig)",
    );
    expect(await readFile(join(target, "README.md"), "utf8")).toContain(
      "consumer-owned Astro pages",
    );
    expect(await readFile(join(target, "LICENSE"), "utf8")).toContain(
      "MIT License",
    );
    await expect(
      readFile(join(target, "content/pages/about.md"), "utf8"),
    ).rejects.toThrow();
    await expect(
      readFile(join(target, "src/pages/apps/[recordSlug].astro"), "utf8"),
    ).rejects.toThrow();
    await expect(readFile(join(target, "public/robots.txt"), "utf8")).rejects.toThrow();
    await expect(readFile(join(target, "public/og-image.svg"), "utf8")).rejects.toThrow();
    await expect(readFile(join(target, "data/generated/records.json"), "utf8")).rejects.toThrow();
  });
});
