#!/usr/bin/env node
/**
 * Release script for the Grove monorepo.
 *
 * One command: build, bump versions, publish, in dependency order.
 *
 * Usage:
 *   pnpm release                # patch bump (0.1.0 -> 0.1.1)
 *   pnpm release --minor        # minor bump (0.1.0 -> 0.2.0)
 *   pnpm release --major        # major bump (0.1.0 -> 1.0.0)
 *   pnpm release --bump=2.3.4   # explicit version
 *   pnpm release --dry-run      # build + bump + dry-run publish (no actual publish)
 *   pnpm release --skip-build   # skip build step
 *   pnpm release --skip-bump    # skip version bump
 *
 * Order (dependency graph): core -> astro -> cli -> starlight.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const LOCK_FILE = resolve(ROOT, '.release-in-progress');
const WORKSPACE_LOCK_FILE = resolve(ROOT, 'pnpm-lock.yaml');

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}
const RELEASE_KIND = args.kind ?? 'patch';
const EXPLICIT_VERSION = args.bump;
const DRY_RUN = Boolean(args['dry-run']);
const SKIP_BUILD = Boolean(args['skip-build']);
const SKIP_BUMP = Boolean(args['skip-bump']);
// npm publishes to the `latest` dist-tag unless told otherwise — including
// for prerelease versions, which would hand every `npm install @grove-dev/x`
// a release candidate. Default the tag off the version instead, and let
// --tag override.
const RESOLVED_VERSION = EXPLICIT_VERSION ?? null;
const DIST_TAG = args.tag ?? (RESOLVED_VERSION?.includes('-') ? 'next' : 'latest');

const PACKAGES = [
  { name: '@grove-dev/core', dir: 'packages/core' },
  { name: '@grove-dev/astro', dir: 'packages/astro' },
  { name: '@grove-dev/cli', dir: 'packages/cli' },
  { name: '@grove-dev/starlight', dir: 'packages/starlight' },
];

async function snapshotReleaseFiles() {
  const paths = [
    ...PACKAGES.map((pkg) => resolve(ROOT, pkg.dir, 'package.json')),
    WORKSPACE_LOCK_FILE,
  ];
  return new Map(
    await Promise.all(paths.map(async (path) => [path, await readFile(path, 'utf8')])),
  );
}

async function restoreReleaseFiles(snapshot) {
  await Promise.all([...snapshot].map(([path, contents]) => writeFile(path, contents, 'utf8')));
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--minor') out.kind = 'minor';
    else if (a === '--major') out.kind = 'major';
    else if (a === '--patch') out.kind = 'patch';
    else if (a === '--dry-run') out['dry-run'] = true;
    else if (a === '--skip-build') out['skip-build'] = true;
    else if (a === '--skip-bump') out['skip-bump'] = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a.startsWith('--bump=')) out.bump = a.slice('--bump='.length);
    else if (a.startsWith('--otp=')) out.otp = a.slice('--otp='.length);
  }
  return out;
}

function printHelp() {
  console.log(
    `Grove release script — build, bump, publish in dependency order.

Usage:
  node scripts/release.mjs [options]

Options:
  --minor          bump minor version (0.1.0 -> 0.2.0)
  --major          bump major version (0.1.0 -> 1.0.0)
  --patch          bump patch version (0.1.0 -> 0.1.1, default)
  --bump=2.3.4     pin an explicit version for every package
  --tag=next       npm dist-tag to publish under (default: latest,
                   or next when --bump carries a prerelease suffix)
  --dry-run        build + bump + dry-run publish (no actual publish)
  --skip-build     skip the pnpm -r build step
  --skip-bump      skip the version bump step
  --otp=<code>     one-time password for 2FA-protected npm accounts
                   (also read from the NPM_OTP env var)
  -h, --help       print this help and exit

Idempotency:
  The script writes <repo-root>/.release-in-progress on entry and
  removes it on a clean exit. If the file is present on entry, the
  script aborts with an actionable error — re-run only after the
  previous run has been verified (committed or reverted).

Order (dependency graph):
  core -> astro -> cli -> starlight
`,
  );
}

function bumpVersion(current, kind) {
  const [maj, min, pat] = current.split('.').map((n) => parseInt(n, 10));
  if (kind === 'major') return `${maj + 1}.0.0`;
  if (kind === 'minor') return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

function logSection(title) {
  console.log(`\n\x1b[1m\x1b[36m━━━ ${title} ━━━\x1b[0m`);
}

function logOk(msg) {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`);
}
function logErr(msg) {
  console.log(`\x1b[31m✗\x1b[0m ${msg}`);
}

async function readPkg(dir) {
  return JSON.parse(await readFile(resolve(ROOT, dir, 'package.json'), 'utf8'));
}
async function writePkg(dir, pkg) {
  await writeFile(resolve(ROOT, dir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

function run(cmd, args, opts = {}) {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      cwd: ROOT,
      shell: process.platform === 'win32',
      ...opts,
    });
    child.on('exit', (code) => {
      if (code === 0) resolveP();
      else rejectP(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function bumpAll() {
  logSection('Bumping versions');
  const updates = [];

  for (const p of PACKAGES) {
    const pkg = await readPkg(p.dir);
    const before = pkg.version;
    const after = EXPLICIT_VERSION ?? bumpVersion(before, RELEASE_KIND);
    updates.push({ package: p, pkg, before, after });
  }

  for (const update of updates) {
    const { package: p, pkg, before, after } = update;
    pkg.version = after;
    // Note: we deliberately do NOT rewrite `workspace:*` ranges.
    // `pnpm publish` already does that for us in the tarball (verified
    // by inspecting grove-dev-cli-0.1.0.tgz). Rewriting them here
    // before `pnpm install` runs caused 404s because the bumped
    // version doesn't exist on the npm registry yet. See
    // apps/docs/RELEASING.md ("Why we don't rewrite workspace:* manually").
    await writePkg(p.dir, pkg);
    logOk(`${p.name}: ${before} → ${after}`);
  }
  // Templates intentionally have NO version field — they're not
  // published packages, so bumping the monorepo version does not
  // need to touch them. `pnpm publish` doesn't touch them either.
  // (The previous code rewrote their `workspace:*` ranges to the
  // new version, which was the same footgun and is now removed.)
}

async function installAll() {
  // Re-resolve `node_modules/@grove-dev/*` symlinks against the
  // newly-bumped version fields. With `linkWorkspacePackages: true`
  // (the default for this monorepo), pnpm rewrites those symlinks
  // during install to point at the current local `packages/*`
  // siblings. We run this BETWEEN bumpAll and buildAll so the build
  // step sees the new versions and not stale symlinks to the old
  // ones. We don't pass `--frozen-lockfile` because the version
  // bump necessarily invalidates the lockfile's
  // `packages/<x>:name` / `version` rows.
  logSection('Refreshing node_modules');
  await run('pnpm', ['install']);
}

async function buildAll() {
  logSection('Building all packages');
  await run('pnpm', ['-r', 'build']);
}

async function publishAll() {
  logSection(`Publishing (${DRY_RUN ? 'dry-run' : 'live'})`);
  // If the npm account has 2FA enabled, the user can pass a one-time
  // password via the NPM_OTP env var or the --otp=<code> flag. The
  // release script forwards it to every `pnpm publish` invocation.
  const otp = process.env.NPM_OTP ?? args.otp;
  for (const p of PACKAGES) {
    const publishArgs = [
      '--filter',
      p.name,
      'publish',
      '--no-git-checks',
      '--access',
      'public',
      '--tag',
      DIST_TAG,
    ];
    if (DRY_RUN) publishArgs.push('--dry-run');
    if (otp) publishArgs.push(`--otp=${otp}`);
    try {
      await run('pnpm', publishArgs);
      logOk(`Published ${p.name}`);
    } catch (err) {
      logErr(`Failed to publish ${p.name}: ${err.message}`);
      throw err;
    }
  }
}

async function main() {
  console.log('Grove release script');
  console.log(
    `  kind:       ${RELEASE_KIND}${EXPLICIT_VERSION ? ` (explicit ${EXPLICIT_VERSION})` : ''}`,
  );
  console.log(`  dist-tag:   ${DIST_TAG}`);
  console.log(`  dry-run:    ${DRY_RUN}`);
  console.log(`  skip-build: ${SKIP_BUILD}`);
  console.log(`  skip-bump:  ${SKIP_BUMP}`);
  console.log(`  order:      ${PACKAGES.map((p) => p.name).join(' → ')}`);

  // Idempotency guard (audit finding: release script is not
  // idempotent on failure). We write `.release-in-progress` at the
  // repo root on entry, remove it on a clean exit. If the file is
  // already present on entry, we ABORT — a previous run did not
  // finish cleanly (network error, Ctrl-C, build failure mid-flight)
  // and the working tree may already be in a half-bumped state.
  // Re-running would double-bump. The user must investigate first:
  //   - Inspect the file's mtime to find the partial run.
  //   - Run `git status` to see which `package.json` files were
  //     touched (the bump step is the only thing that mutates the
  //     tree before publish).
  //   - Either revert (`git checkout -- packages/*/package.json`)
  //     or finish the publish manually, then `rm .release-in-progress`
  //     and re-run.
  if (existsSync(LOCK_FILE)) {
    logErr(
      `.release-in-progress exists at ${LOCK_FILE} — a previous run did not finish cleanly.\n` +
        `Inspect the working tree, then either:\n` +
        `  rm ${LOCK_FILE}                       # to acknowledge and retry, OR\n` +
        `  git checkout -- packages/*/package.json   # to revert the bump and retry`,
    );
    process.exit(1);
  }
  const dryRunSnapshot = DRY_RUN ? await snapshotReleaseFiles() : null;
  await writeFile(LOCK_FILE, `${new Date().toISOString()}\n`, 'utf8');

  let completed = false;
  try {
    if (!SKIP_BUMP) await bumpAll();
    // pnpm install MUST run between bumpAll and buildAll. With
    // linkWorkspacePackages: true (the default for this monorepo),
    // the symlinks under node_modules/@grove-dev/* still point at
    // the old-version local packages after a bump; pnpm install
    // refreshes them. Skipping this step built the old version's
    // dist/ against the new version's package.json (audit finding).
    if (!SKIP_BUMP) await installAll();
    if (!SKIP_BUILD) await buildAll();
    await publishAll();
    completed = true;
  } finally {
    // A dry run must leave the repository exactly as it found it. A failed
    // real publish intentionally keeps both the bumped files and lock so the
    // maintainer cannot accidentally double-bump by re-running blindly.
    if (dryRunSnapshot) {
      await restoreReleaseFiles(dryRunSnapshot);
      logOk('Restored versions and lockfile after dry-run');
    }
    if (completed || dryRunSnapshot) {
      try {
        await unlink(LOCK_FILE);
      } catch {
        /* already gone — fine */
      }
    }
  }

  logSection('Done');
  console.log(DRY_RUN ? 'Dry-run complete — no actual publishes.' : 'All packages published.');
}

main().catch((err) => {
  logErr(err.message);
  process.exit(1);
});
