#!/usr/bin/env node
// SPDX-License-Identifier: MIT
/**
 * Every runtime dependency of a published package must itself be
 * publishable.
 *
 * `pnpm publish` rewrites `workspace:*` to the dependency's concrete
 * version in the tarball. If that dependency is private (or simply never
 * released), the published package points at a version that does not
 * exist on npm and `npm install` fails with a 404 — while everything
 * inside the monorepo keeps working, because pnpm resolves the workspace
 * link locally. That is exactly how `@grove-dev/cli` shipped a hard
 * dependency on the unpublished `@grove-dev/registry`.
 *
 * Dev dependencies are exempt: they never reach the tarball.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const packagesDir = join(root, 'packages');

const manifests = new Map();
for (const dir of await readdir(packagesDir)) {
  try {
    const manifest = JSON.parse(await readFile(join(packagesDir, dir, 'package.json'), 'utf8'));
    manifests.set(manifest.name, { manifest, dir });
  } catch {
    // not a package directory
  }
}

const problems = [];
for (const [name, { manifest, dir }] of manifests) {
  if (manifest.private) continue; // this package is never published
  for (const [dep, range] of Object.entries(manifest.dependencies ?? {})) {
    const target = manifests.get(dep);
    if (!target) continue; // an ordinary npm dependency
    if (target.manifest.private) {
      problems.push(
        `packages/${dir}/package.json: "${name}" is published but depends on "${dep}" (${range}), ` +
          `which is private. \`pnpm publish\` would rewrite that range to ` +
          `${target.manifest.version} — a version that does not exist on npm.`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error('Unpublishable dependency graph:\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('');
  process.exit(1);
}

const published = [...manifests.values()].filter((entry) => !entry.manifest.private).length;
console.log(`Publishable dependency graph OK (${published} published packages).`);
