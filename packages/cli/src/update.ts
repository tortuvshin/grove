// SPDX-License-Identifier: MIT
/**
 * `grove update` — three-way reconcile of a consumer's installed
 * scaffold against the registry upstream.
 *
 * Algorithm:
 *   1. Read `.grove/registry.lock.json` (the install-time snapshot).
 *   2. Load the upstream `default` item — `--from <path-or-url>`,
 *      else the `@grove` registry URL in components.json, else the
 *      copy bundled with `@grove-dev/registry`.
 *   3. Hash every file on disk the lockfile or the item names.
 *   4. Diff installed vs lock vs upstream per file → classification.
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
import { planUpdate, type UpdatePlan } from "./diff.js";
import {
  hashInstalledFile,
  readLockfile,
  type Sha256Hash,
  writeLockfile,
} from "./hash.js";
import {
  buildLockfile,
  itemLockEntries,
  loadItem,
  resolveBundledItemPath,
  resolveRegistryTemplate,
  SCAFFOLD_ITEM,
  writeItemFiles,
} from "./registry.js";

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
  /** Upstream item to diff against: a local path or an http(s) URL to a built `default.json`. */
  from?: string;
}

export interface UpdateSummary {
  plan: UpdatePlan;
  /** Files we wrote to disk during this run. */
  applied: string[];
  /** Files we preserved despite upstream changes. */
  preserved: string[];
  /** Where the upstream item came from (path or URL). */
  source: string;
  exitCode: 0 | 1 | 2;
}

/**
 * Pick the upstream item. Explicit `--from` wins; then the registry
 * the project configured in components.json; then the item bundled
 * with the installed `@grove-dev/registry` (which tracks the CLI's
 * version, not the latest release — hence the note).
 */
async function resolveUpstreamSource(cwd: string, from?: string): Promise<string> {
  if (from) return from;
  const template = await resolveRegistryTemplate(cwd);
  if (template) return template.replace("{name}", SCAFFOLD_ITEM);
  const bundled = resolveBundledItemPath();
  console.error(
    `[update] no @grove registry in components.json — comparing against the bundled ${bundled}`,
  );
  return bundled;
}

/**
 * Plan and optionally apply a registry update. Takes the consumer
 * root and option flags, returns a structured summary. Printing and
 * exit codes live in `grove update`'s subcommand handler.
 */
export async function runUpdate(options: UpdateOptions): Promise<UpdateSummary> {
  const lock = await readLockfile(options.cwd);
  if (!lock) {
    return {
      plan: emptyPlan(),
      applied: [],
      preserved: [],
      source: options.from ?? "",
      exitCode: 1,
    };
  }
  const source = await resolveUpstreamSource(options.cwd, options.from);
  const item = await loadItem(source);

  const lockMap = mapByTarget(lock.files);
  const upstreamMap = mapByTarget(itemLockEntries(item));
  // Disk state for every target either side knows about — the lock's
  // targets so files upstream dropped classify as `removed`, the
  // item's so brand-new files classify as `new`.
  const installedHashes = await hashAllInstalled(
    options.cwd,
    new Set([...lockMap.keys(), ...upstreamMap.keys()]),
  );

  const plan = planUpdate(installedHashes, lockMap, upstreamMap);

  let applied: string[] = [];
  const preserved: string[] = [];

  if (!options.check) {
    // Apply upstream_changed and new — never locally_modified or conflict.
    applied = await writeItemFiles(item, options.cwd, {
      only: new Set([...plan.upstream_changed, ...plan.new]),
    });
    // Refresh the lockfile so the next update sees the new hashes.
    await writeLockfile(options.cwd, buildLockfile(item));
  }

  for (const target of plan.locally_modified) preserved.push(target);
  for (const target of plan.conflict) preserved.push(target);

  const exitCode: 0 | 1 | 2 =
    plan.conflict.length > 0 && !options.force ? 2 : 0;

  return { plan, applied, preserved, source, exitCode };
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
  targets: Iterable<string>,
): Promise<Map<string, Sha256Hash | null>> {
  const out = new Map<string, Sha256Hash | null>();
  for (const target of targets) {
    out.set(target, await hashInstalledFile(cwd, target));
  }
  return out;
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

export { classify } from "./diff.js";
export { planUpdate };
