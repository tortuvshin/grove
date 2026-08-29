// SPDX-License-Identifier: MIT
/**
 * `grove init` — registry bootstrapper.
 *
 * `grove init` does, and only does:
 *
 *   1. Install the @grove/default scaffold into src/ (also writes
 *      `.grove/registry.lock.json` recording install-time hashes,
 *      consumed later by `grove update`).
 *   2. Write package.json — Grove packages pinned to the CLI version,
 *      plus the scaffold's own npm dependencies/devDependencies/
 *      scripts, straight from the registry manifest.
 *   3. Write grove.config.ts (project-specific, so the scaffold
 *      doesn't ship one — this generates a fresh template).
 *   4. Write astro.config.mjs (registers the Grove integration and
 *      the Tailwind v4 Vite plugin the scaffold's styles need).
 *   5. Write tsconfig.json (Bundler resolution + the @grove/generated
 *      path alias — the scaffold's own code needs both).
 *   6. Create an empty data/records/ (with a .gitkeep placeholder,
 *      since git doesn't track empty directories) — required so
 *      `grove check` doesn't fail on a project nobody has added a
 *      record to yet.
 *
 * The scaffold — including its page routes — is shipped from
 * `@grove-dev/registry` and materialized by `materializeRegistry()`.
 * There is no second template to maintain in this repo and no
 * fallback path — if the registry snapshot is missing, init fails
 * fast with a clear message.
 *
 * `grove init` does NOT scaffold `content/`, `public/`, `.github/`,
 * or anything under `data/` besides the empty `records/` directory
 * (no `data/taxonomy/`, `data/collections/`) — those are
 * content/workflow concerns, not UI-registry concerns, and are out
 * of scope here. (The CLI wrapper in index.ts runs `pnpm install`
 * and `git init` after this returns, per its own `--no-install`/
 * `--no-git` flags.)
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  materializeRegistry,
  type InstalledScaffold,
} from "./registry-install.js";

const SKIP_NAMES = new Set(["node_modules", "dist", ".astro", ".DS_Store", ".grove"]);
const GROVE_PACKAGES = [
  "@grove-dev/core",
  "@grove-dev/astro",
  "@grove-dev/cli",
  "@grove-dev/registry",
] as const;

export interface InitOptions {
  projectName?: string;
  version?: string;
}

export interface InitResult {
  targetDir: string;
  projectName: string;
  installedScaffold: InstalledScaffold;
}

export function readCliVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [resolve(here, "package.json"), resolve(here, "../package.json")]) {
    try {
      const pkg = JSON.parse(requireText(candidate)) as { version?: string };
      if (pkg.version) return pkg.version;
    } catch {
      // Source and published layouts intentionally use different paths.
    }
  }
  return "0.0.0-dev";
}

function requireText(path: string): string {
  // Synchronous version lookup happens once while constructing the CLI.
  return globalThis.process.getBuiltinModule("node:fs").readFileSync(path, "utf8");
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function packageName(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "grove-directory"
  );
}

async function ensureEmpty(targetDir: string): Promise<void> {
  await mkdir(targetDir, { recursive: true });
  const { readdir } = await import("node:fs/promises");
  const entries = (await readdir(targetDir)).filter((entry) => !SKIP_NAMES.has(entry));
  if (entries.length > 0) {
    throw new Error(`${targetDir} is not empty. Choose a new directory.`);
  }
}

/**
 * Bootstrap a Grove directory by installing the @grove/default
 * registry scaffold. Returns the manifest of what was installed
 * so callers can report it to the user.
 */
