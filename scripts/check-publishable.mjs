#!/usr/bin/env node
// SPDX-License-Identifier: MIT
/**
 * Pre-publish invariants for the packages that go to npm.
 *
 * 1. Every runtime dependency of a published package must itself be
 *    publishable.
 *
 *    `pnpm publish` rewrites `workspace:*` to the dependency's concrete
 *    version in the tarball. If that dependency is private (or simply never
 *    released), the published package points at a version that does not
 *    exist on npm and `npm install` fails with a 404 — while everything
 *    inside the monorepo keeps working, because pnpm resolves the workspace
 *    link locally. That is exactly how `@grove-dev/cli` shipped a hard
 *    dependency on the unpublished `@grove-dev/registry`.
 *
 *    Dev dependencies are exempt: they never reach the tarball.
 *
 * 2. Every published package must carry its own LICENSE, byte-identical to
 *    the root one, and list it in `files`.
 *
 *    npm's "always include the license" behaviour only looks inside the
 *    directory being packed — it does not walk up to the monorepo root. Every
 *    Grove tarball up to 0.9.0 therefore declared `"license": "MIT"` with no
 *    license text in it. The byte comparison is what keeps the four copies
 *    from drifting once they exist.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const packagesDir = join(root, 'packages');
const rootLicense = await readFile(join(root, 'LICENSE'), 'utf8');

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

  let license;
  try {
    license = await readFile(join(packagesDir, dir, 'LICENSE'), 'utf8');
  } catch {
    problems.push(
      `packages/${dir}/LICENSE is missing: "${name}" declares "license": "${manifest.license}" ` +
        `but ships no license text. npm does not pull the root LICENSE into a subpackage tarball.`,
    );
  }
  if (license !== undefined && license !== rootLicense) {
    problems.push(
      `packages/${dir}/LICENSE has drifted from the root LICENSE. Re-copy it: ` +
        `cp LICENSE packages/${dir}/LICENSE`,
    );
  }

  // `files` is optional to npm but not to us: without it npm packs the whole
  // directory, and a stray build cache ships silently.
  if (!Array.isArray(manifest.files)) {
    problems.push(
      `packages/${dir}/package.json: "${name}" has no "files" array, so npm packs the entire ` +
        `directory. Declare explicitly what ships.`,
    );
  } else if (!manifest.files.includes('LICENSE')) {
    problems.push(
      `packages/${dir}/package.json: "files" does not include "LICENSE", so the license text ` +
        `is filtered back out of the tarball.`,
    );
  }
}

if (problems.length > 0) {
  console.error('Packages are not publishable as configured:\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('');
  process.exit(1);
}

const published = [...manifests.values()].filter((entry) => !entry.manifest.private).length;
console.log(`Publishable dependency graph + license/files OK (${published} published packages).`);
