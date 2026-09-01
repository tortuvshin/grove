// SPDX-License-Identifier: MIT
/**
 * Which package manager Grove drives, and how.
 *
 * Grove used to hardcode pnpm: `grove init` refused to start without
 * it, and `grove check` shelled out to `pnpm exec astro check` even in
 * a project npm had installed — so a bun or yarn user who followed the
 * docs (which advertise npm/yarn/bun tabs on every page) hit
 * `spawn pnpm ENOENT` from a command that only wanted a local binary.
 *
 * Two rules come out of that and are worth keeping:
 *
 *   - Never spawn a package manager to run something already installed
 *     in the project. `localBin()` is the whole answer there.
 *   - When one genuinely is needed — installing dependencies, fetching
 *     shadcn — use the one the user actually has, not the one Grove
 *     was written against.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type PackageManagerName = 'pnpm' | 'npm' | 'yarn' | 'bun';

export interface PackageManager {
  name: PackageManagerName;
  /** Exact version, filled in by `requirePackageManager()`. */
  version?: string;
}

/** Preference order when a directory carries no signal at all. */
const FALLBACK_ORDER: PackageManagerName[] = ['pnpm', 'npm', 'yarn', 'bun'];

/** Lockfiles, most specific first — `bun.lock` and `bun.lockb` both mean bun. */
const LOCKFILES: [file: string, name: PackageManagerName][] = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
];

function isName(value: string): value is PackageManagerName {
  return value === 'pnpm' || value === 'npm' || value === 'yarn' || value === 'bun';
}

/**
 * `pnpm/10.12.1 npm/? node/v22.22.2 darwin arm64` → pnpm 10.12.1.
 *
 * Every package manager sets `npm_config_user_agent` for the processes
 * it spawns, `npx`/`bunx`/`yarn dlx`/`pnpm dlx` included — so this is
 * how the CLI knows what invoked it.
 */
export function parseUserAgent(agent: string | undefined): PackageManager | null {
  const first = agent?.trim().split(/\s+/)[0];
  if (!first) return null;
  const [name, version] = first.split('/');
  if (!name || !isName(name)) return null;
  return version && version !== '?' ? { name, version } : { name };
}

/** The `packageManager` field of a directory's package.json, if any. */
function fromManifest(cwd: string): PackageManager | null {
  try {
    const manifest = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')) as {
      packageManager?: string;
    };
    const [name, version] = (manifest.packageManager ?? '').split('@');
    if (!name || !isName(name)) return null;
    // The field may carry a `+sha224.…` integrity suffix; drop it.
    const exact = version?.split('+')[0];
    return exact ? { name, version: exact } : { name };
  } catch {
    // No package.json, or not ours to parse.
    return null;
  }
}

function fromLockfile(cwd: string): PackageManager | null {
  for (const [file, name] of LOCKFILES) {
    if (existsSync(join(cwd, file))) return { name };
  }
  return null;
}

function onPath(name: PackageManagerName): boolean {
  const probe = spawnSync(name, ['--version'], { stdio: 'ignore' });
  return !probe.error && probe.status === 0;
}

/**
 * Which package manager to use in `cwd`, in order of how much the
 * signal actually knows about the user's intent:
 *
 *   1. The project's own `packageManager` field — an explicit choice.
 *   2. Its lockfile — the choice it has been living with.
 *   3. `npm_config_user_agent` — how this very command was launched,
 *      which is all `grove init` into a fresh directory has to go on.
 *   4. Whatever is installed, pnpm first, so a machine with no signal
 *      behaves the way Grove always did.
 */
export function detectPackageManager(cwd: string = process.cwd()): PackageManager {
  return (
    fromManifest(cwd) ??
    fromLockfile(cwd) ??
    parseUserAgent(process.env.npm_config_user_agent) ?? {
      name: FALLBACK_ORDER.find(onPath) ?? 'npm',
    }
  );
}

/**
 * Confirm the package manager is really there before anything is
 * written, and pin down its exact version while we are asking — the
 * generated project records it so shadcn, corepack and the next
 * contributor all agree on which one this project uses.
 *
 * `cwd` is the project being created, not the directory the command was
 * typed in. pnpm and yarn re-exec the version a surrounding project
 * pins, so probing anywhere else reports that neighbour's version and
 * stamps it onto an unrelated new project.
 */
export function requirePackageManager(pm: PackageManager, cwd: string): PackageManager {
  const probe = spawnSync(pm.name, ['--version'], { cwd, encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    throw new Error(
      `grove init needs ${pm.name} on your PATH (it installs the scaffold's dependencies with it).\n` +
        `Install ${pm.name}, or run grove init through the package manager you do have — ` +
        'the CLI follows whichever one launches it.',
    );
  }
  const version = probe.stdout.trim();
  return version ? { ...pm, version } : pm;
}

/** `npm install`, `pnpm install`, `yarn install`, `bun install`. */
export function installCommand(pm: PackageManager): [command: string, args: string[]] {
  return [pm.name, ['install']];
}

/** How the user runs a package.json script: always `<pm> run <script>`. */
export function runScriptCommand(pm: PackageManager, script: string): string {
  return `${pm.name} run ${script}`;
}

/**
 * Fetch and run a package straight from the registry, npx-style.
 *
 * Yarn is the awkward one: `dlx` arrived in Yarn 2, and on Yarn Classic
 * `yarn dlx` is parsed as `yarn run dlx` and fails. Probe the major
 * rather than guess, and fall back to `npx`, which ships with Node.
 */
export function dlxCommand(
  pm: PackageManager,
  spec: string,
  args: string[],
): [command: string, args: string[]] {
  switch (pm.name) {
    case 'pnpm':
      return ['pnpm', ['dlx', spec, ...args]];
    case 'bun':
      return ['bunx', [spec, ...args]];
    case 'yarn': {
      const major = Number.parseInt(
        pm.version ?? spawnSync('yarn', ['--version'], { encoding: 'utf8' }).stdout?.trim() ?? '',
        10,
      );
      if (major >= 2) return ['yarn', ['dlx', spec, ...args]];
      return ['npx', ['--yes', spec, ...args]];
    }
    default:
      return ['npm', ['exec', '--yes', '--', spec, ...args]];
  }
}

/**
 * A binary installed in the project itself. Grove runs `astro` this
 * way rather than through `<pm> exec`: the file is right there, and
 * asking a package manager to find it only adds a way to fail.
 */
export function localBin(cwd: string, name: string): string {
  const binary = process.platform === 'win32' ? `${name}.cmd` : name;
  return join(cwd, 'node_modules', '.bin', binary);
}
