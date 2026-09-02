// SPDX-License-Identifier: MIT
/**
 * `grove update` — three-way reconcile of a consumer's installed
 * scaffold against the registry upstream.
 *
 * Algorithm:
 *   1. Read `.grove/registry.lock.json` (the install-time snapshot).
 *   2. Load the upstream `default` item — `--from <path-or-url>`,
 *      else the `@grove` registry URL in components.json, else the
 *      copy bundled inside the CLI.
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
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { planUpdate, type UpdatePlan } from './diff.js';
import {
  hashInstalledFile,
  type RegistryLockfile,
  readLockfile,
  type Sha256Hash,
  writeLockfile,
} from './hash.js';
import {
  itemLockEntries,
  loadItem,
  type RegistryItem,
  resolveBundledItemPath,
  resolveRegistryTemplate,
  SCAFFOLD_ID,
  SCAFFOLD_ITEM,
  targetToProjectPath,
  writeItemFiles,
} from './registry.js';
import { unifiedDiff } from './unified-diff.js';

export interface UpdateOptions {
  cwd: string;
  /**
   * Write a lockfile for a project that has none, instead of failing.
   *
   * A space scaffolded before the lockfile existed — or one whose
   * `.gitignore` swallowed `.grove/` — can never run `grove update`:
   * step 1 finds no lockfile and exits 1, and `grove init` is the wrong
   * tool because it installs a scaffold over a live project. Adoption
   * closes that door by deriving the lockfile from what is already on
   * disk. See `adoptionLockfile` for why it records upstream's hash.
   */
  adopt?: boolean;
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

export interface FileDiff {
  target: string;
  patch: string;
}

export interface UpdateSummary {
  /** True when this run wrote the project's first lockfile. */
  adopted?: boolean;
  /**
   * Set when the scaffold needs a newer `@grove-dev/*` than the project
   * has installed. The scaffold's components read a typed model built by
   * `@grove-dev/astro`; applying registry files without the matching
   * package upgrade fails the type-check inside a component, which points
   * at the symptom rather than at the cause.
   */
  requiresGroveUpgrade?: { required: string; installed: string };
  plan: UpdatePlan;
  /** Files we wrote to disk during this run. */
  applied: string[];
  /** Files we preserved despite upstream changes. */
  preserved: string[];
  /** Unified diffs for the rows upstream moved, when `--diff` is set. */
  diffs: FileDiff[];
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
  if (template) return template.replace('{name}', SCAFFOLD_ITEM);
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
/**
 * Derive a lockfile for a project that never had one.
 *
 * One rule: every upstream file that exists on disk is locked at
 * *upstream's* hash — not at the hash of the file sitting there. That
 * looks backwards until you run it through `classify`:
 *
 *   file matches upstream    installed == lock == registry  → unchanged
 *   file drifted locally     installed != lock, registry == lock
 *                                                          → locally_modified
 *   file absent (no entry)   installed/lock null, registry set → new
 *
 * So adoption preserves every local edit by construction, installs only
 * what the project is genuinely missing, and never overwrites anything.
 * Locking the on-disk hash instead would classify drifted files as
 * `upstream_changed` on the next run and quietly clobber them.
 */
async function adoptionLockfile(cwd: string, item: RegistryItem): Promise<RegistryLockfile> {
  const upstream = itemLockEntries(item);
  const present: typeof upstream = [];
  for (const entry of upstream) {
    if ((await hashInstalledFile(cwd, entry.target)) !== null) present.push(entry);
  }
  return {
    scaffold: SCAFFOLD_ID,
    scaffoldVersion: item.meta?.version ?? '0.0.0',
    installedAt: new Date().toISOString().slice(0, 10),
    fileCount: present.length,
    files: present,
  };
}

/** Numeric compare of two dotted versions; prerelease suffixes are ignored. */
function isOlder(a: string, b: string): boolean {
  const parts = (v: string) =>
    (v.split('-')[0] ?? '').split('.').map((n) => Number.parseInt(n, 10) || 0);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i += 1) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0);
  }
  return false;
}

