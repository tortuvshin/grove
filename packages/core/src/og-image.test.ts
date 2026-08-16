import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildOgImages, renderOgPng } from "./og-image.js";
import type { GroveConfig } from "./schema.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function configFor(): GroveConfig {
  return {
    blueprint: "project-directory",
    site: {
      name: "Open Apps",
      tagline: "Open-source apps with real codebases.",
      url: "https://open-apps.dev.mn",
    },
    labels: { singular: "app", plural: "apps" },
    theme: { primaryColor: "#3b82f6" },
    paths: { publicDir: "public", generatedDir: "data/generated" },
  } as GroveConfig;
}

describe("renderOgPng", () => {
  it("renders a 1200×630 PNG for a record template", { timeout: 30_000 }, async () => {
    const png = Buffer.from(
      await renderOgPng({
        kind: "record",
        siteName: "Open Apps",
        name: "Immich",
        descriptor: "Self-hosted photo and video backup",
        stars: 12345,
        category: "Photos",
        host: "open-apps.dev.mn",
        accent: "#3b82f6",
      }),
    );
    expect(png.subarray(0, 4).equals(PNG_MAGIC)).toBe(true);
    // IHDR width/height live at fixed offsets in the first chunk.
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
});

describe("buildOgImages", () => {
  it("writes the full og/ tree and skips unchanged images on rebuild", { timeout: 60_000 }, async () => {
    const cwd = await mkdtemp(join(tmpdir(), "grove-og-"));
    roots.push(cwd);
    const input = {
      records: [{ slug: "immich", name: "Immich", descriptor: "Photo backup", stars: 10 }],
      collections: [{ slug: "top-photos", title: "Top Photo Apps", count: 4 }],
      taxonomies: [
        { facet: "category" as const, id: "photos", label: "Photos", count: 4 },
      ],
      stats: { totalRecords: 1, repositoryStars: 100 },
    };

    const first = await buildOgImages(cwd, configFor(), input);
    expect(first.failed).toBe(false);
    // home + default + 1 record + 1 collection + 1 taxonomy = 5
    expect(first.written).toBe(5);
    for (const rel of [
      "og/home.png",
      "og/default.png",
      "og/records/immich.png",
      "og/collections/top-photos.png",
      "og/categories/photos.png",
    ]) {
      const info = await stat(join(cwd, "public", rel));
      expect(info.size).toBeGreaterThan(0);
    }
    const manifest = JSON.parse(
      await readFile(join(cwd, "data/generated/og-manifest.json"), "utf8"),
    ) as Record<string, string>;
    expect(Object.keys(manifest)).toHaveLength(5);

    // Second run with identical input: everything skips.
    const second = await buildOgImages(cwd, configFor(), input);
    expect(second).toMatchObject({ written: 0, skipped: 5, failed: false });

    // Changing one record's input regenerates only that image.
    const third = await buildOgImages(cwd, configFor(), {
      ...input,
      records: [{ slug: "immich", name: "Immich", descriptor: "Now different", stars: 10 }],
    });
    expect(third).toMatchObject({ written: 1, skipped: 4, failed: false });
  });

  it("regenerates when the manifest is corrupt instead of failing", { timeout: 60_000 }, async () => {
    const cwd = await mkdtemp(join(tmpdir(), "grove-og-"));
    roots.push(cwd);
    const input = { records: [], collections: [], taxonomies: [] };
    await buildOgImages(cwd, configFor(), input);
    await writeFile(join(cwd, "data/generated/og-manifest.json"), "not json", "utf8");
    const result = await buildOgImages(cwd, configFor(), input);
    expect(result.failed).toBe(false);
    expect(result.written).toBe(2); // home + default
  });
});