export async function initDirectory(
  targetDir: string,
  options: InitOptions = {},
): Promise<InitResult> {
  const target = resolve(targetDir);
  await ensureEmpty(target);

  const version = options.version ?? readCliVersion();
  const fallbackName = target.split(/[\\/]/).at(-1) ?? "grove-directory";
  const rawName = options.projectName ?? fallbackName;
  const projectName = packageName(rawName);

  // 1. Materialize the @grove/default scaffold into src/. This also
  //    writes `.grove/registry.lock.json` recording the install-time
  //    hashes (consumed by `grove update`), and gives us the scaffold
  //    manifest so step 2 can install what it actually declares.
  const installed = await materializeRegistry(target);

  // 2. Write package.json — Grove packages pinned to the CLI version,
  //    plus the scaffold's own npm dependencies straight from its
  //    manifest (registry.json declares package names, not version
  //    ranges, so those resolve against "latest" at install time).
  const packagePath = resolve(target, "package.json");
  const pkg: {
    name: string;
    type?: string;
    scripts?: Record<string, string>;
    dependencies: Record<string, string>;
    devDependencies?: Record<string, string>;
  } = {
    name: projectName,
    type: "module",
    dependencies: {},
  };
  for (const dep of GROVE_PACKAGES) pkg.dependencies[dep] = `^${version}`;
  for (const dep of installed.manifest.dependencies) pkg.dependencies[dep] = "latest";
  if (installed.manifest.devDependencies?.length) {
    pkg.devDependencies = {};
    for (const dep of installed.manifest.devDependencies) pkg.devDependencies[dep] = "latest";
  }
  if (installed.manifest.scripts) pkg.scripts = installed.manifest.scripts;
  await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");

  // 3. Write grove.config.ts. The scaffold doesn't ship one (it's
  //    project-specific), so we generate a fresh template and
  //    substitute the project name.
  const configPath = resolve(target, "grove.config.ts");
  const configTemplate = `import { defineConfig } from "@grove-dev/core";

export default defineConfig({
  blueprint: "project-directory",

  site: {
    name: ${JSON.stringify(titleCase(rawName))},
    tagline: "A Grove-powered directory.",
    description: "",
    url: "https://example.com",
  },

  nav: [
    { label: "Home", href: "/" },
    { label: "Browse", href: "/projects" },
    { label: "About", href: "/about" },
  ],

  browse: {
    facets: ["category", "stack", "platform", "license"],
  },

  theme: { radius: "soft", density: "comfortable", containerWidth: "72rem" },
});
`;
  await writeFile(configPath, configTemplate, "utf8");

  // 4. Write astro.config.mjs. Without this the scaffold's Tailwind
  //    v4 styles (`@import "tailwindcss"` in styles/system.css) never
  //    get processed — the Vite plugin has to be registered somewhere,
  //    and there's no second template shipping one.
  const astroConfigPath = resolve(target, "astro.config.mjs");
  const astroConfigTemplate = `// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import groveAstro from "@grove-dev/astro";
import { loadConfig } from "@grove-dev/core";

// \`site\` is the canonical URL the build uses for absolute links
// (sitemap, OpenGraph, canonical tags, JSON-LD). Read from
// grove.config.ts and overridable per build via SITE_URL.
const groveConfig = await loadConfig();

export default defineConfig({
  site: process.env.SITE_URL || groveConfig.site.url,
  trailingSlash: "ignore",
  integrations: [groveAstro()],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    format: "directory",
  },
});
`;
  await writeFile(astroConfigPath, astroConfigTemplate, "utf8");

  // 5. Write tsconfig.json. Not shipped via the registry — everything
  //    materializeRegistry() writes lands under src/, but a tsconfig
  //    has to sit at the project root to be picked up at all. The
  //    scaffold's own code relies on two settings Astro's own default
  //    (when no tsconfig exists) doesn't set: "Bundler" resolution
  //    (registry components import package subpaths like
  //    `@grove-dev/astro/server` whose declaration file lives in the
  //    package's own src/, which classic/node resolution can't follow)
  //    and the `@grove/generated/*` path alias (so `astro check`
  //    resolves the JSON `prepareDirectory()` writes to `data/generated/`).
  const tsconfigPath = resolve(target, "tsconfig.json");
  const tsconfigTemplate = `{
  "extends": "astro/tsconfigs/base",
  "compilerOptions": {
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "types": ["node"],
    "baseUrl": ".",
    "paths": {
      "@grove/generated/*": ["data/generated/*"]
    }
  },
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
`;
  await writeFile(tsconfigPath, tsconfigTemplate, "utf8");

  // 6. Create an empty data/records/ directory. `validateProject()`
  //    (packages/core/src/validate.ts) treats an ABSENT records
  //    directory as a hard error — deliberately, so a user who really
  //    did forget to create it gets told — but a fresh scaffold with
  //    zero records is a supported, documented starting state (the
  //    registry's pages/empty.astro fixture exists for exactly this).
  //    Without this, `grove check` fails on a project that has never
  //    been touched. Empty directories aren't tracked by git, hence
  //    the placeholder file.
  const recordsDir = resolve(target, "data", "records");
  await mkdir(recordsDir, { recursive: true });
  await writeFile(
    resolve(recordsDir, ".gitkeep"),
    "# Add one YAML file per record here — see /getting-started/first-record/.\n",
    "utf8",
  );

  return { targetDir: target, projectName, installedScaffold: installed };
}
