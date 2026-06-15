/**
 * Resolve and copy Grove framework templates into a project directory.
 *
 * Templates live inside each framework adapter package
 * (`@grove-dev/astro/templates/<name>`, ...). The CLI looks them
 * up in `node_modules` so that `grove new <dir> --framework <f>`
 * just works after `pnpm add @grove-dev/<framework>`.
 */
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// V1 only ships the Astro adapter. The Next.js and SvelteKit adapters
// still exist as skeleton packages (`packages/nextjs/`, `packages/svelte/`)
// but their templates are not yet functional — `pnpm install` will succeed
// but `pnpm run build` will fail with no pages / components / layouts.
// The CLI therefore does NOT advertise them as scaffold options.
//
// When a real Next.js or Svelte template lands, add the framework back
// to this union AND re-add a matching `FRAMEWORK_LABELS` entry in
// `index.ts`. The `isFramework()` guard below already enforces the union.
export type Framework = "astro";
export type DeployProvider = "vercel" | "netlify" | "cloudflare" | "github-pages" | "none";

export interface TemplateSummary {
  framework: Framework;
  template: string;
  path: string;
  description?: string;
}

/** Frameworks that ship templates inside the adapter package. */
export const SUPPORTED_FRAMEWORKS: readonly Framework[] = ["astro"] as const;

export function isFramework(value: string): value is Framework {
  return (SUPPORTED_FRAMEWORKS as readonly string[]).includes(value);
}

function templatesRoot(framework: Framework): string {
  const pkg = `@grove-dev/${framework}`;
  // Resolve the package's *root* entrypoint. We do not ask for
  // `pkg/package.json` because the V1 package's `exports` field
  // intentionally does not list that subpath — only the
  // user-facing entrypoints (`./components/*`, `./layouts/*`,
  // `./styles.css`) are public. The package root directory is
  // then used to look up `templates/` and `package.json`
  // directly via the filesystem.
  let packageRoot: string;
  try {
    // Walking the node_modules ancestry from the CLI's own
    // location: this works whether the framework adapter was
    // installed as a dep of the consumer's project, as a
    // workspace sibling, or as a global package.
    const here = dirname(fileURLToPath(import.meta.url));
    packageRoot = resolvePackageRoot(pkg, here);
  } catch {
    try {
      packageRoot = resolvePackageRoot(pkg, process.cwd());
    } catch {
      throw new Error(
        `Framework package ${pkg} is not installed.\n` +
          `Run one of:\n` +
          `  pnpm add -g ${pkg}\n` +
          `  pnpm add -D ${pkg}\n` +
          (framework === "astro" ? "then retry: grove new <dir> --framework astro" : ""),
      );
    }
  }
  return resolve(packageRoot, "templates");
}

function resolvePackageRoot(pkg: string, from: string): string {
  let cursor = from;
  for (let i = 0; i < 8; i++) {
    const candidate = join(cursor, "node_modules", pkg);
    if (existsSync(candidate)) return candidate;
    cursor = resolve(cursor, "..");
  }
  throw new Error(`Could not find ${pkg} from ${from}`);
}

/**
 * Walk up from a starting directory looking for `pnpm-workspace.yaml`.
 * That file marks the monorepo root — pnpm convention. We need it for
 * the special case where the package we want to resolve IS the CLI
 * itself (`@grove-dev/cli`): the CLI's `node_modules/@grove-dev/cli`
 * doesn't exist because the CLI is a root package, not a dep of
 * itself. From the monorepo root, `packages/cli` is always canonical.
 *
 * Throws if we never find a `pnpm-workspace.yaml` (we are not inside
 * a monorepo, so `grove run` is the wrong tool anyway).
 */
function findMonorepoRoot(from: string): string {
  let cursor = from;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(cursor, "pnpm-workspace.yaml"))) return cursor;
    const parent = resolve(cursor, "..");
    if (parent === cursor) break; // filesystem root
    cursor = parent;
  }
  throw new Error(
    `Could not find monorepo root (pnpm-workspace.yaml) starting from ${from}. ` +
      `grove run must be executed from inside the grove monorepo.`,
  );
}

/**
 * Resolve a `@grove-dev/*` package's on-disk path. Two strategies:
 *
 *  1. Standard: walk up from `from` looking for `node_modules/<pkg>`.
 *     Works for any package the CLI has as a dep (e.g. `@grove-dev/astro`).
 *  2. Self: if `pkg` is the CLI's own name, look for `packages/<short>`
 *     inside the monorepo root. Necessary because the CLI is a root
 *     package and is not symlinked under its own `node_modules`.
 */
function resolveGrovePackage(pkg: string, from: string): string {
  if (pkg === "@grove-dev/cli") {
    const monorepoRoot = findMonorepoRoot(from);
    const cliPath = join(monorepoRoot, "packages", "cli");
    if (existsSync(cliPath)) return cliPath;
    // Fall through to the standard strategy below; the package might
    // still be findable via a globally installed `grove` layout.
  }
  return resolvePackageRoot(pkg, from);
}

