// SPDX-License-Identifier: MIT
/**
 * `grove init` — scaffold a Grove project from the registry.
 *
 * The UI is a shadcn registry (`@grove-dev/registry`); the full
 * scaffold is its generated `default` item, and the official shadcn
 * CLI installs it. `grove init` only has to set the table, in this
 * order:
 *
 *   1. Refuse a non-empty directory.
 *   2. Write package.json (name, `astro dev/build/check` scripts, no
 *      dependencies yet).
 *   3. Write the project files shadcn needs to install into a bare
 *      directory — tsconfig.json (`@/*` alias, Bundler resolution,
 *      the `@grove/generated/*` alias the scaffold's code relies on)
 *      and components.json (registers the `@grove` registry URL so
 *      `npx shadcn add @grove/<item>` works later) — plus the files
 *      the scaffold does not ship because they are project-specific:
 *      grove.config.ts, astro.config.mjs, and an empty data/records/.
 *   4. `pnpm dlx shadcn@<pinned> add <bundled default.json> --yes`.
 *      shadcn writes every scaffold file under src/ and runs the
 *      package manager to install the item's npm dependencies
 *      (astro, tailwindcss, …) with real version ranges.
 *   5. Add `@grove-dev/{core,astro,cli}` to package.json,
 *      pinned to this CLI's version. After step 4 on purpose: shadcn
 *      installs whatever package.json declares, and Grove's own
 *      packages may not be resolvable at that moment (the scaffold
 *      smoke test points them at local tarballs afterwards).
 *   6. Write `.grove/registry.lock.json` with the install-time hashes
 *      of the item's files, which `grove update` diffs against later.
 *
 * `grove init` does NOT scaffold `content/`, `public/`, `.github/`, or
 * anything under `data/` besides the empty `records/` directory —
 * those are content/workflow concerns, not UI-registry concerns. The
 * CLI wrapper in index.ts runs `pnpm install` and `git init` after
 * this returns, per its own `--no-install`/`--no-git` flags.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeLockfile } from './hash.js';
import {
  buildLockfile,
  loadItem,
  REGISTRY_NAMESPACE,
  REGISTRY_URL_TEMPLATE,
  type RegistryItem,
  resolveBundledItemPath,
  SHADCN_VERSION,
} from './registry.js';
import { run } from './run.js';

const SKIP_NAMES = new Set(['node_modules', 'dist', '.astro', '.DS_Store', '.grove']);
// The registry is not in this list on purpose: shadcn installed the UI
// source into `src/`, so the consumer owns those files outright and never
// imports a registry package at runtime.
const GROVE_PACKAGES = ['@grove-dev/core', '@grove-dev/astro', '@grove-dev/cli'] as const;
const PROJECT_SCRIPTS = {
  dev: 'astro dev',
  build: 'astro build',
  check: 'astro check',
} as const;

export interface InstallScaffoldContext {
  /** The project directory (absolute). */
  target: string;
  /** Absolute path to the built `default` item JSON being installed. */
  itemPath: string;
}

export interface InitOptions {
  projectName?: string;
  version?: string;
  /**
   * How the scaffold item gets onto disk. Defaults to running the
   * shadcn CLI; tests substitute `writeItemFiles()` to stay offline.
   */
  installScaffold?: (context: InstallScaffoldContext) => Promise<void>;
}

export interface InitResult {
  targetDir: string;
  projectName: string;
  installedScaffold: RegistryItem;
}

export function readCliVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [resolve(here, 'package.json'), resolve(here, '../package.json')]) {
    try {
      const pkg = JSON.parse(requireText(candidate)) as { version?: string };
      if (pkg.version) return pkg.version;
    } catch {
      // Source and published layouts intentionally use different paths.
    }
  }
  return '0.0.0-dev';
}

