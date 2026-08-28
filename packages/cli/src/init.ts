// SPDX-License-Identifier: MIT
/**
 * `grove init` — registry bootstrapper.
 *
 * Per §19 of `apps/docs/v1-architecture.md`, `grove init` does five
 * things and nothing else:
 *
 *   1. Detect Astro (implicit — the scaffold ships Astro pages).
 *   2. Install Grove packages (@grove-dev/{core,astro,cli,registry}).
 *   3. Create grove.config.ts.
 *   4. Initialize content/data (records/, collections/, taxonomy/).
 *   5. Install the @grove/default scaffold into src/.
 *   6. Create Grove registry state (.grove/registry.lock.json).
 *   7. Validate (no separate step — scaffold is correct on install).
 *
 * The scaffold is shipped from `@grove-dev/registry` and materialized
 * by `materializeRegistry()`. There is no second template to maintain
 * in this repo and no fallback path — if the registry snapshot is
 * missing, init fails fast with a clear message.
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

  // 1. Write package.json with engine + registry pinned to the CLI version.
  const packagePath = resolve(target, "package.json");
  const pkg: { name: string; type?: string; dependencies: Record<string, string> } = {
    name: projectName,
    type: "module",
    dependencies: {},
  };
  for (const dep of GROVE_PACKAGES) pkg.dependencies[dep] = `^${version}`;
  await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");

  // 2. Materialize the @grove/default scaffold into src/. This also
  //    writes `.grove/registry.lock.json` recording the install-time
  //    hashes (consumed by `grove update`).
  const installed = await materializeRegistry(target);

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

  return { targetDir: target, projectName, installedScaffold: installed };
}
