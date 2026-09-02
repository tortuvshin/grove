// SPDX-License-Identifier: MIT
/**
 * Verify that apps/example is exactly what `grove init` would install:
 * every file the registry's full scaffold ships exists at its target
 * under apps/example/ with identical bytes. The example is the canary
 * for the registry — a component edited in one place but not the
 * other shows up here as a gate failure.
 *
 * The check runs both ways. Registry → example catches an upstream file
 * the example never picked up; example → registry catches a file sitting
 * in apps/example that the scaffold does not ship, which a consumer who
 * ran `grove init` would never have. Both directions matter, because
 * `apps/example` is what type-checks the registry's `.astro` sources.
 *
 *   node scripts/check-example-mirrors-registry.mjs          verify
 *   node scripts/check-example-mirrors-registry.mjs --write  copy the
 *       scaffold over apps/example and refresh
 *       apps/example/.grove/registry.lock.json (what `grove update`
 *       compares against). The lockfile is committed — it is the
 *       install-time snapshot a real consumer ships, and the example
 *       is only a faithful consumer if it carries one.
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import {
  buildFullRegistry,
  lockEntriesFor,
  ROOT,
  readRegistryVersion,
  readSource,
  SCAFFOLD_ID,
  SCAFFOLD_ITEM,
  targetToProjectPath,
} from './lib/registry.mjs';

const exampleRoot = resolve(ROOT, 'apps/example');
const lockfilePath = resolve(exampleRoot, '.grove/registry.lock.json');
const writeMode = process.argv.includes('--write');

const scaffold = buildFullRegistry().items.find((item) => item.name === SCAFFOLD_ITEM);

if (writeMode) {
  // Copy the scaffold over the example first — refreshing only the
  // lockfile would record hashes for files that are not on disk.
  let copied = 0;
  for (const file of scaffold.files) {
    const examplePath = resolve(exampleRoot, targetToProjectPath(file.target));
    const source = readSource(file.path);
    if (existsSync(examplePath) && (await readFile(examplePath, 'utf8')) === source) continue;
    await mkdir(dirname(examplePath), { recursive: true });
    await writeFile(examplePath, source);
    copied++;
  }
  console.log(`Copied ${copied} file(s) into apps/example.`);

  const files = lockEntriesFor(scaffold);
  const lock = {
    scaffold: SCAFFOLD_ID,
    scaffoldVersion: readRegistryVersion(),
    installedAt: new Date().toISOString().slice(0, 10),
    fileCount: files.length,
    files,
  };
  await mkdir(resolve(exampleRoot, '.grove'), { recursive: true });
  await writeFile(lockfilePath, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`Wrote ${relative(ROOT, lockfilePath)} (${files.length} files)`);
  process.exit(0);
}

let missing = 0;
let drifted = 0;
for (const file of scaffold.files) {
  const projectPath = targetToProjectPath(file.target);
  const examplePath = resolve(exampleRoot, projectPath);
  if (!existsSync(examplePath)) {
    console.error(`missing: ${projectPath}`);
    missing++;
    continue;
  }
  if ((await readFile(examplePath, 'utf8')) !== readSource(file.path)) {
    console.error(`drifted: ${projectPath}  (registry: ${file.path})`);
    drifted++;
  }
}
// The other direction: anything under apps/example/src that the scaffold
// does not ship. A `grove init` project would not have it, so it is drift
// — and it type-checks under the example's settings, hiding the fact that
// the registry never sees it.
const shipped = new Set(scaffold.files.map((file) => targetToProjectPath(file.target)));
// Files a real consumer legitimately owns on top of the scaffold. Keep
// this list short and justified — every entry is something `grove init`
// does NOT create, so it must earn its place.
const CONSUMER_OWNED = new Set([
  // The override stylesheet the Grove integration auto-loads after
  // system.css. `packages/astro/src/theme.test.ts` reads this exact file
  // to assert an override file never redeclares the design tokens.
  'src/styles/global.css',
]);
let extra = 0;
async function walk(dir) {
  for (const entry of await readdir(resolve(exampleRoot, dir), { withFileTypes: true })) {
    const projectPath = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      await walk(projectPath);
      continue;
    }
    if (!shipped.has(projectPath) && !CONSUMER_OWNED.has(projectPath)) {
      console.error(`extra:   ${projectPath}  (not shipped by ${SCAFFOLD_ID})`);
      extra++;
    }
  }
}
await walk('src');

if (missing + drifted + extra > 0) {
  console.error(
    `\n${missing + drifted + extra} file(s) differ from the registry ` +
      `(${missing} missing, ${drifted} drifted, ${extra} extra).`,
  );
  console.error(
    'Run `pnpm example:sync` to copy the registry over apps/example, ' +
      'or delete the extra files / add them to the registry.',
  );
  process.exit(1);
}
console.log(`apps/example mirrors ${SCAFFOLD_ID} (${scaffold.files.length} files in lockstep).`);
