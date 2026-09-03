#!/usr/bin/env node
// SPDX-License-Identifier: MIT
/**
 * Look inside the tarballs before they ship.
 *
 * Everything here runs against a real `pnpm pack` output rather than the
 * source directory, because the two are not the same artifact: `pnpm pack`
 * applies the `files` filter and resolves `workspace:*` to a concrete
 * version. Checking the source tree would miss both.
 *
 * Structural assertions (LICENSE present, no tests, no build caches, no
 * leftover `workspace:` ranges) run for every published package and always
 * fail the build.
 *
 * `publint` and `@arethetypeswrong/cli` are advisory for `@grove-dev/astro`
 * and `@grove-dev/starlight`: both deliberately export raw `.ts`/`.astro`
 * source for Vite to compile (astro's `./server` entry, and starlight in its
 * entirety — it has no build step), which both tools report as a defect.
 * They are gates for `@grove-dev/core` and `@grove-dev/cli`, which ship
 * ordinary compiled ESM + `.d.ts`.
 *
 * Usage:
 *   node scripts/check-packaging.mjs           # check, then clean up
 *   node scripts/check-packaging.mjs --out DIR # also keep the tarballs
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

/** Packages whose tarball layout `publint`/`attw` can meaningfully judge. */
const GATED = new Set(['@grove-dev/core', '@grove-dev/cli']);

const outFlag = process.argv.indexOf('--out');
const keepDir = outFlag === -1 ? null : resolve(process.argv[outFlag + 1]);
const workDir = mkdtempSync(join(tmpdir(), 'grove-packaging-'));
if (keepDir) mkdirSync(keepDir, { recursive: true });

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', ...opts });
}

function must(cmd, args, opts = {}) {
  const result = run(cmd, args, { stdio: 'inherit', ...opts });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${result.status}`);
  }
}

const packages = readdirSync(join(root, 'packages'))
  .map((dir) => {
    const manifestPath = join(root, 'packages', dir, 'package.json');
    if (!existsSync(manifestPath)) return null;
    return { dir, manifest: JSON.parse(readFileSync(manifestPath, 'utf8')) };
  })
  .filter((entry) => entry && !entry.manifest.private);

const problems = [];
const advisories = [];

for (const { dir, manifest } of packages) {
  const packageDir = join(root, 'packages', dir);
  console.log(`\n=== ${manifest.name}@${manifest.version} ===`);

  const packed = run('pnpm', ['pack', '--pack-destination', workDir], { cwd: packageDir });
  if (packed.status !== 0) {
    problems.push(`${manifest.name}: pnpm pack failed\n${packed.stderr}`);
    continue;
  }
  // `pnpm pack` prints the tarball path on the last non-empty stdout line.
  const tarball = packed.stdout.trim().split('\n').filter(Boolean).pop();
  if (!tarball || !existsSync(tarball)) {
    problems.push(`${manifest.name}: could not locate the packed tarball (got "${tarball}")`);
    continue;
  }

  const listing = run('tar', ['-tzf', tarball]).stdout.split('\n').filter(Boolean).sort();
  console.log(listing.map((entry) => `  ${entry}`).join('\n'));
  console.log(`  (${listing.length} entries)`);

  const entries = listing.map((entry) => entry.replace(/^package\//, ''));

  if (!entries.includes('LICENSE')) {
    problems.push(
      `${manifest.name}: tarball has no LICENSE, but declares "license": "${manifest.license}".`,
    );
  }
  const tests = entries.filter((entry) => /\.(test|spec)\./.test(entry));
  if (tests.length > 0) {
    problems.push(`${manifest.name}: test files in the tarball: ${tests.join(', ')}`);
  }
  const caches = entries.filter(
    (entry) => entry.startsWith('.astro/') || entry.startsWith('node_modules/'),
  );
  if (caches.length > 0) {
    problems.push(
      `${manifest.name}: build cache or dependencies in the tarball: ${caches.join(', ')}`,
    );
  }

  const extracted = join(workDir, `extracted-${dir}`);
  mkdirSync(extracted, { recursive: true });
  must('tar', ['-xzf', tarball, '-C', extracted]);
  const shipped = JSON.parse(readFileSync(join(extracted, 'package', 'package.json'), 'utf8'));
  const unresolved = Object.entries(shipped.dependencies ?? {}).filter(([, range]) =>
    String(range).startsWith('workspace:'),
  );
  if (unresolved.length > 0) {
    problems.push(
      `${manifest.name}: unresolved workspace ranges in the shipped manifest: ` +
        unresolved.map(([dep, range]) => `${dep}@${range}`).join(', '),
    );
  }

  const gated = GATED.has(manifest.name);
  const label = gated ? 'gate' : 'advisory';

  const publint = run('pnpm', ['exec', 'publint', join(extracted, 'package')], { cwd: root });
  process.stdout.write(publint.stdout ?? '');
  process.stderr.write(publint.stderr ?? '');
  if (publint.status !== 0) {
    (gated ? problems : advisories).push(`${manifest.name}: publint reported problems (${label}).`);
  }

  // `esm-only` drops the node10 and CJS-require rows. Every Grove package is
  // `"type": "module"` with no `require` condition on purpose, so those two
  // rows are a restatement of the design rather than a finding.
  const attw = run('pnpm', ['exec', 'attw', '--profile', 'esm-only', tarball], { cwd: root });
  process.stdout.write(attw.stdout ?? '');
  process.stderr.write(attw.stderr ?? '');
  if (attw.status !== 0) {
    (gated ? problems : advisories).push(
      `${manifest.name}: @arethetypeswrong/cli reported problems (${label}).`,
    );
  }

  if (keepDir) must('cp', [tarball, keepDir]);
}

if (advisories.length > 0) {
  console.log('\nAdvisory (not failing the build — these packages ship raw source by design):');
  for (const advisory of advisories) console.log(`  - ${advisory}`);
}

if (!keepDir) rmSync(workDir, { recursive: true, force: true });

if (problems.length > 0) {
  console.error('\nPackaging problems:\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('');
  process.exit(1);
}

console.log(`\nPackaging OK (${packages.length} tarballs inspected).`);