/** The `@grove-dev/astro` version the consumer actually has installed. */
async function installedGroveVersion(cwd: string): Promise<string | null> {
  try {
    const raw = await readFile(resolve(cwd, 'node_modules/@grove-dev/astro/package.json'), 'utf8');
    return (JSON.parse(raw) as { version?: string }).version ?? null;
  } catch {
    return null;
  }
}

export async function runUpdate(options: UpdateOptions): Promise<UpdateSummary> {
  const existingLock = await readLockfile(options.cwd);
  if (!existingLock && !options.adopt) {
    return {
      plan: emptyPlan(),
      applied: [],
      preserved: [],
      diffs: [],
      source: options.from ?? '',
      exitCode: 1,
    };
  }
  const source = await resolveUpstreamSource(options.cwd, options.from);
  const item = await loadItem(source);
  const lock = existingLock ?? (await adoptionLockfile(options.cwd, item));
  const adopted = !existingLock;
  // Adoption has to land on disk even under `--check`; otherwise the
  // caller gets a plan derived from a lockfile that does not exist and
  // the next run starts over from nothing.
  if (adopted) await writeLockfile(options.cwd, lock);

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

  // `--force` takes the upstream side of a conflict, which is what the
  // flag has always claimed to do. `locally_modified` is never in this
  // set: the user edited a file upstream did not touch, so there is
  // nothing to merge and overwriting would only destroy their work.
  const toWrite = new Set([...plan.upstream_changed, ...plan.new]);
  if (options.force) for (const target of plan.conflict) toWrite.add(target);

  const diskBefore = options.diff
    ? await readInstalled(options.cwd, [...plan.upstream_changed, ...plan.conflict])
    : new Map<string, string>();

  let applied: string[] = [];
  if (!options.check) {
    applied = await writeItemFiles(item, options.cwd, { only: toWrite });
    await writeLockfile(options.cwd, nextLockfile(lock, item, plan, new Set(applied)));
  }

  const preserved: string[] = [];
  for (const target of plan.locally_modified) preserved.push(target);
  for (const target of plan.conflict) if (!toWrite.has(target)) preserved.push(target);

  // Diffs are computed before anything is written when `--check` is on,
  // and against the pre-write content otherwise — either way they show
  // what the upstream change does to the file the user has today.
  const diffs = options.diff ? await buildDiffs(item, options.cwd, plan, diskBefore) : [];

  const exitCode: 0 | 1 | 2 = plan.conflict.length > 0 && !options.force ? 2 : 0;

  const required = item.meta?.requiresGrove;
  const installedGrove = required ? await installedGroveVersion(options.cwd) : null;
  const staleGrove =
    required && installedGrove && isOlder(installedGrove, required)
      ? { required, installed: installedGrove }
      : undefined;

  return {
    ...(adopted ? { adopted: true } : {}),
    ...(staleGrove ? { requiresGroveUpgrade: staleGrove } : {}),
    plan,
    applied,
    preserved,
    diffs,
    source,
    exitCode,
  };
}

/**
 * Unified diffs for every row where upstream moved — `upstream_changed`
 * and `conflict`. A `locally_modified` row has no upstream change to
 * show, and `new` has nothing to diff against.
 */
async function buildDiffs(
  item: RegistryItem,
  cwd: string,
  plan: UpdatePlan,
  before: Map<string, string>,
): Promise<FileDiff[]> {
  const upstream = new Map(
    item.files.map((file) => [targetToProjectPath(file.target), file.content]),
  );
  const diffs: FileDiff[] = [];
  for (const target of [...plan.upstream_changed, ...plan.conflict]) {
    const after = upstream.get(target);
    if (after === undefined) continue;
    const patch = unifiedDiff(before.get(target) ?? '', after, target);
    if (patch) diffs.push({ target, patch });
  }
  return diffs;
}

