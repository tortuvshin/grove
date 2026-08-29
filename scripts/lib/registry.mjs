// SPDX-License-Identifier: MIT
/**
 * Shared model of the Grove UI registry, used by every script that
 * reads it (build, check, example-mirror) so they can never disagree
 * about what the registry contains.
 *
 * The registry is an ordinary shadcn registry:
 *
 *   packages/registry/registry.json     hand-authored, official schema
 *   packages/registry/default/**        the item sources it points at
 *   packages/registry/dist/r/*.json     `shadcn build` output (published
 *                                       to npm, and served from
 *                                       https://withgrove.dev/r/)
 *
 * Items are feature-level blocks (home, browse, record, …) whose files
 * carry explicit `target`s under `~/src/`. The source tree is laid out
 * exactly like the consumer's `src/` because the `.astro` files use
 * relative imports — the layout *is* the import contract, so it can be
 * type-checked in place.
 *
 * Two things here go beyond what the schema expresses, and both are
 * enforced by `validateRegistry()`:
 *
 *   - `registryDependencies` are derived from the files' relative
 *     imports and must match what each item declares exactly. A
 *     component moving between items, or a new cross-item import,
 *     fails the build instead of silently shipping an item that
 *     doesn't install cleanly on its own.
 *   - Every file under `default/` must belong to exactly one item, or
 *     be listed in `DEFAULT_ONLY_FILES` — files that ship only as part
 *     of the full scaffold and are not worth an item of their own.
 *
 * The full scaffold (`default`) is generated at build time: every
 * item's files inlined into one block, so `shadcn add <path-to-
 * default.json>` works offline with no registry lookups.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";

export const ROOT = resolve(import.meta.dirname, "../..");
export const REGISTRY_DIR = resolve(ROOT, "packages/registry");
export const REGISTRY_JSON = resolve(REGISTRY_DIR, "registry.json");
export const SOURCE_DIR = resolve(REGISTRY_DIR, "default");
/** Generated registry (source items + `default`) that `shadcn build` reads. Gitignored. */
export const BUILD_JSON = resolve(REGISTRY_DIR, "registry.build.json");
export const DIST_DIR = resolve(REGISTRY_DIR, "dist/r");

export const NAMESPACE = "@grove";
export const SCAFFOLD_ITEM = "default";
/** The name `grove init` records in `.grove/registry.lock.json`. */
export const SCAFFOLD_ID = `${NAMESPACE}/${SCAFFOLD_ITEM}`;

/**
 * Files that ship only inside the full `default` scaffold. Nothing
 * else may import them, and they are not part of any feature item.
 */
export const DEFAULT_ONLY_FILES = [
  // Empty-state fixture for `grove audit`'s "empty" page type.
  "default/pages/empty.astro",
];

const VALID_FILE_TYPES = new Set([
  "registry:page",
  "registry:component",
  "registry:ui",
  "registry:lib",
  "registry:hook",
  "registry:file",
  "registry:style",
]);
const VALID_ITEM_TYPES = new Set([
  "registry:block",
  "registry:component",
  "registry:ui",
  "registry:lib",
  "registry:style",
  "registry:theme",
  "registry:item",
]);
/** Extensions the shadcn CLI runs through its ts-morph transformers. */
const TRANSFORMED_EXTENSIONS = /\.(ts|tsx|js|jsx)$/;
/** §22 of the v1 architecture spec: these subpaths no longer exist. */
const FORBIDDEN_IMPORTS = [
  /from\s+["']@grove-dev\/astro\/components/,
  /from\s+["']@grove-dev\/astro\/ui/,
  /from\s+["']@grove-dev\/astro\/layouts/,
];
const IGNORED_SOURCE = /(^|\/)(README\.md|\.DS_Store)$|\.(test|spec)\.[cm]?[jt]sx?$/;

export function readRegistry() {
  return JSON.parse(readFileSync(REGISTRY_JSON, "utf8"));
}

export function readRegistryVersion() {
  return JSON.parse(readFileSync(resolve(REGISTRY_DIR, "package.json"), "utf8")).version;
}

/** Every shippable source file, as a path relative to `packages/registry/` (`default/...`). */
export function listSourceFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        const rel = toPosix(relative(REGISTRY_DIR, full));
        if (!IGNORED_SOURCE.test(rel)) out.push(rel);
      }
    }
  };
  walk(SOURCE_DIR);
  return out.sort();
}

export function readSource(path) {
  return readFileSync(resolve(REGISTRY_DIR, path), "utf8");
}

