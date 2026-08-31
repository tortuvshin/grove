// SPDX-License-Identifier: MIT
/**
 * The CLI's view of the Grove UI registry.
 *
 * Grove's UI ships as an ordinary shadcn registry (built from
 * `packages/registry`, a workspace-private build unit):
 * hand-authored `registry.json`, built by the official `shadcn build`
 * into one JSON document per item with every file's content inlined.
 * The full scaffold — every item in the registry, in one block — is
 * the generated `default` item. That single document is what both
 * `grove init` and `grove update` consume:
 *
 *   grove init    → `shadcn add <path to default.json>` installs it,
 *                   then this module records the install-time hashes
 *                   in `.grove/registry.lock.json`.
 *   grove update  → loads the upstream `default` item (a URL, a path,
 *                   or the copy bundled inside the CLI itself),
 *                   three-way diffs it against the lockfile and disk,
 *                   and writes the safe subset of files itself.
 *
 * The lockfile shape and hash format are shared with the monorepo's
 * `scripts/lib/registry.mjs` (which maintains the example app's copy)
 * — the two must agree byte-for-byte or `grove update` reports
 * phantom drift.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type LockfileFile, type RegistryLockfile, sha256 } from './hash.js';

/** The registry namespace consumers configure in `components.json`. */
export const REGISTRY_NAMESPACE = '@grove';
/** Where the built items are served; `{name}` is the shadcn placeholder. */
export const REGISTRY_URL_TEMPLATE = 'https://withgrove.dev/r/{name}.json';
/** The shadcn CLI release `grove init` drives. Pinned: item install behavior is version-specific. */
export const SHADCN_VERSION = '4.19.0';
/** The generated full-scaffold item. */
export const SCAFFOLD_ITEM = 'default';
/** What `.grove/registry.lock.json` records as `scaffold`. */
export const SCAFFOLD_ID = `${REGISTRY_NAMESPACE}/${SCAFFOLD_ITEM}`;

export interface RegistryItemFile {
  /** Path inside the registry source tree (`default/components/ui/badge.astro`). */
  path: string;
  type: string;
  /** Install location; `~/` is the consumer's project root. */
  target: string;
  /** Full file content, inlined by `shadcn build`. */
  content: string;
}

/** A built registry item (`dist/r/<name>.json`, official registry-item schema). */
export interface RegistryItem {
  name: string;
  type: string;
  title?: string;
  description?: string;
  dependencies?: string[];
  registryDependencies?: string[];
  meta?: { version?: string };
  files: RegistryItemFile[];
}

/**
 * Locate a built item in the copy the CLI ships beside its own code.
 *
 * `@grove-dev/registry` is a workspace build unit, not a published
 * package — nothing installs it, and consumers never import it. The
 * CLI's build step copies `packages/registry/dist/r/` to
 * `packages/cli/dist/r/`, so the scaffold travels inside the CLI
 * tarball and `grove init` works offline.
 */
export function resolveBundledItemPath(name = SCAFFOLD_ITEM): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // Published / built: dist/index.js sits beside dist/r/.
    join(here, 'r', `${name}.json`),
    // Running from source (vitest, tsx): src/ has no r/, dist/ does.
    join(here, '..', 'dist', 'r', `${name}.json`),
    // Monorepo source before the CLI has been rebuilt.
    join(here, '..', '..', 'registry', 'dist', 'r', `${name}.json`),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(
      `Registry item "${name}" is not bundled with this CLI. Looked in:\n` +
        candidates.map((candidate) => `  ${candidate}`).join('\n') +
        '\nIn the Grove monorepo run `pnpm registry:build`; otherwise reinstall @grove-dev/cli.',
    );
  }
  return found;
}

function isUrl(source: string): boolean {
  return /^https?:\/\//.test(source);
}

/**
 * Load and validate a built registry item from a local path or an
 * http(s) URL. Every file must carry inlined `content` and a `target`
 * — that is what `shadcn build` emits, and what both install paths
 * need; a hand-written item without them is rejected up front.
 */
export async function loadItem(source: string): Promise<RegistryItem> {
  let raw: string;
  if (isUrl(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Could not fetch registry item ${source}: HTTP ${response.status}`);
    }
    raw = await response.text();
  } else {
    raw = await readFile(isAbsolute(source) ? source : resolve(source), 'utf8');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Registry item ${source} is not valid JSON.`);
  }
  const item = parsed as Partial<RegistryItem>;
  if (typeof item.name !== 'string' || !Array.isArray(item.files)) {
    throw new Error(`Registry item ${source} is missing "name" or "files".`);
  }
  for (const file of item.files) {
    if (typeof file.content !== 'string') {
      throw new Error(
        `Registry item ${source}: ${file.path ?? 'a file'} has no inlined content (was it built with \`shadcn build\`?).`,
      );
    }
    if (typeof file.target !== 'string' || file.target.length === 0) {
      throw new Error(`Registry item ${source}: ${file.path ?? 'a file'} has no target.`);
    }
  }
  return item as RegistryItem;
}

/** `~/src/components/ui/button.astro` → `src/components/ui/button.astro` */
export function targetToProjectPath(target: string): string {
  return target.replace(/^~\//, '');
}

/**
 * Lockfile entries for an item, sorted by target — the same shape and
 * digest `scripts/lib/registry.mjs` computes for the example app.
 */
export function itemLockEntries(item: RegistryItem): LockfileFile[] {
  return item.files
    .map((file) => ({
      target: targetToProjectPath(file.target),
      source: file.path,
      hash: sha256(file.content),
      bytes: Buffer.byteLength(file.content, 'utf8'),
    }))
    .sort((a, b) => a.target.localeCompare(b.target));
}

export function buildLockfile(item: RegistryItem): RegistryLockfile {
  const files = itemLockEntries(item);
  return {
    scaffold: SCAFFOLD_ID,
    scaffoldVersion: item.meta?.version ?? '0.0.0',
    installedAt: new Date().toISOString().slice(0, 10),
    fileCount: files.length,
    files,
  };
}

/**
 * Write an item's files into a project, verbatim. `grove update` uses
 * this to apply the files its plan says are safe (`only` = those
 * project-relative targets); tests use it as a no-network stand-in
 * for `shadcn add`. Returns the project-relative paths written.
 */
export async function writeItemFiles(
  item: RegistryItem,
  cwd: string,
  options: { only?: Set<string> } = {},
): Promise<string[]> {
  const written: string[] = [];
  for (const file of item.files) {
    const projectPath = targetToProjectPath(file.target);
    if (options.only && !options.only.has(projectPath)) continue;
    const dest = join(cwd, projectPath);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, file.content, 'utf8');
    written.push(projectPath);
  }
  return written;
}

/**
 * The `@grove` registry URL template from the project's
 * `components.json`, or null when the file or the entry is absent.
 * shadcn accepts either a bare string or `{ url, headers? }`.
 */
export async function resolveRegistryTemplate(cwd: string): Promise<string | null> {
  let raw: string;
  try {
    raw = await readFile(join(cwd, 'components.json'), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  const config = JSON.parse(raw) as {
    registries?: Record<string, string | { url?: string }>;
  };
  const entry = config.registries?.[REGISTRY_NAMESPACE];
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry.url === 'string') return entry.url;
  return null;
}
