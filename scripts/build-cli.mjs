// SPDX-License-Identifier: MIT
/**
 * Build the `@grove-dev/cli` package.
 *
 *   node scripts/build-cli.mjs
 *
 * Two-step build:
 *
 *   1. Copy packages/registry/default/ into packages/cli/src/registry-snapshot/
 *      so `tsc` can pick it up via the includes pattern. (Currently
 *      tsc only ships .ts files into dist/, so we copy into
 *      dist/registry/ as a post-step below.)
 *   2. Copy the snapshot into dist/registry/ after tsc has run.
 *      `grove init` reads from `<package>/dist/registry/` at runtime
 *      (via `resolveRegistrySnapshotDir()`).
 *
 * Why a snapshot under packages/cli/src/? The CLI is published as a
 * single tarball and the snapshot has to ship with it. The snapshot
 * lives under src/ so it travels with the .ts source through the
 * package boundary; the .gitignore treats it as an untracked artifact
 * so it never lands in commits.
 */
import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const registryDefault = resolve(root, "packages/registry/default");
const cliSnapshot = resolve(root, "packages/cli/src/registry-snapshot");

const fresh = process.argv.includes("--fresh");

if (!existsSync(registryDefault)) {
  throw new Error("Registry scaffold missing — run `pnpm -F @grove-dev/registry build` first.");
}

if (fresh) {
  await rm(cliSnapshot, { recursive: true, force: true });
}
await mkdir(cliSnapshot, { recursive: true });
await cp(registryDefault, cliSnapshot, { recursive: true });

// Exclude lockfile from the bundled snapshot — it's a build artifact
// and is recomputed by the consumer's `grove init`.
await rm(resolve(cliSnapshot, "registry.lock.json"), { force: true });

console.log(`Synced registry snapshot → ${cliSnapshot.slice(root.length + 1)}/`);

