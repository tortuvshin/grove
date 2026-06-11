/**
 * Resolve and copy Grove framework templates into a project directory.
 *
 * Templates live inside each framework adapter package
 * (`@grove-dev/astro/templates/<name>`, ...). The CLI looks them
 * up in `node_modules` so that `grove new <dir> --framework <f>`
 * just works after `pnpm add @grove-dev/<framework>`.
 */
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type Framework = "astro" | "nextjs" | "svelte";
export type DeployProvider = "vercel" | "netlify" | "cloudflare" | "github-pages" | "none";

export interface TemplateSummary {
  framework: Framework;
  template: string;
  path: string;
  description?: string;
}

/** Frameworks that ship templates inside the adapter package. */
export const SUPPORTED_FRAMEWORKS: readonly Framework[] = ["astro", "nextjs", "svelte"] as const;

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
 * (`@grove-dev/<framework>`) that shipped the templates. We use this
 * to rewrite `workspace:*` dependencies in the scaffolded `package.json`
 * into a real published version, so the new project can `pnpm install`
 * from the npm registry instead of from the local monorepo workspace.
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
 * V1: when `targetRoot` already exists (and is empty, the typical
 * fresh-scaffold case), `mkdir(root, { recursive: true })` from the
 * `new` action creates it before we get here, which makes
 * `errorOnExist: true` reject with EEXIST. We let `cp` overwrite
 * the existing-but-empty dir silently rather than fail with a
 * confusing error. `force: true` callers (re-scaffold) get a real
 * failure when the dir is non-empty so we don't clobber work.
 */
export async function copyTemplate(
  framework: Framework,
  targetRoot: string,
  name = "default",
  options: { force?: boolean } = {},
): Promise<{ from: string; to: string; files: number }> {
  const from = templatePath(framework, name);
  await cp(from, targetRoot, {
    recursive: true,
    force: options.force ?? false,
    errorOnExist: false,
  });
  return { from, to: targetRoot, files: -1 };
}

/**
 * Read the framework's `package.json` from the template and rewrite
 * the `name` to a project-friendly slug, then rewrite any
 * `workspace:*` Grove dependencies into the published version of
 * the framework adapter so the new project installs from npm
 * instead of trying to resolve local monorepo paths.
 */
export async function renameProjectInTemplate(
  framework: Framework,
  targetRoot: string,
  projectName: string,
  templateName = "default",
): Promise<{ packageJsonPath: string; finalName: string; rewrittenDeps: string[] }> {
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
  const rewrittenDeps = rewriteWorkspaceDeps(pkg, frameworkVersion(framework));
  await writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  return { packageJsonPath, finalName: pkg.name, rewrittenDeps };
}

/**
 * In-place: pin every `@grove-dev/*` dependency in the template's
 * `package.json` to the supplied published version. The templates
 * ship with placeholders like `workspace:*` (monorepo-internal
 * mode) or `*` (any version — too loose) so the framework adapter
 * can be developed against its own sibling packages, but a fresh
 * scaffold is not part of that monorepo and needs a real version
 * pin or `pnpm install` will either fail (`workspace:*` has no
 * registry match) or pull a breaking change (`*` is unpinned).
 *
 * Non-Grove deps are left untouched.
 */
function rewriteWorkspaceDeps(
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
      // Pin anything that's a placeholder: workspace:* (monorepo), *
      // (any version), git/file URLs that don't exist in the
      // scaffold, or versions that don't look like a real semver.
      const looksPinned = /^[~^]?\d/.test(value);
      if (!looksPinned) {
        rewritten.push(`${name}: ${value} -> ${version}`);
        map[name] = version;
      }
    }
  }
  return rewritten;
}

function packageNameFromProjectName(name: string, framework: Framework, templateName: string): string {
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
