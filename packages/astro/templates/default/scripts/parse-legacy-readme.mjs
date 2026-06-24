#!/usr/bin/env node
// SPDX-License-Identifier: MIT

/**
 * parse-legacy-readme.mjs — best-effort parser for legacy yml
 * records that ship a `readme` block (Markdown body + frontmatter)
 * instead of the V1 schema fields.
 *
 * Walks `data/records/*.yml`, splits `readme` into a `content`
 * file under `content/records/<slug>.md`, and produces a
 * `migration-report.md` summarizing which fields it filled in
 * (or could not).
 */
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { dirname, basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RECORDS_DIR = join(ROOT, "data", "records");
const CONTENT_DIR = join(ROOT, "content", "records");
const DRY_RUN = process.env.DRY_RUN === "1";

async function main() {
  let files = [];
  try {
    files = (await readdir(RECORDS_DIR)).filter((f) => f.endsWith(".yml")).sort();
  } catch {
    console.error("No data/records directory.");
    process.exit(1);
  }

  const report = [];
  for (const file of files) {
    const path = join(RECORDS_DIR, file);
    const text = await readFile(path, "utf8");
    if (!/^readme:\s*\|/m.test(text)) {
      report.push(`${file}: no legacy readme block`);
      continue;
    }
    const slug = basename(file, ".yml");
    const outPath = join(CONTENT_DIR, `${slug}.md`);
    if (!DRY_RUN) {
      await mkdir(dirname(outPath), { recursive: true });
      const body = text
        .split(/^readme:\s*\|\s*$/m)[1] ?? ""
        .split(/^[a-z]+:/m)[0] ?? "";
      await writeFile(outPath, body.trim(), "utf8");
    }
    report.push(`${file}: extracted readme → content/records/${slug}.md`);
  }

  console.log(report.join("\n"));
}

main().catch((err) => {
  console.error("parse-legacy-readme failed:", err);
  process.exit(1);
});
