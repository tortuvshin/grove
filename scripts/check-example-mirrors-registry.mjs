// SPDX-License-Identifier: MIT
/**
 * Verify that apps/example is structurally equivalent to a fresh
 * `grove init` output. The example is the canary for the registry
 * model — if the registry changes (Phase 4's move, Phase 6's init
 * rewrite, Phase 7's update mechanism) and apps/example drifts, the
 * difference will show here as a gate failure.
 *
 *   node scripts/check-example-mirrors-registry.mjs          verify
 *   node scripts/check-example-mirrors-registry.mjs --write  install
 *
 * `--write` materializes a registry lockfile snapshot at
 * apps/example/.grove/registry.lock.json so `grove update` has
 * something to compare against on the next run.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const registryDefault = resolve(root, "packages/registry/default");
const exampleSrc = resolve(root, "apps/example/src");
const exampleLockfile = resolve(root, "apps/example/.grove/registry.lock.json");
const exampleGroveDir = resolve(root, "apps/example/.grove");

const writeMode = process.argv.includes("--write");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

// Mirror the registry's directory layout onto apps/example/src. The
// mapping is the same as Phase 4: registry/default/components/grove/
// becomes example/src/components/grove/, etc.
const REGISTRY_TO_EXAMPLE = {
  "components/ui/": "components/ui/",
  "components/grove/": "components/grove/",
  "components/site/": "components/site/",
  "layouts/": "layouts/",
  "lib/": "lib/",
  "styles/system.css": "styles/system.css",
  "pages/": "pages/",
};

function registryToExamplePath(rel) {
  for (const [from, to] of Object.entries(REGISTRY_TO_EXAMPLE)) {
    if (rel.startsWith(from)) {
      return to + rel.slice(from.length);
    }
  }
  return null;
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === ".grove") continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

async function buildLockfile() {
  const manifest = JSON.parse(
    await readFile(resolve(registryDefault, "registry.json"), "utf8"),
  );
  const files = [];
  for await (const full of walk(registryDefault)) {
    if (full.endsWith("registry.json") || full.endsWith("registry.lock.json")) continue;
    const rel = relative(registryDefault, full).split("\\").join("/");
    if (rel === "README.md") continue;
    const exampleRel = registryToExamplePath(rel);
    if (!exampleRel) continue;
    const source = await readFile(full, "utf8");
    files.push({
      path: exampleRel,
      source: rel,
      hash: `sha256-${sha256(source)}`,
      bytes: Buffer.byteLength(source, "utf8"),
    });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return {
    scaffold: manifest.name,
    scaffoldVersion: manifest.version,
    builtAt: new Date().toISOString().slice(0, 10),
    fileCount: files.length,
    files,
  };
}

async function main() {
  if (writeMode) {
    const lock = await buildLockfile();
    await mkdir(exampleGroveDir, { recursive: true });
    await writeFile(exampleLockfile, JSON.stringify(lock, null, 2) + "\n");
    console.log(`Wrote ${exampleLockfile.replace(root + "/", "")}`);
    console.log(`  ${lock.fileCount} files`);
    return;
  }

  const lock = await buildLockfile();
  let drifted = 0;
  let missing = 0;
  for (const file of lock.files) {
    const examplePath = resolve(exampleSrc, file.path);
    if (!existsSync(examplePath)) {
      console.error(`missing: ${file.path}`);
      missing++;
      continue;
    }
    const source = await readFile(examplePath, "utf8");
    if (`sha256-${sha256(source)}` !== file.hash) {
      console.error(`drifted: ${file.path}`);
      drifted++;
    }
  }
  if (missing + drifted > 0) {
    console.error(`\n${missing + drifted} files differ from registry (${missing} missing, ${drifted} drifted).`);
    console.error("Run `pnpm example:sync` to refresh apps/example from the registry.");
    process.exit(1);
  }
  console.log(`apps/example mirrors @grove/default (${lock.fileCount} files in lockstep).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
