// SPDX-License-Identifier: MIT
/**
 * Materialize a registry scaffold into a consumer's source tree.
 *
 * `grove init` and `grove update` both need this — the difference is
 * the surrounding context (init starts from empty, update starts
 * from a previously-installed state with `.grove/registry.lock.json`
 * to compare against). This module owns the shared mechanics:
 *
 *   - locate the registry snapshot bundled with @grove-dev/cli,
 *   - hash each file with sha256 (same algorithm `grove update`
 *     reads from `.grove/registry.lock.json`),
 *   - write the consumer's `src/`, `.grove/registry.lock.json`,
 *     `grove.config.ts`, and `data/`.
 *
 * The registry snapshot ships at `@grove-dev/cli/dist/registry/`
 * (built from `packages/registry/default/` by `scripts/build-cli.mjs`).
 * In v1 the snapshot is bundled with the CLI; future versions can
 * fetch from the registry server without API changes here.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

export interface RegistryFile {
  /** Path inside the consumer's project (e.g. `src/components/grove/...`). */
  target: string;
  /** Path inside the registry snapshot (e.g. `components/grove/...`). */
  source: string;
  /** sha256 of the file contents. */
  hash: string;
  /** Size in bytes. */
  bytes: number;
}

export interface RegistryManifest {
  $schema?: string;
  name: string;
  version: string;
  description?: string;
  type: string;
  dependencies: string[];
  devDependencies?: string[];
  scripts?: Record<string, string>;
  meta?: Record<string, unknown>;
}

export interface InstalledScaffold {
  manifest: RegistryManifest;
  files: RegistryFile[];
  lockfile: RegistryLockfile;
}

export interface RegistryLockfile {
  scaffold: string;
  scaffoldVersion: string;
  installedAt: string;
  fileCount: number;
  files: RegistryFile[];
}

/**
 * Locate the bundled registry snapshot. In a published `@grove-dev/cli`,
 * the snapshot lives at `<package>/dist/registry/default/`. When the
 * CLI is invoked from source (development), the snapshot lives next
 * to the source at `packages/registry/default/`.
 */
export function resolveRegistrySnapshotDir(scaffold = "@grove/default"): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // The build-cli.mjs script copies the contents of
  // packages/registry/default/ into packages/cli/src/registry-snapshot/
  // and into dist/registry/ — flat, not under a per-scaffold subdir.
  // For consumers running the CLI from a published tarball the snapshot
  // lives at dist/registry/.
  const candidates = [
    resolve(here, "registry"),
    resolve(here, "registry-snapshot"),
    resolve(here, "..", "src", "registry-snapshot"),
    resolve(here, "..", "..", "src", "registry-snapshot"),
    resolve(here, "..", "..", "..", "packages", "registry", "default"),
  ];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, "registry.json"))) return candidate;
  }
  throw new Error(
    `Registry snapshot for ${scaffold} not found. Reinstall @grove-dev/cli or build the registry snapshot into dist/registry/`,
  );
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Read the manifest and hash every file in the snapshot. Pure —
 * touches disk but does not mutate.
 */
export async function loadManifest(scaffold = "@grove/default"): Promise<InstalledScaffold> {
  const snapshotDir = resolveRegistrySnapshotDir(scaffold);
  const manifestPath = join(snapshotDir, "registry.json");
  const manifest: RegistryManifest = JSON.parse(
    await readFile(manifestPath, "utf8"),
  );
  const files: RegistryFile[] = [];
  for await (const full of walk(snapshotDir)) {
    const rel = relative(snapshotDir, full).split("\\").join("/");
    if (rel === "registry.json" || rel === "registry.lock.json" || rel === "README.md") continue;
    // *.test.ts (e.g. lib/classnames.test.ts) exists to protect the
    // registry's own source inside this monorepo — a real consumer
    // has no vitest dependency (`grove init` doesn't install one),
    // so shipping it makes `astro check` fail on an unresolvable
    // `from "vitest"` import in every fresh scaffold. It stays part
    // of the canonical registry (and the example mirror, which does
    // have vitest) but is never materialized into a consumer's src/.
    if (/\.(test|spec)\.tsx?$/.test(rel)) continue;
    const source = await readFile(full, "utf8");
    files.push({
      target: rel, // snapshot layout already matches consumer's src/ for these.
      source: rel,
      hash: `sha256-${sha256(source)}`,
      bytes: Buffer.byteLength(source, "utf8"),
    });
  }
  files.sort((a, b) => a.target.localeCompare(b.target));
  return {
    manifest,
    files,
    lockfile: {
      scaffold: manifest.name,
      scaffoldVersion: manifest.version,
      installedAt: new Date().toISOString().slice(0, 10),
      fileCount: files.length,
      files,
    },
  };
}

async function* walk(dir: string): AsyncIterable<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.name === "registry.json" || entry.name === "registry.lock.json") continue;
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

/**
 * Write the snapshot into the consumer's project tree and produce a
 * lockfile recording the hashes at install time.
 *
 * Does NOT touch:
 *   - `package.json` (caller adds dependencies after install completes)
 *   - `grove.config.ts` (caller writes that with project-specific values)
 *   - `data/` (caller decides what content to seed)
 */
export async function materializeRegistry(
  consumerRoot: string,
  options: { scaffold?: string; force?: boolean } = {},
): Promise<InstalledScaffold> {
  const scaffold = options.scaffold ?? "@grove/default";
  const loaded = await loadManifest(scaffold);
  const snapshotDir = resolveRegistrySnapshotDir(scaffold);
  for (const file of loaded.files) {
    // Every consumer-installed path lives under `src/`. The snapshot's
    // own tree doesn't carry that prefix (the registry's content
    // layout mirrors what consumers see under their src/); this
    // adapter adds it back so `init` and `update` agree on the
    // on-disk shape.
    const consumerPath = resolve(consumerRoot, "src", file.target);
    await mkdir(dirname(consumerPath), { recursive: true });
    const source = await readFile(join(snapshotDir, file.source), "utf8");
    await writeFile(consumerPath, source);
  }
  // Write the lockfile under `.grove/`.
  const groveDir = resolve(consumerRoot, ".grove");
  await mkdir(groveDir, { recursive: true });
  await writeFile(
    join(groveDir, "registry.lock.json"),
    `${JSON.stringify(loaded.lockfile, null, 2)}\n`,
    "utf8",
  );
  return loaded;
}

/**
 * Wipe an existing scaffold from the consumer's project tree. Used by
 * `grove update --force` to restore the registry version of files that
 * drifted in a way that wouldn't be safe to overwrite automatically.
 *
 * NOT exposed to `grove init` — init refuses to install over a non-empty
 * directory; the wipe is only useful in the update flow.
 */
export async function wipeRegistryFiles(
  consumerRoot: string,
  files: RegistryFile[],
): Promise<void> {
  for (const file of files) {
    const target = resolve(consumerRoot, "src", file.target);
    await rm(target, { force: true });
  }
}
