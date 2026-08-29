// SPDX-License-Identifier: MIT
/**
 * Verify that apps/example is exactly what `grove init` would install:
 * every file the registry's full scaffold ships exists at its target
 * under apps/example/ with identical bytes. The example is the canary
 * for the registry — a component edited in one place but not the
 * other shows up here as a gate failure.
 *
 *   node scripts/check-example-mirrors-registry.mjs          verify
 *   node scripts/check-example-mirrors-registry.mjs --write  refresh
 *       apps/example/.grove/registry.lock.json (what `grove update`
 *       compares against; .grove/ is gitignored, so this is local)
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import {
  ROOT,
  SCAFFOLD_ID,
  SCAFFOLD_ITEM,
  buildFullRegistry,
  lockEntriesFor,
  readRegistryVersion,
  readSource,
  targetToProjectPath,
} from "./lib/registry.mjs";

const exampleRoot = resolve(ROOT, "apps/example");
const lockfilePath = resolve(exampleRoot, ".grove/registry.lock.json");
const writeMode = process.argv.includes("--write");

const scaffold = buildFullRegistry().items.find((item) => item.name === SCAFFOLD_ITEM);

if (writeMode) {
  const files = lockEntriesFor(scaffold);
  const lock = {
    scaffold: SCAFFOLD_ID,
    scaffoldVersion: readRegistryVersion(),
    installedAt: new Date().toISOString().slice(0, 10),
    fileCount: files.length,
    files,
  };
  await mkdir(resolve(exampleRoot, ".grove"), { recursive: true });
  await writeFile(lockfilePath, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`Wrote ${relative(ROOT, lockfilePath)} (${files.length} files)`);
  process.exit(0);
}

let missing = 0;
let drifted = 0;
for (const file of scaffold.files) {
  const projectPath = targetToProjectPath(file.target);
  const examplePath = resolve(exampleRoot, projectPath);
  if (!existsSync(examplePath)) {
    console.error(`missing: ${projectPath}`);
    missing++;
    continue;
  }
  if ((await readFile(examplePath, "utf8")) !== readSource(file.path)) {
    console.error(`drifted: ${projectPath}  (registry: ${file.path})`);
    drifted++;
  }
}
if (missing + drifted > 0) {
  console.error(`\n${missing + drifted} file(s) differ from the registry (${missing} missing, ${drifted} drifted).`);
  console.error("Copy the registry version over apps/example (or the other way round), then re-run.");
  process.exit(1);
}
console.log(`apps/example mirrors ${SCAFFOLD_ID} (${scaffold.files.length} files in lockstep).`);