/** List every available template for a framework. */
export async function listTemplates(framework: Framework): Promise<TemplateSummary[]> {
  const root = templatesRoot(framework);
  // No fs.readdir on unknown folders; assume a single 'default' template per framework.
  return [{ framework, template: "default", path: join(root, "default") }];
}

/** Resolve the absolute path of a framework template directory. */
export function templatePath(framework: Framework, name = "default"): string {
  return join(templatesRoot(framework), name);
}

/**
 * Read the version of the framework adapter package
 * (`@grove-dev/<framework>`) that shipped the templates. This is the
 * fallback for older templates that still contain loose dependencies;
 * current templates already carry exact published versions.
 */
export function frameworkVersion(framework: Framework): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolvePackageRoot(`@grove-dev/${framework}`, here);
  const pkgPath = join(root, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
  if (!pkg.version) {
    throw new Error(`Could not read version of @grove-dev/${framework} from ${pkgPath}`);
  }
  return pkg.version;
}

/**
 * Copy a template directory into a project root. Honors `force: false`
 * by default so an existing project isn't clobbered.
 *
 * V1: the `new` action runs `mkdir(root, { recursive: true })` before
 * we get here, which means `targetRoot` already exists (and is empty)
 * for a fresh scaffold. `cp` with `errorOnExist: true` would reject
 * that empty dir with EEXIST, so we let `cp` overwrite it silently.
 *
 * The non-empty case is handled before the copy: a non-empty
 * `targetRoot` with `force: false` raises up front (partial
 * scaffolds are worse than a hard fail), and `force: true` proceeds
 * and overwrites per `cp`'s `force: true` semantics.
 */
export async function copyTemplate(
  framework: Framework,
  targetRoot: string,
  name = "default",
  options: { force?: boolean } = {},
): Promise<{ from: string; to: string; files: number }> {
  const from = templatePath(framework, name);
  // Guard: refuse to silently produce a partial scaffold. Node's
  // `cp` with `force: false` will skip existing files without
  // raising — which is the worst possible outcome for a scaffolder
  // (the user gets a half-populated project and no error).
  if (existsSync(targetRoot)) {
    const entries = readdirSync(targetRoot);
    if (entries.length > 0 && !options.force) {
      throw new Error(
        `Target directory ${targetRoot} is not empty. ` +
          `Re-run with force: true to overwrite, or pick a different target.`,
      );
    }
  }
  await cp(from, targetRoot, {
    recursive: true,
    force: options.force ?? false,
    errorOnExist: false,
    filter: (source) => {
      const relative = source.slice(from.length).replace(/^[/\\]/, "");
      if (!relative) return true;
      const normalized = relative.replaceAll("\\", "/");
      return !(
        normalized === "node_modules" ||
        normalized.startsWith("node_modules/") ||
        normalized === ".astro" ||
        normalized.startsWith(".astro/") ||
        normalized === "dist" ||
        normalized.startsWith("dist/") ||
        normalized === "data/generated" ||
        normalized.startsWith("data/generated/") ||
        normalized.endsWith("/.DS_Store") ||
        normalized === ".DS_Store"
      );
    },
  });
  // Count the files we actually wrote — used by callers that surface
  // a "(N files)" line in their success message. We walk the
  // destination tree post-copy because Node's `cp` callback doesn't
  // report a file count. The `filter` above matches the exclude
  // list one-to-one, so this count reflects exactly what was copied.
  // (Audit finding: was returning `files: -1` as a sentinel.)
  const copiedFiles = walkDir(targetRoot);
  return { from, to: targetRoot, files: copiedFiles };
}

/**
 * Count the regular files under `dir`, recursively. Used by
 * `copyTemplate` to report a real file count instead of a `-1`
 * sentinel. Symlinks are counted as one file each (we don't follow
 * them — the symlink itself is the artefact, the target is a
 * pre-existing tree we shouldn't be double-counting).
 */
function walkDir(dir: string): number {
  let count = 0;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += walkDir(join(dir, entry.name));
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      count++;
    }
  }
  return count;
}

/**
 * Read the framework's `package.json` from the template, rewrite the
 * `name` to a project-friendly slug, then normalize Grove dependencies
 * for published or local development use.
 *
 * Two rewrite modes are supported:
 *
 *   - `published` (default for `grove new`): pin `@grove-dev/*`
 *     dependencies to the published version of the framework adapter
 *     so a real end user installs from the npm registry.
 *
 *   - `file` (used by `grove run`): rewrite `@grove-dev/*`
 *     dependencies to absolute `file:` paths pointing back at the
 *     monorepo's local `packages/*` siblings. This lets a developer
 *     (or a CI job) scaffold a project from the LOCAL template and
 *     `pnpm install` it without publishing — handy for smoke tests
 *     and template iteration.
 */
