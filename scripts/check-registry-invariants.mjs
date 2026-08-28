// SPDX-License-Identifier: MIT
/**
 * Enforce §22 of the v1 architecture spec: registry `.astro` files
 * must not import from `@grove-dev/astro/components`, `…/ui`, or
 * `…/layouts`, because those exports are deleted in v1.
 *
 * Registry code is allowed to import from:
 *   - local paths (`./`, `../`)
 *   - `@grove-dev/core/types`
 *   - `@grove-dev/astro/server` (typed view-model contracts)
 *
 * Exits 1 with a list of offenders when any rule is violated.
 */
import { readFile, readdir } from "node:fs/promises";
import { resolve, relative, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const registryRoot = resolve(root, "packages/registry");

const FORBIDDEN = [
  /from\s+["']@grove-dev\/astro\/components/,
  /from\s+["']@grove-dev\/astro\/ui/,
  /from\s+["']@grove-dev\/astro\/layouts/,
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.name === "node_modules") continue;
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && entry.name.endsWith(".astro")) {
      yield full;
    }
  }
}

async function main() {
  const offenders = [];
  for await (const file of walk(registryRoot)) {
    const source = await readFile(file, "utf8");
    const hits = [];
    for (const pattern of FORBIDDEN) {
      const match = source.match(pattern);
      if (match) hits.push(match[0]);
    }
    if (hits.length > 0) {
      offenders.push({ file: relative(root, file), hits });
    }
  }

  if (offenders.length > 0) {
    console.error("Registry invariants violated — registry UI must not import runtime UI subpaths from @grove-dev/astro:\n");
    for (const { file, hits } of offenders) {
      console.error(`  ${file}`);
      for (const hit of hits) {
        console.error(`    - ${hit}`);
      }
    }
    process.exit(1);
  }
  console.log("Registry invariants OK.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
