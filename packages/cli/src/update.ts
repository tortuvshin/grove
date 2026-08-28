// SPDX-License-Identifier: MIT
/**
 * `grove update` — three-way reconcile of a consumer's installed
 * scaffold against the registry upstream.
 *
 * Algorithm:
 *   1. Read `.grove/registry.lock.json` (the install-time snapshot).
 *   2. Hash every file under `src/` that the lockfile claims came
 *      from the registry.
 *   3. Hash every file in the bundled registry snapshot.
 *   4. Diff installed vs lock vs registry per file → classification.
 *   5. Apply rules per the table in apps/docs/concepts/registry.md:
 *
 *        unchanged          → skip
 *        upstream_changed   → install new content
 *        new                → install
 *        locally_modified   → preserve, never overwrite
 *        conflict           → preserve + warn
 *        removed            → report, do not delete
 *
 * Output: human-readable table by default, JSON via `--json`.
 *
 * Exit codes (CI-friendly):
 *   0  nothing to do, or apply succeeded
 *   1  no lockfile (consumer was never initialized)
 *   2  conflicts present (caller decides whether to --force)
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { planUpdate, type UpdatePlan } from "./diff.js";
import {
  hashInstalledFile,
  readLockfile,
  sha256,
  writeLockfile,
  type RegistryLockfile,
  type Sha256Hash,
} from "./hash.js";
import { loadManifest } from "./registry-install.js";

export interface UpdateOptions {
  cwd: string;
  /** Print the plan and exit; don't touch disk. */
  check?: boolean;
  /** Print unified diff for every upstream_changed row. */
  diff?: boolean;
  /** Apply changes even when conflicts exist (locally_modified is still preserved). */
  force?: boolean;
  /** Emit JSON instead of the human-readable table. */
  json?: boolean;
}

export interface UpdateSummary {
  plan: UpdatePlan;
  /** Files we wrote to disk during this run. */
  applied: string[];
  /** Files we preserved despite upstream changes. */
  preserved: string[];
  exitCode: 0 | 1 | 2;
}

/**
 * Plan and optionally apply a registry update. Pure-function
 * surface: takes the consumer root and option flags, returns a
 * structured summary. CLI side effects (printing, exit codes) live
 * in `grove update`'s subcommand handler.
 */
export async function runUpdate(options: UpdateOptions): Promise<UpdateSummary> {
  const lock = await readLockfile(options.cwd);
  if (!lock) {
    return {
      plan: emptyPlan(),
      applied: [],
      preserved: [],
      exitCode: 1,
    };
  }
  const installed = await loadManifest();
  const lockMap = mapByTarget(lock.files);
  const installedMap = mapByTarget(installed.files);
  const registryMap = mapByTarget(installed.files);

  const installedHashes = await hashAllInstalled(
    options.cwd,
    installedMap,
  );

  const plan = planUpdate(installedHashes, lockMap, registryMap);

  const applied: string[] = [];
  const preserved: string[] = [];

  if (!options.check) {
    // Apply upstream_changed and new — never locally_modified or conflict.
    for (const target of [...plan.upstream_changed, ...plan.new]) {
      const upstream = installed.files.find((f) => f.target === target);
      if (!upstream) continue;
      const dest = join(options.cwd, "src", target);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, await readFile(join(installedSnapshotDir(), upstream.source), "utf8"));
      applied.push(target);
    }
    // Refresh the lockfile so the next update sees the new hashes.
    const nextLock: RegistryLockfile = {
      scaffold: installed.manifest.name,
      scaffoldVersion: installed.manifest.version,
      installedAt: new Date().toISOString().slice(0, 10),
      fileCount: installed.files.length,
      files: installed.files.map((f) => ({
        target: f.target,
        source: f.source,
        hash: f.hash as Sha256Hash,
        bytes: f.bytes,
      })),
    };
    await writeLockfile(options.cwd, nextLock);
  }

  for (const target of plan.locally_modified) preserved.push(target);
  for (const target of plan.conflict) preserved.push(target);

  const exitCode: 0 | 1 | 2 =
    plan.conflict.length > 0 && !options.force ? 2 : 0;

  return { plan, applied, preserved, exitCode };
}

function emptyPlan(): UpdatePlan {
  return {
    unchanged: [],
    upstream_changed: [],
    new: [],
    locally_modified: [],
    conflict: [],
    removed: [],
  };
}

function mapByTarget<T extends { target: string; hash: string }>(files: T[]): Map<string, Sha256Hash> {
  const map = new Map<string, Sha256Hash>();
  for (const file of files) map.set(file.target, file.hash as Sha256Hash);
  return map;
}

async function hashAllInstalled(
  cwd: string,
  installed: Map<string, Sha256Hash>,
): Promise<Map<string, Sha256Hash | null>> {
  const out = new Map<string, Sha256Hash | null>();
  for (const target of installed.keys()) {
    out.set(target, await hashInstalledFile(cwd, target));
  }
  return out;
}

function installedSnapshotDir(): string {
  // Lazy import to avoid a circular module reference.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { resolveRegistrySnapshotDir } = require("./registry-install.js") as {
    resolveRegistrySnapshotDir: () => string;
  };
  return resolveRegistrySnapshotDir();
}

/**
 * Human-readable summary used by the CLI subcommand's default output.
 */
export function formatPlan(plan: UpdatePlan, applied: string[]): string {
  const lines: string[] = [];
  for (const t of plan.unchanged) lines.push(`✓ ${t} unchanged`);
  for (const t of plan.upstream_changed) lines.push(`↑ ${t} upstream changed`);
  for (const t of plan.new) lines.push(`+ ${t} new`);
  for (const t of plan.locally_modified) lines.push(`! ${t} locally modified — preserved`);
  for (const t of plan.conflict) lines.push(`✗ ${t} conflict — needs manual merge`);
  for (const t of plan.removed) lines.push(`- ${t} removed`);
  lines.push("");
  const applyCount = plan.upstream_changed.length + plan.new.length;
  lines.push(
    `${applyCount} to apply · ${plan.new.length} new · ${plan.locally_modified.length} preserved · ${plan.conflict.length} conflict`,
  );
  if (applied.length > 0) {
    lines.push(`\nApplied ${applied.length} file(s).`);
  }
  return lines.join("\n");
}

export { planUpdate };
export { classify } from "./diff.js";
