// SPDX-License-Identifier: MIT
/**
 * File hashing + lockfile I/O for `grove update`.
 *
 * `grove update` reads three sources of truth per file:
 *
 *   1. The on-disk file (what the consumer has today).
 *   2. `.grove/registry.lock.json` (what we last installed).
 *   3. The registry snapshot bundled with the CLI (what's upstream).
 *
 * Each is sha256-hashed into a 64-char hex digest. Lockfiles are
 * `registry.lock.json` shapes that mirror `registry.json` with an
 * extra `installedAt` field; this module keeps the I/O minimal so
 * `grove update` can run quickly even on large scaffolds.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type Sha256Hash = `sha256-${string}`;

export function sha256(value: string): Sha256Hash {
  return `sha256-${createHash("sha256").update(value).digest("hex")}` as Sha256Hash;
}

export interface LockfileFile {
  /** Path inside the consumer's project (`src/components/grove/...`). */
  target: string;
  /** Path inside the registry snapshot (relative to snapshot root). */
  source: string;
  /** Hash at install time. */
  hash: Sha256Hash;
  bytes: number;
}

export interface RegistryLockfile {
  scaffold: string;
  scaffoldVersion: string;
  installedAt: string;
  fileCount: number;
  files: LockfileFile[];
}

const LOCKFILE_VERSION_KEYS = ["scaffold", "scaffoldVersion", "installedAt", "fileCount", "files"] as const;

/**
 * Read and parse the consumer's lockfile. Returns null if absent —
 * a fresh consumer that was never initialized via `grove init` has
 * nothing to update from.
 */
export async function readLockfile(consumerRoot: string): Promise<RegistryLockfile | null> {
  const lockfilePath = join(consumerRoot, ".grove", "registry.lock.json");
  try {
    const raw = await readFile(lockfilePath, "utf8");
    const parsed = JSON.parse(raw) as RegistryLockfile;
    // Sanity-check the shape so we fail loud instead of silently
    // treating a malformed lockfile as "nothing installed".
    for (const key of LOCKFILE_VERSION_KEYS) {
      if (!(key in parsed)) {
        throw new Error(`registry.lock.json is missing required key "${key}"`);
      }
    }
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Hash a file at `consumerRoot/src/<target>` and return the digest.
 * Returns null if the file is missing.
 */
export async function hashInstalledFile(
  consumerRoot: string,
  target: string,
): Promise<Sha256Hash | null> {
  const filePath = join(consumerRoot, "src", target);
  try {
    const source = await readFile(filePath, "utf8");
    return sha256(source);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Write a fresh lockfile. Called by `grove init` (via the registry
 * installer) and by `grove update` after applying changes.
 */
export async function writeLockfile(
  consumerRoot: string,
  lockfile: RegistryLockfile,
): Promise<void> {
  const path = join(consumerRoot, ".grove", "registry.lock.json");
  await writeFile(path, `${JSON.stringify(lockfile, null, 2)}\n`, "utf8");
}
