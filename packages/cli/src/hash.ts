// SPDX-License-Identifier: MIT
/**
 * File hashing + lockfile I/O for `grove update`.
 *
 * `grove update` reads three sources of truth per file:
 *
 *   1. The on-disk file (what the consumer has today).
 *   2. `.grove/registry.lock.json` (what we last installed).
 *   3. The upstream registry item JSON — `default.json` as built by
 *      `shadcn build`, with every file's content inlined (what's
 *      upstream).
 *
 * Each is sha256-hashed into a `sha256-<64 hex>` digest. Lockfile
 * entries carry project-relative targets (`src/...`) so the three
 * sides can be joined on one key; this module keeps the I/O minimal
 * so `grove update` can run quickly even on large scaffolds.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type Sha256Hash = `sha256-${string}`;

export function sha256(value: string): Sha256Hash {
  return `sha256-${createHash("sha256").update(value).digest("hex")}` as Sha256Hash;
}

export interface LockfileFile {
  /** Project-relative path (`src/components/grove/...`) — the item's `target` with `~/` stripped. */
  target: string;
  /** Path inside the registry source tree (`default/components/grove/...`) — the item's `path`. */
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
 * Hash the file at `consumerRoot/<target>` (a project-relative lock
 * target such as `src/pages/index.astro`). Returns null if missing.
 */
export async function hashInstalledFile(
  consumerRoot: string,
  target: string,
): Promise<Sha256Hash | null> {
  const filePath = join(consumerRoot, target);
  try {
    const source = await readFile(filePath, "utf8");
    return sha256(source);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Write a fresh lockfile. Called by `grove init` after the scaffold is
 * installed and by `grove update` after applying changes. Creates
 * `.grove/` if needed.
 */
export async function writeLockfile(
  consumerRoot: string,
  lockfile: RegistryLockfile,
): Promise<void> {
  const dir = join(consumerRoot, ".grove");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "registry.lock.json"), `${JSON.stringify(lockfile, null, 2)}\n`, "utf8");
}
