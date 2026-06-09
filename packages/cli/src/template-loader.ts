/**
 * Resolve and copy Grove framework templates into a project directory.
 *
 * Templates live inside each framework adapter package
 * (`@grove-dev/astro/templates/<name>`, ...). The CLI looks them
 * up in `node_modules` so that `grove new <dir> --framework <f>`
 * just works after `pnpm add @grove-dev/<framework>`.
 */
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

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
  // Resolve from the CLI's own location so the framework package is
  // found whether it was installed as a dep of the consumer's project
  // or as a workspace sibling during local dev.
  let entrypoint: string;
  try {
    entrypoint = require.resolve(`${pkg}/package.json`, { paths: [process.cwd()] });
  } catch {
    try {
      entrypoint = require.resolve(`${pkg}/package.json`);
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
  return resolve(dirname(entrypoint), "templates");
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
  const entrypoint = require.resolve(`@grove-dev/${framework}/package.json`);
  const pkg = JSON.parse(readFileSync(entrypoint, "utf8")) as { version?: string };
  if (!pkg.version) {
    throw new Error(`Could not read version of @grove-dev/${framework} from ${entrypoint}`);
  }
  return pkg.version;
}

/**
 * Copy a template directory into a project root. Honors `force: false`
 * by default so an existing project isn't clobbered.
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
    errorOnExist: !(options.force ?? false),
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
 * In-place: replace `workspace:*` (and `workspace:^x.y.z`) for any
 * `@grove-dev/*` package with the supplied published version. The
 * monorepo's templates are written that way so the framework adapter
 * can be developed against its own sibling packages, but a fresh
 * scaffold is not part of that monorepo and would fail to install.
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
      if (name.startsWith("@grove-dev/") && value.startsWith("workspace:")) {
        map[name] = version;
        rewritten.push(`${name}: ${value} -> ${version}`);
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
