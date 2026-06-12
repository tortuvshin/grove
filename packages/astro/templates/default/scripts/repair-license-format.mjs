#!/usr/bin/env node
// SPDX-License-Identifier: MIT

/**
 * repair-license-format.mjs — normalize the `license` field on
 * every record yml. Maps common GitHub-shaped license keys
 * ("agpl-3.0", "Apache-2.0", "mit") to their SPDX IDs.
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { parse, stringify } from "node:yaml";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RECORDS_DIR = join(ROOT, "data", "records");
const DRY_RUN = process.env.DRY_RUN === "1";

const LICENSE_MAP = {
  "mit": "MIT",
  "apache-2.0": "Apache-2.0",
  "apache 2.0": "Apache-2.0",
  "gpl-3.0": "GPL-3.0",
  "gpl-2.0": "GPL-2.0",
  "lgpl-2.1": "LGPL-2.1",
  "lgpl-3.0": "LGPL-3.0",
  "agpl-3.0": "AGPL-3.0",
  "bsd-3-clause": "BSD-3-Clause",
  "bsd-2-clause": "BSD-2-Clause",
  "isc": "ISC",
  "mpl-2.0": "MPL-2.0",
  "unlicense": "Unlicense",
  "wtfpl": "WTFPL",
};

function normalize(license) {
  if (!license) return license;
  const k = String(license).trim().toLowerCase();
  return LICENSE_MAP[k] ?? license;
}

async function main() {
  let files = [];
  try {
    files = (await readdir(RECORDS_DIR)).filter((f) => f.endsWith(".yml")).sort();
  } catch {
    console.error("No data/records directory. Run `grove init` first.");
    process.exit(1);
  }

  let repaired = 0;
  for (const file of files) {
    const path = join(RECORDS_DIR, file);
    const rec = parse(await readFile(path, "utf8")) ?? {};
    const normalized = normalize(rec.license);
    if (normalized === rec.license) continue;
    rec.license = normalized;
    if (DRY_RUN) {
      console.log(`  ~ ${file} → ${normalized}`);
    } else {
      await writeFile(path, stringify(rec), "utf8");
      console.log(`  ✓ ${file} → ${normalized}`);
    }
    repaired++;
  }
  console.log(`Repaired ${repaired} record${repaired === 1 ? "" : "s"}.`);
}

main().catch((err) => {
  console.error("repair-license-format failed:", err);
  process.exit(1);
});