function requireText(path: string): string {
  // Synchronous version lookup happens once while constructing the CLI.
  return globalThis.process.getBuiltinModule('node:fs').readFileSync(path, 'utf8');
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function packageName(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'grove-directory'
  );
}

/**
 * `grove init` drives pnpm — for the shadcn `dlx` call, for the
 * dependency install, and for the lockfile shadcn's package-manager
 * detector reads. Check for it before writing anything.
 */
function requirePnpm(): void {
  const probe = spawnSync('pnpm', ['--version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    throw new Error(
      'grove init needs pnpm on your PATH (it runs `pnpm dlx shadcn` and `pnpm install`).\n' +
        'Install it with `npm install -g pnpm` or `corepack enable pnpm`, then run grove init again.',
    );
  }
}

async function ensureEmpty(targetDir: string): Promise<void> {
  await mkdir(targetDir, { recursive: true });
  const entries = (await readdir(targetDir)).filter((entry) => !SKIP_NAMES.has(entry));
  if (entries.length > 0) {
    throw new Error(`${targetDir} is not empty. Choose a new directory.`);
  }
}

/**
 * Default scaffold installer: the official shadcn CLI, pinned. The
 * item path must be absolute — shadcn rejects relative local paths as
 * unsafe. `--yes` skips the confirmation prompts; stdio is inherited
 * so the user sees the package manager's install output.
 *
 * shadcn picks the package manager for the item's dependencies from
 * the lockfile (or `packageManager` field) it finds in the project —
 * neither exists in a fresh directory, and its `add` path has no
 * user-agent fallback, so it would default to npm and leave a
 * package-lock.json behind in a project the rest of this CLI drives
 * with pnpm. An empty pnpm-lock.yaml is enough for the detector; pnpm
 * itself accepts the empty file and replaces it with a real one.
 */
