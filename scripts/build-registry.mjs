// SPDX-License-Identifier: MIT
/**
 * Build the `@grove-dev/registry` package — produces a lockfile per
 * scaffold that records the sha256 of every file the registry
 * ships. The lockfile is a build-time artifact only; consumers
 * never see it. `grove update` reads its own copy at install time
 * to detect local modifications.
 *
 *   node scripts/build-registry.mjs           write all lockfiles
 *   node scripts/build-registry.mjs --check   exit 1 if drifted
 *
 * The invariant check (separate script) enforces §22 of the v1
 * architecture spec — registry `.astro` files must not import from
 * `@grove-dev/astro/components`, `…/ui`, or `…/layouts`, because
 * those exports are deleted in v1. Build runs the invariant check
 * after generating lockfiles.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const registryRoot = resolve(root, "packages/registry");
const defaultDir = resolve(registryRoot, "default");
const manifestPath = resolve(defaultDir, "registry.json");
const lockfilePath = resolve(defaultDir, "registry.lock.json");

const check = process.argv.includes("--check");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.name === "node_modules" || entry.name === "registry.lock.json") continue;
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

async function buildLockfile() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const files = [];
  for await (const full of walk(defaultDir)) {
    if (full === manifestPath) continue;
    if (full === lockfilePath) continue;
    const source = await readFile(full, "utf8");
    files.push({
      path: relative(defaultDir, full).split("\\").join("/"),
      hash: `sha256-${sha256(source)}`,
      bytes: Buffer.byteLength(source, "utf8"),
    });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return {
    scaffold: manifest.name,
    scaffoldVersion: manifest.version,
    builtAt: new Date().toISOString().slice(0, 10), // YYYY-MM-DD only, for stable output
    fileCount: files.length,
    files,
  };
}

function renderLockfile(lock) {
  return `${JSON.stringify(lock, null, 2)}\n`;
}

async function main() {
  if (!existsSync(defaultDir)) {
    throw new Error(`Registry scaffold directory missing: ${defaultDir}`);
  }

  if (check) {
    const lock = await buildLockfile();
    const expected = renderLockfile(lock);
    let drifted = false;
    if (!existsSync(lockfilePath)) {
      console.error(`drifted: ${relative(root, lockfilePath)} (missing)`);
      drifted = true;
    } else {
      const actual = await readFile(lockfilePath, "utf8");
      if (actual !== expected) {
        console.error(`drifted: ${relative(root, lockfilePath)}`);
        drifted = true;
      }
    }
    if (drifted) {
      console.error("\nRegistry lockfile is out of date — run `pnpm -F @grove-dev/registry build`.");
      process.exit(1);
    }
    console.log(`Registry lockfile is up to date (${lock.fileCount} files).`);
    return;
  }

  await mkdir(dirname(lockfilePath), { recursive: true });
  const lock = await buildLockfile();
  await writeFile(lockfilePath, renderLockfile(lock));
  console.log(`Built registry lockfile for ${lock.scaffold}@${lock.scaffoldVersion}:`);
  console.log(`  ${relative(root, lockfilePath)}`);
  console.log(`  ${lock.fileCount} files`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