/**
 * The lockfile records what this project is reconciled to — not what
 * upstream happens to ship.
 *
 * Stamping the whole upstream item, including files we deliberately
 * refused to overwrite, made the lock claim content that was never
 * written. The next run then saw `registry === lock` for those files and
 * reclassified a `conflict` as a mere `locally_modified`, dropping the
 * exit code from 2 to 0. A pending upstream change was reported exactly
 * once and then never again, and `scaffoldVersion` advertised a version
 * the project was not on.
 *
 * So: upstream entries for files we wrote, previous entries for files we
 * preserved, and `scaffoldVersion` only advances once no conflict is
 * left unresolved.
 */
function nextLockfile(
  lock: RegistryLockfile,
  item: RegistryItem,
  plan: UpdatePlan,
  written: Set<string>,
): RegistryLockfile {
  const previous = new Map(lock.files.map((file) => [file.target, file]));
  const preserved = new Set(
    [...plan.locally_modified, ...plan.conflict].filter((target) => !written.has(target)),
  );
  const files = itemLockEntries(item).map((entry) => {
    const carried = preserved.has(entry.target) ? previous.get(entry.target) : undefined;
    return carried ?? entry;
  });
  const unresolved = plan.conflict.some((target) => !written.has(target));
  return {
    scaffold: SCAFFOLD_ID,
    scaffoldVersion: unresolved ? lock.scaffoldVersion : (item.meta?.version ?? '0.0.0'),
    installedAt: new Date().toISOString().slice(0, 10),
    fileCount: files.length,
    files,
  };
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

function mapByTarget<T extends { target: string; hash: string }>(
  files: T[],
): Map<string, Sha256Hash> {
  const map = new Map<string, Sha256Hash>();
  for (const file of files) map.set(file.target, file.hash as Sha256Hash);
  return map;
}

async function readInstalled(cwd: string, targets: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const target of targets) {
    try {
      out.set(target, await readFile(resolve(cwd, target), 'utf8'));
    } catch {
      // Missing on disk — the diff renders as an addition.
    }
  }
  return out;
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
 *
 * The tallies describe the run that actually happened: a conflict taken
 * by `--force` counts as applied, not as an outstanding conflict, so the
 * footer never reads "0 to apply" above "Applied 1 file(s)".
 */
export function formatPlan(summary: UpdateSummary): string {
  const { plan, applied, diffs } = summary;
  const wrote = new Set(applied);
  const forced = plan.conflict.filter((target) => wrote.has(target));
  const outstanding = plan.conflict.filter((target) => !wrote.has(target));

  const lines: string[] = [];
  if (summary.adopted) {
    lines.push(
      'Adopted this project: wrote .grove/registry.lock.json from what was already on disk.',
      'Files that differ from upstream are recorded as locally modified and will never be overwritten.',
      '',
    );
  }
  for (const t of plan.unchanged) lines.push(`✓ ${t} unchanged`);
  for (const t of plan.upstream_changed) lines.push(`↑ ${t} upstream changed`);
  for (const t of plan.new) lines.push(`+ ${t} new`);
  for (const t of plan.locally_modified) lines.push(`! ${t} locally modified — preserved`);
  for (const t of forced) lines.push(`✗ ${t} conflict — took upstream (--force)`);
  for (const t of outstanding) lines.push(`✗ ${t} conflict — needs manual merge`);
  for (const t of plan.removed) lines.push(`- ${t} removed`);
  lines.push('');
  const applyCount = plan.upstream_changed.length + plan.new.length + forced.length;
  lines.push(
    `${applyCount} to apply · ${plan.new.length} new · ${summary.preserved.length} preserved · ${outstanding.length} conflict`,
  );
  if (applied.length > 0) {
    lines.push(`\nApplied ${applied.length} file(s).`);
  }
  if (summary.requiresGroveUpgrade) {
    const { required, installed } = summary.requiresGroveUpgrade;
    lines.push(
      '',
      `This scaffold expects @grove-dev/* ${required}; this project has ${installed}.`,
      'The scaffold reads a typed model the packages build, so upgrade them too:',
      `  pnpm add @grove-dev/core@${required} @grove-dev/astro@${required} @grove-dev/cli@${required}`,
    );
  }
  for (const diff of diffs) {
    lines.push('', diff.patch);
  }
  return lines.join('\n');
}

export { classify } from './diff.js';
export { planUpdate };
