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
 *      Last of these, for pnpm projects only, is pnpm-workspace.yaml,
 *      which approves the dependency build scripts pnpm 11 refuses to
 *      skip silently.
 *   4. `<pm> dlx shadcn@<pinned> add <bundled default.json> --yes`,
 *      where `<pm>` is whichever package manager the user has —
 *      detected, not assumed. shadcn writes every scaffold file under
 *      src/ and runs the package manager to install the item's deps
 *      (astro, tailwindcss, …) with real version ranges. If shadcn
 *      fails, the bundled item is written in-process instead — it
 *      inlines every file and names its own dependencies, so nothing
 *      about the result depends on a third-party CLI staying healthy.
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
 * CLI wrapper in index.ts runs `<pm> install` and `git init` after
 * this returns, per its own `--no-install`/`--no-git` flags.
 *
 * Steps 2-6 are transactional: if any of them throws, everything
 * written since step 1 is removed again, so the obvious retry is just
 * `grove init` and not `rm -rf` first.
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeLockfile } from './hash.js';
import {
  detectPackageManager,
  dlxCommand,
  type PackageManager,
  requirePackageManager,
} from './package-manager.js';
import {
  buildLockfile,
  loadItem,
  REGISTRY_NAMESPACE,
  REGISTRY_URL_TEMPLATE,
  type RegistryItem,
  resolveBundledItemPath,
  SHADCN_VERSION,
  writeItemFiles,
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
/**
 * Dependency install scripts the generated project approves up front.
 *
 * astro pulls in vite, which pulls in esbuild, whose install script
 * links esbuild's platform binary. pnpm 11 fails any install that
 * skipped a build script (`ERR_PNPM_IGNORED_BUILDS`, exit 1) — which
 * killed shadcn's `pnpm add` before it wrote a single scaffold file
 * and left `grove init` with a package.json and no src/. pnpm 10 only
 * warned, which is why CI, pinned to 10.12.1, never saw it.
 */
const APPROVED_BUILD_SCRIPTS = ['esbuild'] as const;

export interface InstallScaffoldContext {
  /** The project directory (absolute). */
  target: string;
  /** Absolute path to the built `default` item JSON being installed. */
  itemPath: string;
  /** The package manager to fetch shadcn with. */
  packageManager: PackageManager;
}

export interface InitOptions {
  projectName?: string;
  version?: string;
  /**
   * How the scaffold item gets onto disk. Defaults to running the
   * shadcn CLI; tests substitute `writeItemFiles()` to stay offline.
   */
  installScaffold?: (context: InstallScaffoldContext) => Promise<void>;
  /**
   * Which built item to install. Defaults to the copy bundled with the
   * CLI; tests point it elsewhere to exercise the failure path.
   */
  itemPath?: string;
  /**
   * Which package manager to scaffold for. Defaults to whatever
   * `detectPackageManager()` finds in the current directory.
   */
  packageManager?: PackageManager;
}

/** The subset of a consumer package.json this module reads and writes. */
interface PackageManifest {
  dependencies?: Record<string, string>;
  [key: string]: unknown;
}

export interface InitResult {
  targetDir: string;
  projectName: string;
  installedScaffold: RegistryItem;
  /** What the caller should run `install` and the next steps with. */
  packageManager: PackageManager;
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

async function ensureEmpty(targetDir: string): Promise<void> {
  await mkdir(targetDir, { recursive: true });
  const entries = (await readdir(targetDir)).filter((entry) => !SKIP_NAMES.has(entry));
  if (entries.length > 0) {
    throw new Error(`${targetDir} is not empty. Choose a new directory.`);
  }
}

/**
 * pnpm's two spellings of the same build-script approval. pnpm 11 reads
 * `allowBuilds` and ignores `onlyBuiltDependencies`; pnpm 10 does the
 * reverse. Writing both keeps one generated project working on either.
 */
function pnpmWorkspaceYaml(): string {
  return [
    '# Dependency install scripts this project approves.',
    '#',
    '# astro pulls in vite, which pulls in esbuild, whose install script',
    "# links esbuild's platform binary. pnpm 11 refuses to finish an",
    '# install that skipped a build script; pnpm 10 spells the same',
    '# approval differently and ignores the key it does not know.',
    'allowBuilds:',
    ...APPROVED_BUILD_SCRIPTS.map((name) => `  ${name}: true`),
    'onlyBuiltDependencies:',
    ...APPROVED_BUILD_SCRIPTS.map((name) => `  - ${name}`),
    '',
  ].join('\n');
}

/** Write a file only if it is not already there — never clobber a consumer's. */
async function writeIfAbsent(path: string, content: string): Promise<void> {
  await writeFile(path, content, { encoding: 'utf8', flag: 'wx' }).catch(
    (err: NodeJS.ErrnoException) => {
      if (err.code !== 'EEXIST') throw err;
    },
  );
}

/** Read-modify-write a package.json, always through a fresh `dependencies`. */
async function updatePackageJson(
  path: string,
  mutate: (pkg: PackageManifest & { dependencies: Record<string, string> }) => void,
): Promise<void> {
  const pkg = JSON.parse(await readFile(path, 'utf8')) as PackageManifest;
  const next = { ...pkg, dependencies: { ...(pkg.dependencies ?? {}) } };
  mutate(next);
  await writeJson(path, next);
}

/** `@astrojs/check@^0.9.9` → `['@astrojs/check', '^0.9.9']`. Splits on the LAST `@`. */
function parseDependencySpec(spec: string): [name: string, range: string] {
  const at = spec.lastIndexOf('@');
  if (at <= 0) return [spec, 'latest'];
  return [spec.slice(0, at), spec.slice(at + 1)];
}

/**
 * What `shadcn add` would have done, done in-process.
 *
 * shadcn is a third-party CLI fetched at run time: a bad release, an
 * offline machine, or a package manager it cannot drive takes it down —
 * and used to take the whole scaffold with it, because it aborts before
 * writing anything. Nothing it does here is out of reach: the bundled
 * item inlines all of its files and names its own npm dependencies, and
 * `writeItemFiles` is the same writer `grove update` already trusts. So
 * record the dependencies and let the `pnpm install` that follows
 * resolve them.
 */
async function installScaffoldDirectly(
  item: RegistryItem,
  target: string,
  packagePath: string,
): Promise<void> {
  await writeItemFiles(item, target);
  await updatePackageJson(packagePath, (pkg) => {
    for (const spec of item.dependencies ?? []) {
      const [name, range] = parseDependencySpec(spec);
      pkg.dependencies[name] ??= range;
    }
  });
}

/**
 * Undo a failed init. `ensureEmpty()` proved the directory held nothing
 * but SKIP_NAMES entries, so everything that appeared since is ours to
 * remove — and leaving it behind is worse than useless: the obvious
 * retry then trips `ensureEmpty` with "not empty" and the user has to
 * clean up by hand before trying again.
 */
async function rollback(target: string, preexisting: Set<string>): Promise<void> {
  const entries = await readdir(target).catch(() => [] as string[]);
  for (const entry of entries) {
    if (preexisting.has(entry)) continue;
    await rm(resolve(target, entry), { recursive: true, force: true });
  }
}

/**
 * Default scaffold installer: the official shadcn CLI, pinned, fetched
 * with whichever package manager this project is being scaffolded for.
 * The item path must be absolute — shadcn rejects relative local paths
 * as unsafe. `--yes` skips the confirmation prompts; stdio is inherited
 * so the user sees the install output.
 *
 * shadcn picks the package manager for the item's dependencies from the
 * lockfile or the `packageManager` field it finds in the project, and
 * its `add` path has no user-agent fallback — a fresh directory has
 * neither, so it would silently default to npm. Step 2 writes
 * `packageManager` for exactly that reason; without it a bun project
 * would come back with a package-lock.json in it.
 */
export async function installScaffoldWithShadcn({
  target,
  itemPath,
  packageManager,
}: InstallScaffoldContext): Promise<void> {
  const [command, args] = dlxCommand(packageManager, `shadcn@${SHADCN_VERSION}`, [
    'add',
    itemPath,
    '--yes',
    '--cwd',
    target,
  ]);
  await run(command, args, target);
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
  // 1b. Settle the package manager and confirm it is really there before
  //     writing anything, rather than dying partway through.
  const detected = options.packageManager ?? detectPackageManager();
  const packageManager =
    options.installScaffold === undefined ? requirePackageManager(detected, target) : detected;

  // 1c. Whatever is here now (only SKIP_NAMES entries, per ensureEmpty)
  //     is not ours; everything else that appears is, and comes back off
  //     again if a later step throws.
  const preexisting = new Set(await readdir(target));
  try {
    return await scaffold(target, options, packageManager);
  } catch (error) {
    await rollback(target, preexisting);
    console.error(
      `\nRemoved the partial scaffold in ${target}; ` +
        'run grove init again once the error below is fixed.\n',
    );
    throw error;
  }
}

/** Steps 2-6. Only called through `initDirectory`, which owns the rollback. */
async function scaffold(
  target: string,
  options: InitOptions,
  packageManager: PackageManager,
): Promise<InitResult> {
  const version = options.version ?? readCliVersion();
  const fallbackName = target.split(/[\\/]/).at(-1) ?? 'grove-directory';
  const rawName = options.projectName ?? fallbackName;
  const projectName = packageName(rawName);
  const installScaffold = options.installScaffold ?? installScaffoldWithShadcn;

  // 2. package.json. Scripts are fixed here — registry items carry
  //    files and npm dependency names, not scripts. Dependencies are
  //    filled in by shadcn (step 4) and by us (step 5).
  //    `packageManager` is the one signal shadcn's package-manager
  //    detector can read in an otherwise empty directory, and it is
  //    what keeps a bun or yarn scaffold from being installed by npm.
  const packagePath = resolve(target, 'package.json');
  await writeJson(packagePath, {
    name: projectName,
    type: 'module',
    ...(packageManager.version
      ? { packageManager: `${packageManager.name}@${packageManager.version}` }
      : {}),
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

  // 3f. pnpm-workspace.yaml. Every install a pnpm project will ever run
  //     — shadcn's in the next step, the one in index.ts, and the
  //     consumer's own later on — needs the scaffold's dependency build
  //     scripts approved, or pnpm 11 aborts the lot. npm, yarn and bun
  //     run install scripts without asking, so this file is pnpm's
  //     alone and would only be noise in their projects.
  if (packageManager.name === 'pnpm') {
    await writeIfAbsent(resolve(target, 'pnpm-workspace.yaml'), pnpmWorkspaceYaml());
  }

  // 4. Install the scaffold item. shadcn is the installer of record;
  //    when it fails, finish the job in-process rather than hand back a
  //    project with no src/ in it.
  const itemPath = options.itemPath ?? resolveBundledItemPath();
  const item = await loadItem(itemPath);
  try {
    await installScaffold({ target, itemPath, packageManager });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(
      `\nInstalling the scaffold with shadcn failed: ${reason}\n` +
        `Writing the bundled ${REGISTRY_NAMESPACE}/${item.name} item directly instead.\n`,
    );
    await installScaffoldDirectly(item, target, packagePath);
  }

  // 5. Grove's own packages, pinned to this CLI's version. Read-modify-
  //    write: step 4 rewrote package.json with the item's dependencies.
  await updatePackageJson(packagePath, (pkg) => {
    for (const dep of GROVE_PACKAGES) pkg.dependencies[dep] = `^${version}`;
  });

  // 6. Record what was installed for `grove update`.
  await writeLockfile(target, buildLockfile(item));

  return { targetDir: target, projectName, installedScaffold: item, packageManager };
}