export async function installScaffoldWithShadcn({
  target,
  itemPath,
}: InstallScaffoldContext): Promise<void> {
  await writeFile(resolve(target, 'pnpm-lock.yaml'), '', { encoding: 'utf8', flag: 'wx' }).catch(
    (err: NodeJS.ErrnoException) => {
      if (err.code !== 'EEXIST') throw err;
    },
  );
  await run(
    'pnpm',
    ['dlx', `shadcn@${SHADCN_VERSION}`, 'add', itemPath, '--yes', '--cwd', target],
    target,
  );
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/**
 * Bootstrap a Grove project by installing the `@grove/default`
 * registry scaffold. Returns the installed item so callers can report
 * what landed.
 */
export async function initDirectory(
  targetDir: string,
  options: InitOptions = {},
): Promise<InitResult> {
  const target = resolve(targetDir);
  // 1. Never install over someone's work.
  await ensureEmpty(target);
  // 1b. And never leave half a project behind. `installScaffoldWithShadcn`
  //     shells out to pnpm; without it the run used to die partway through
  //     with `spawn pnpm ENOENT`, after package.json and friends were
  //     already on disk — so the obvious retry then failed `ensureEmpty`
  //     with "not empty" and the user had to clean up by hand.
  if (options.installScaffold === undefined) requirePnpm();

  const version = options.version ?? readCliVersion();
  const fallbackName = target.split(/[\\/]/).at(-1) ?? 'grove-directory';
  const rawName = options.projectName ?? fallbackName;
  const projectName = packageName(rawName);
  const installScaffold = options.installScaffold ?? installScaffoldWithShadcn;

  // 2. package.json. Scripts are fixed here — registry items carry
  //    files and npm dependency names, not scripts. Dependencies are
  //    filled in by shadcn (step 4) and by us (step 5).
  const packagePath = resolve(target, 'package.json');
  await writeJson(packagePath, {
    name: projectName,
    type: 'module',
    scripts: { ...PROJECT_SCRIPTS },
    dependencies: {},
  });

  // 3a. tsconfig.json. Not shipped via the registry — everything the
  //     item writes lands under src/, but a tsconfig has to sit at the
  //     project root. The scaffold's own code relies on two settings
  //     Astro's default (when no tsconfig exists) doesn't set:
  //     "Bundler" resolution (registry components import package
  //     subpaths like `@grove-dev/astro/server` whose declaration file
  //     lives in the package's own src/) and the `@grove/generated/*`
  //     alias (so `astro check` resolves the JSON `prepareDirectory()`
  //     writes to `data/generated/`). The `@/*` alias is what shadcn
  //     reads to locate src/. `strict` is pinned off explicitly:
  //     Astro's `base` preset leaves it unset, which TypeScript 5
  //     treats as off and TypeScript 6 as on, and the scaffold's
  //     sources are checked against the former — a fresh project
  //     should type-check the same way whichever TypeScript the
  //     package manager resolves for `astro check`.
  await writeFile(
    resolve(target, 'tsconfig.json'),
    `{
  "extends": "astro/tsconfigs/base",
  "compilerOptions": {
    "strict": false,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "types": ["node"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@grove/generated/*": ["data/generated/*"]
    }
  },
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
`,
    'utf8',
  );

  // 3b. components.json — the shadcn project config. shadcn needs it
  //     to install anything; the `registries` entry is what makes
  //     `npx shadcn add @grove/<item>` resolve later.
  await writeJson(resolve(target, 'components.json'), {
    $schema: 'https://ui.shadcn.com/schema.json',
    style: 'new-york',
    rsc: false,
    tsx: true,
    tailwind: {
      config: '',
      css: 'src/styles/system.css',
      baseColor: 'neutral',
      cssVariables: true,
    },
    aliases: {
      components: '@/components',
      utils: '@/lib/utils',
      ui: '@/components/ui',
      lib: '@/lib',
      hooks: '@/hooks',
    },
    registries: { [REGISTRY_NAMESPACE]: REGISTRY_URL_TEMPLATE },
  });

  // 3c. grove.config.ts. Project-specific, so the scaffold doesn't
  //     ship one — generate a fresh template with the project name.
  await writeFile(
    resolve(target, 'grove.config.ts'),
    `import { defineConfig } from "@grove-dev/core";

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
`,
    'utf8',
  );

  // 3d. astro.config.mjs. Without this the scaffold's Tailwind v4
  //     styles (`@import "tailwindcss"` in styles/system.css) never get
  //     processed — the Vite plugin has to be registered somewhere.
  await writeFile(
    resolve(target, 'astro.config.mjs'),
    `// @ts-check
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
`,
    'utf8',
  );

  // 3e. Empty data/records/. `validateProject()` treats an ABSENT
  //     records directory as a hard error — deliberately — but a fresh
  //     scaffold with zero records is a supported starting state.
  //     Empty directories aren't tracked by git, hence the placeholder.
  const recordsDir = resolve(target, 'data', 'records');
  await mkdir(recordsDir, { recursive: true });
  await writeFile(
    resolve(recordsDir, '.gitkeep'),
    '# Add one YAML file per record here — see /getting-started/first-record/.\n',
    'utf8',
  );

  // 4. Install the scaffold item.
  const itemPath = resolveBundledItemPath();
  await installScaffold({ target, itemPath });

  // 5. Grove's own packages, pinned to this CLI's version. Read-modify-
  //    write: shadcn rewrote package.json with the item's dependencies.
  const pkg = JSON.parse(await readFile(packagePath, 'utf8')) as {
    dependencies?: Record<string, string>;
    [key: string]: unknown;
  };
  pkg.dependencies = { ...(pkg.dependencies ?? {}) };
  for (const dep of GROVE_PACKAGES) pkg.dependencies[dep] = `^${version}`;
  await writeJson(packagePath, pkg);

  // 6. Record what was installed for `grove update`.
  const item = await loadItem(itemPath);
  await writeLockfile(target, buildLockfile(item));

  return { targetDir: target, projectName, installedScaffold: item };
}
