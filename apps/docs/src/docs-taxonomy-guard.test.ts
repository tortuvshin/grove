import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../..");

/**
 * Guards against documentation drifting from the implementation —
 * the taxonomy page once documented a `slug:` identifier key (the
 * loader requires `id:` and silently drops entries without it), a
 * five-file layout (the loader reads six), and a custom-taxonomy
 * walkthrough that no code path supports.
 */
describe("taxonomy docs match the implementation", () => {
  const taxonomyDocPath = resolve(
    repoRoot,
    "apps/docs/src/content/docs/sources/taxonomy-files.md",
  );
  const configDocPath = resolve(
    repoRoot,
    "apps/docs/src/content/docs/reference/config.md",
  );

  it("uses id (not slug) as the identifier key in every example", async () => {
    const doc = await readFile(taxonomyDocPath, "utf8");
    // Any `- slug:` list item would send authors down the
    // silently-empty-taxonomy path.
    expect(doc).not.toMatch(/-\s+slug:/);
    expect(doc).toMatch(/-\s+id:/);
  });

  it("documents all six taxonomy files the loader reads", async () => {
    const doc = await readFile(taxonomyDocPath, "utf8");
    for (const filename of [
      "categories.yml",
      "stacks.yml",
      "platforms.yml",
      "topics.yml",
      "licenses.yml",
      "distribution-channels.yml",
    ]) {
      expect(doc, filename).toContain(filename);
    }
    expect(doc).toContain("six");
    expect(doc).not.toContain("ships five");
  });

  it("does not describe an unsupported custom-taxonomy mechanism", async () => {
    const doc = await readFile(taxonomyDocPath, "utf8");
    expect(doc).not.toContain("audiences.yml");
    expect(doc).not.toContain("taxonomy.audiences");
  });

  it("documents browse.facets, not the removed top-level facets key", async () => {
    const configDoc = await readFile(configDocPath, "utf8");
    expect(configDoc).toContain("`browse.facets`");
    expect(configDoc).not.toMatch(/###\s+`facets`/);
  });

  it("lists exactly the facet ids the schema accepts", async () => {
    const configDoc = await readFile(configDocPath, "utf8");
    // apps/docs has no dependency on @grove-dev/core — import the
    // registry source directly so the doc is checked against the
    // real id list.
    const { FACET_IDS } = (await import(
      resolve(repoRoot, "packages/core/src/directory-facets.ts")
    )) as { FACET_IDS: readonly string[] };
    for (const id of FACET_IDS) {
      expect(configDoc, id).toContain(`\`${id}\``);
    }
  });
});