/** `default/components/ui/button.astro` → `~/src/components/ui/button.astro` */
export function expectedTarget(path) {
  return `~/src/${path.replace(/^default\//, "")}`;
}

/** `~/src/components/ui/button.astro` → `src/components/ui/button.astro` */
export function targetToProjectPath(target) {
  return target.replace(/^~\//, "");
}

/** Same digest format as `packages/cli/src/hash.ts`. */
export function sha256(content) {
  return `sha256-${createHash("sha256").update(content).digest("hex")}`;
}

function toPosix(path) {
  return path.split("\\").join("/");
}

/** Resolve a relative import specifier to a registry source path, or null. */
function resolveImport(fromPath, specifier) {
  const base = toPosix(normalize(join(dirname(fromPath), specifier)));
  for (const candidate of [base, `${base}.ts`, `${base}.astro`, `${base}/index.ts`]) {
    if (existsSync(resolve(REGISTRY_DIR, candidate)) && statSync(resolve(REGISTRY_DIR, candidate)).isFile()) {
      return candidate;
    }
  }
  return null;
}

const IMPORT_RE = /from\s+["'](\.{1,2}\/[^"'\n]+)["']/g;

/** file → files it imports (relative imports only; package imports are not part of the registry graph). */
export function importGraph(files) {
  const graph = new Map();
  for (const file of files) {
    const deps = new Set();
    const source = readSource(file);
    for (const match of source.matchAll(IMPORT_RE)) {
      const resolved = resolveImport(file, match[1]);
      if (resolved) deps.add(resolved);
      else deps.add(`<unresolved:${match[1]}>`);
    }
    graph.set(file, deps);
  }
  return graph;
}

/**
 * Validate the hand-authored registry against the source tree. Returns
 * a list of human-readable problems; empty means the registry is
 * consistent and can be built.
 */
export function validateRegistry(registry = readRegistry()) {
  const errors = [];
  const fail = (message) => errors.push(message);

  if (registry.$schema !== "https://ui.shadcn.com/schema/registry.json") {
    fail(`registry.json: $schema must be the official shadcn schema URL`);
  }
  if (!registry.name) fail("registry.json: missing name");
  if (!Array.isArray(registry.items) || registry.items.length === 0) {
    fail("registry.json: items[] is missing or empty");
    return errors;
  }

  const names = new Set();
  const fileOwner = new Map();
  for (const item of registry.items) {
    if (!item.name) fail("an item is missing its name");
    if (names.has(item.name)) fail(`${item.name}: duplicate item name`);
    names.add(item.name);
    if (item.name === SCAFFOLD_ITEM) {
      fail(`${item.name}: reserved — the full scaffold is generated at build time`);
    }
    if (!VALID_ITEM_TYPES.has(item.type)) fail(`${item.name}: invalid item type "${item.type}"`);
    if (!item.title) fail(`${item.name}: missing title`);
    if (!item.description) fail(`${item.name}: missing description`);
    if (!Array.isArray(item.files) || item.files.length === 0) {
      fail(`${item.name}: files[] is missing or empty`);
      continue;
    }
    for (const file of item.files) {
      const label = `${item.name}: ${file.path}`;
      if (!file.path) {
        fail(`${item.name}: a file entry is missing its path`);
        continue;
      }
      if (!file.path.startsWith("default/")) fail(`${label}: path must live under default/`);
      if (!existsSync(resolve(REGISTRY_DIR, file.path))) fail(`${label}: does not exist on disk`);
      if (!VALID_FILE_TYPES.has(file.type)) fail(`${label}: invalid file type "${file.type}"`);
      if (file.target !== expectedTarget(file.path)) {
        fail(`${label}: target must be "${expectedTarget(file.path)}" (got "${file.target ?? "none"}")`);
      }
      // The CLI rewrites imports, strips comments, and reformats
      // anything it treats as code. Registry files must land
      // byte-identical (grove update's three-way diff hashes them),
      // so code files opt out of the transformer via registry:file.
      if (TRANSFORMED_EXTENSIONS.test(file.path) && file.type !== "registry:file") {
        fail(`${label}: .ts/.js files must be type registry:file (the shadcn CLI transforms other types)`);
      }
      if (file.path.endsWith(".css") && file.type !== "registry:file") {
        fail(`${label}: .css files must be type registry:file`);
      }
      if (file.path.startsWith("default/pages/") && file.path.endsWith(".astro") && file.type !== "registry:page") {
        fail(`${label}: route files must be type registry:page`);
      }
      if (fileOwner.has(file.path)) {
        fail(`${label}: already shipped by item "${fileOwner.get(file.path)}"`);
      }
      fileOwner.set(file.path, item.name);
    }
    for (const dep of item.registryDependencies ?? []) {
      if (!dep.startsWith(`${NAMESPACE}/`)) {
        fail(`${item.name}: registryDependencies must be namespaced (${NAMESPACE}/…), got "${dep}"`);
      }
    }
  }

  // Coverage: every source file is either in exactly one item or default-only.
  const sources = listSourceFiles();
  for (const path of sources) {
    if (!fileOwner.has(path) && !DEFAULT_ONLY_FILES.includes(path)) {
      fail(`${path}: not shipped by any item (add it to an item or to DEFAULT_ONLY_FILES)`);
    }
  }
  for (const path of DEFAULT_ONLY_FILES) {
    if (!existsSync(resolve(REGISTRY_DIR, path))) fail(`DEFAULT_ONLY_FILES: ${path} does not exist`);
    if (fileOwner.has(path)) fail(`${path}: listed in DEFAULT_ONLY_FILES but also shipped by "${fileOwner.get(path)}"`);
  }

  // Dependencies: derived from imports must equal what's declared.
  const graph = importGraph(sources);
  for (const item of registry.items) {
    const derived = new Set();
    for (const file of item.files ?? []) {
      for (const imported of graph.get(file.path) ?? []) {
        if (imported.startsWith("<unresolved:")) {
          fail(`${item.name}: ${file.path} imports ${imported.slice(1, -1)} which does not resolve inside the registry`);
          continue;
        }
        const owner = fileOwner.get(imported);
        if (!owner) {
          fail(`${item.name}: ${file.path} imports ${imported}, which no item ships`);
        } else if (owner !== item.name) {
          derived.add(`${NAMESPACE}/${owner}`);
        }
      }
    }
    const declared = new Set(item.registryDependencies ?? []);
    for (const dep of derived) {
      if (!declared.has(dep)) fail(`${item.name}: imports from ${dep} but does not declare it in registryDependencies`);
    }
    for (const dep of declared) {
      if (!derived.has(dep)) fail(`${item.name}: declares ${dep} in registryDependencies but imports nothing from it`);
    }
  }

  // Forbidden runtime-UI imports (architecture spec §22).
  for (const path of sources) {
    const source = readSource(path);
    for (const pattern of FORBIDDEN_IMPORTS) {
      const hit = source.match(pattern);
      if (hit) fail(`${path}: forbidden import ${hit[0]} — registry UI must not import runtime UI from @grove-dev/astro`);
    }
  }

  return errors;
}

/**
 * The registry `shadcn build` consumes: the authored items, each
 * stamped with the package version in `meta`, plus the generated full
 * scaffold. Deterministic — no timestamps — so the output is stable.
 */
export function buildFullRegistry(registry = readRegistry(), version = readRegistryVersion()) {
  const items = registry.items.map((item) => ({ ...item, meta: { ...(item.meta ?? {}), version } }));

  const seen = new Set();
  const files = [];
  const dependencies = new Set();
  for (const item of registry.items) {
    for (const dep of item.dependencies ?? []) dependencies.add(dep);
    for (const file of item.files) {
      if (seen.has(file.path)) continue;
      seen.add(file.path);
      files.push({ path: file.path, type: file.type, target: file.target });
    }
  }
  for (const path of DEFAULT_ONLY_FILES) {
    files.push({
      path,
      type: path.startsWith("default/pages/") ? "registry:page" : "registry:file",
      target: expectedTarget(path),
    });
  }

  items.push({
    name: SCAFFOLD_ITEM,
    type: "registry:block",
    title: "Grove default scaffold",
    description:
      "The complete directory site — every item in this registry, inlined, so it installs in one step with no further registry lookups. This is what `grove init` installs.",
    dependencies: [...dependencies].sort(),
    files,
    meta: { version },
  });

  return { ...registry, items };
}

/**
 * Lockfile entries for a built item, in the shape `grove update` reads
 * from `.grove/registry.lock.json` (`packages/cli/src/hash.ts`).
 */
export function lockEntriesFor(item) {
  return item.files
    .map((file) => {
      const content = file.content ?? readSource(file.path);
      return {
        target: targetToProjectPath(file.target),
        source: file.path,
        hash: sha256(content),
        bytes: Buffer.byteLength(content, "utf8"),
      };
    })
    .sort((a, b) => a.target.localeCompare(b.target));
}