export type DepRewriteMode = "published" | "file";

export async function renameProjectInTemplate(
  framework: Framework,
  targetRoot: string,
  projectName: string,
  templateName = "default",
  options: { mode?: DepRewriteMode } = {},
): Promise<{ packageJsonPath: string; finalName: string; rewrittenDeps: string[] }> {
  const mode: DepRewriteMode = options.mode ?? "published";
  const packageJsonPath = join(targetRoot, "package.json");
  const raw = await readFile(packageJsonPath, "utf8");
  const pkg = JSON.parse(raw) as {
    name?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    [k: string]: unknown;
  };
  pkg.name = packageNameFromProjectName(projectName, framework, templateName);
  const rewrittenDeps =
    mode === "published"
      ? rewriteWorkspaceDepsToVersion(pkg, frameworkVersion(framework))
      : rewriteWorkspaceDepsToFile(pkg);
  await writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  return { packageJsonPath, finalName: pkg.name, rewrittenDeps };
}

/**
 * In-place: replace loose or non-semver `@grove-dev/*` dependencies
 * with the supplied published version. Exact versions already present
 * in current templates are preserved.
 *
 * Non-Grove deps are left untouched.
 */
function rewriteWorkspaceDepsToVersion(
  pkg: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  },
  version: string,
): string[] {
  const rewritten: string[] = [];
  for (const section of ["dependencies", "devDependencies", "peerDependencies"] as const) {
    const map = pkg[section];
    if (!map) continue;
    for (const [name, value] of Object.entries(map)) {
      if (!name.startsWith("@grove-dev/")) continue;
      if (value === version) continue;
      // Pin placeholders, git/file URLs that do not exist in the
      // scaffold, or values that do not look like real semver.
      const looksPinned = /^[~^]?\d/.test(value);
      if (!looksPinned) {
        rewritten.push(`${name}: ${value} -> ${version}`);
        map[name] = version;
      }
    }
  }
  return rewritten;
}

/**
 * In-place: rewrite every `@grove-dev/*` dependency in the template's
 * `package.json` to a `link:` URL pointing at the matching package
 * inside the local monorepo. Used by `grove run` to make a freshly
 * scaffolded project installable from this workspace without going
 * through the npm registry or `pnpm-workspace.yaml` membership.
 *
 * We resolve each package by walking the `@grove-dev/cli`'s
 * `node_modules` ancestry, exactly the way `templatesRoot` does —
 * the CLI's own dep tree already mirrors the local monorepo because
 * pnpm creates a symlink at `node_modules/@grove-dev/<pkg>` → real
 * path, so a single `resolvePackageRoot(name, cliLocation)` returns
 * the on-disk path. A direct link avoids repacking the local package
 * dependency graph for every smoke-test scaffold.
 */
function rewriteWorkspaceDepsToFile(pkg: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}): string[] {
  const rewritten: string[] = [];
  // The CLI's own dist/ directory is the only stable reference point
  // we have. From there we walk up to find each `@grove-dev/*` package.
  const cliLocation = dirname(fileURLToPath(import.meta.url));
  for (const section of ["dependencies", "devDependencies", "peerDependencies"] as const) {
    const map = pkg[section];
    if (!map) continue;
    for (const name of Object.keys(map)) {
      if (!name.startsWith("@grove-dev/")) continue;
      let pkgPath: string;
      try {
        pkgPath = realpathSync(resolveGrovePackage(name, cliLocation));
      } catch {
        // Not installed locally (e.g. a future framework like
        // `@grove-dev/svelte` that has no real template in V1). Skip
        // rather than crashing — the user will see a normal pnpm
        // install error and can fix it.
        continue;
      }
      rewritten.push(`${name}: -> link:${pkgPath}`);
      map[name] = `link:${pkgPath}`;
    }
  }
  return rewritten;
}

export function packageNameFromProjectName(name: string, framework: Framework, templateName: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Make the npm name unique-ish per template: e.g. "grove-astro-default"
  return `${slug || "grove-site"}-${framework}-${templateName}`;
}

/**
 * Make sure a directory exists. Async wrapper around `mkdir -p`.
 */
export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

/**
 * Resolve a file path relative to the current module — handy for
 * locating bundled assets the CLI ships with (e.g. .github templates).
 */
export function here(...parts: string[]): string {
  const url = new URL(import.meta.url);
  return resolve(fileURLToPath(url), "..", ...parts);
}

/**
 * Public re-export: `grove run` needs to find the monorepo root to
 * place its scratch project under `<root>/.grove/run/...` and to run
 * `pnpm install --filter` from there. The implementation lives above
 * so this stays a thin alias.
 */
export { findMonorepoRoot };
