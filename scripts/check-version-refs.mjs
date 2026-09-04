#!/usr/bin/env node
// SPDX-License-Identifier: MIT
/**
 * Every hand-written version string in the product surface must equal the
 * released version.
 *
 * The landing page badge sat at `v0.6` while npm served 0.9.0, the JSON-LD
 * `softwareVersion` shipped `0.6.1` as structured data, and the roadmap
 * described itself as "what Grove 0.6.1 ships today" — three releases behind,
 * on the three surfaces a first-time reader sees first.
 *
 * Those strings are now rewritten by release-please through the `generic`
 * `extra-files` entries in `release-please-config.json`, which key off
 * `x-release-please-version` annotations. That machinery fails silently: drop
 * the annotation, or move the line, and the release still succeeds with the
 * version left behind. This check is what makes that failure loud.
 *
 * It deliberately reads the release-please config rather than a list of its
 * own, so adding a file to `extra-files` is enough to put it under the guard.
 */
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

const manifest = JSON.parse(await readFile(join(root, '.release-please-manifest.json'), 'utf8'));
const config = JSON.parse(await readFile(join(root, 'release-please-config.json'), 'utf8'));

const expected = manifest['.'];
if (!expected) {
  console.error('.release-please-manifest.json has no "." entry — nothing to check against.');
  process.exit(1);
}

const generic = (config.packages?.['.']?.['extra-files'] ?? []).filter(
  (entry) => entry.type === 'generic',
);

const problems = [];
for (const { path } of generic) {
  const contents = await readFile(join(root, path), 'utf8');

  // Only the annotated lines matter: a version mentioned in prose ("moved to
  // the registry in 0.8.0") is history, not a claim about the current release.
  const annotated = contents
    .split('\n')
    .filter((line) => line.includes('x-release-please-version'));
  const blockStart = contents.includes('x-release-please-start-version');

  if (annotated.length === 0 && !blockStart) {
    problems.push(
      `${path} is listed as a generic extra-file but carries no ` +
        `x-release-please-version or x-release-please-start-version annotation, ` +
        `so release-please will never update it.`,
    );
    continue;
  }

  for (const line of annotated) {
    const found = line.match(/\d+\.\d+\.\d+(?:-[\w.]+)?/)?.[0];
    if (found !== expected) {
      problems.push(
        `${path}: annotated line reads ${found ?? '(no version)'}, expected ${expected}\n      ${line.trim()}`,
      );
    }
  }

  if (blockStart) {
    const block =
      contents.split('x-release-please-start-version')[1]?.split('x-release-please-end')[0] ?? '';
    const found = block.match(/\d+\.\d+\.\d+(?:-[\w.]+)?/)?.[0];
    if (found !== expected) {
      problems.push(
        `${path}: version block reads ${found ?? '(no version)'}, expected ${expected}`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error(`Version references disagree with the released version (${expected}):\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('');
  process.exit(1);
}

console.log(`[version-refs] ok — ${generic.length} file(s) pinned to ${expected}.`);
