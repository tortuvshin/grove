#!/usr/bin/env node
// SPDX-License-Identifier: MIT

/**
 * migrate-legacy-to-schema-v1.mjs — best-effort mapper from the
 * legacy OpenSourceApp shape (openapps v0 schema) into the
 * Grove V1 record shape (kind: project + Resource union).
 *
 * Reads `data/legacy/*.yml` (if present), writes
 * `data/records/*.yml`. Field-by-field mapping is documented
 * inline.
 */
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { parse, stringify } from "yaml";
import { dirname, basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const LEGACY_DIR = join(ROOT, "data", "legacy");
const RECORDS_DIR = join(ROOT, "data", "records");
const DRY_RUN = process.env.DRY_RUN === "1";

function map(legacy) {
  // Best-effort: openapps → grove V1. Fields with no clear
  // equivalent are left for a human to fill in.
  return {
    kind: "project",
    slug: legacy.slug ?? basename(legacy.__file ?? "unknown", ".yml"),
    name: legacy.name ?? legacy.title ?? "",
    description: legacy.description ?? legacy.summary ?? "",
    repoUrl: legacy.repoUrl ?? legacy.source?.url ?? "",
    homepageUrl: legacy.homepageUrl ?? legacy.links?.website ?? "",
    category: legacy.category ?? "tools",
    stack: legacy.stack ?? legacy.stacks?.[0] ?? "",
    stacks: Array.isArray(legacy.stacks) ? legacy.stacks.slice(1).filter(Boolean) : [],
    platforms: legacy.platforms ?? [],
    tags: legacy.tags ?? [],
    stars: legacy.stars,
    license: legacy.license,
    status: legacy.status,
    bestFor: legacy.bestFor ?? [],
    whyListed: legacy.whyListed ?? [],
    caveats: legacy.caveats ?? [],
    curation: {
      reviewed: Boolean(legacy.curation?.reviewed),
      by: legacy.curation?.by,
      date: legacy.curation?.date,
      labels: legacy.labels ?? legacy.curation?.labels ?? [],
    },
  };
}

async function main() {
  let files = [];
  try {
    files = (await readdir(LEGACY_DIR)).filter((f) => f.endsWith(".yml")).sort();
  } catch {
    console.error("No data/legacy directory. Drop legacy yml files in there and re-run.");
    process.exit(1);
  }

  if (!DRY_RUN) await mkdir(RECORDS_DIR, { recursive: true });
  let migrated = 0;
  for (const file of files) {
    const text = await readFile(join(LEGACY_DIR, file), "utf8");
    const raw = parse(text) ?? {};
    raw.__file = file;
    const rec = map(raw);
    const slug = rec.slug || basename(file, ".yml");
    const dest = join(RECORDS_DIR, `${slug}.yml`);
    if (DRY_RUN) {
      console.log(`  ~ ${file} → ${slug}.yml (dry-run)`);
    } else {
      await writeFile(dest, stringify(rec), "utf8");
      console.log(`  ✓ ${file} → ${slug}.yml`);
    }
    migrated++;
  }
  console.log(`Migrated ${migrated} legacy record${migrated === 1 ? "" : "s"}.`);
}

main().catch((err) => {
  console.error("migrate-legacy-to-schema-v1 failed:", err);
  process.exit(1);
});
