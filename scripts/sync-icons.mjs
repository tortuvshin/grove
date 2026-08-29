// SPDX-License-Identifier: MIT
/**
 * Regenerate the packaged icon set from `scripts/icons.config.mjs`.
 *
 *   node scripts/sync-icons.mjs           write everything
 *   node scripts/sync-icons.mjs --check   exit 1 if the committed
 *                                         output has drifted
 *
 * Outputs, all committed:
 *
 *   packages/astro/assets/icons/{stacks,platforms}/*.svg
 *     The canonical set. `packages/astro` owns its own assets so the
 *     component and the files it points at ship together and cannot
 *     drift apart.
 *
 *   packages/astro/assets/icons/.grove-icons.json
 *     sha256 per file. `syncPackagedIcons` uses it to tell an
 *     untouched copy (safe to overwrite) from one a consumer edited
 *     (leave alone, report).
 *
 *   packages/astro/src/lib/icon-kinds.ts
 *     The `color`/`mono` map `Icon.astro` reads.
 *
 *   apps/example/public/icons/{stacks,platforms}/*.svg
 *     A byte-identical mirror. The example app is the `grove init`
 *     scaffold, so this is what new sites are seeded with.
 *
 * Deliberately NOT wired into `astro build` or `scripts/package-site.mjs`:
 * generation is an explicit, committed act, and `package-site.mjs`
 * runs from the root `postinstall`, where depending on devDeps and a
 * codegen pass would be a real install-reliability regression.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import config from './icons.config.mjs';

const root = resolve(import.meta.dirname, '..');
const localDir = resolve(import.meta.dirname, 'icons/local');
const assetsDir = resolve(root, 'packages/astro/assets/icons');
const kindsFile = resolve(root, 'packages/astro/src/lib/icon-kinds.ts');
const mirrorDir = resolve(root, 'apps/example/public/icons');
const manifestName = '.grove-icons.json';

const check = process.argv.includes('--check');

/** Iconify icon sets, loaded lazily so `--check` still works offline. */
const sets = new Map();
async function iconifySet(prefix) {
  if (!sets.has(prefix)) {
    const path = resolve(root, 'node_modules/@iconify-json', prefix, 'icons.json');
    if (!existsSync(path)) {
      throw new Error(
        `@iconify-json/${prefix} is not installed — run \`pnpm install\` at the repo root.`,
      );
    }
    sets.set(prefix, JSON.parse(await readFile(path, 'utf8')));
  }
  return sets.get(prefix);
}

/**
 * Build one normalized SVG string.
 *
 * Every icon comes out on a *square* viewBox centered on the original
 * artwork. Upstream marks are often tall or wide (`logos:react` is
 * 256x228, `logos:nodejs-icon` is 256x289); without this they render
 * at visibly different optical sizes in the same 16px row.
 */
function renderSvg(body, width, height, kind) {
  const side = Math.max(width, height);
  const minX = -(side - width) / 2;
  const minY = -(side - height) / 2;
  const viewBox = [minX, minY, side, side].map((n) => round(n)).join(' ');

  // For `mono`, drop every color literal so the file is honest about
  // being painted by the page. This is hygiene, not mechanism — CSS
  // masking reads the alpha channel and ignores fill entirely — but
  // it keeps a maintainer from "fixing" a color that does nothing,
  // and it is what `icons.test.ts` asserts.
  const painted =
    kind === 'mono'
      ? body
          .replace(/(fill|stroke)="(?!none")[^"]*"/g, '$1="currentColor"')
          .replace(/(fill|stroke):\s*(?!none)[^;"]+/g, '$1:currentColor')
      : body;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${painted}</svg>\n`;
}

function round(n) {
  return Number.parseFloat(n.toFixed(4));
}

async function resolveSource(spec, kind) {
  const [prefix, name] = splitSpec(spec);

  if (prefix === 'local') {
    const path = resolve(localDir, `${name}.svg`);
    if (!existsSync(path)) {
      throw new Error(`local:${name} — missing ${path}`);
    }
    // Local glyphs are already authored on a square 24x24 grid and
    // already use currentColor; pass them through verbatim so the
    // file on disk is exactly what a maintainer edited.
    return await readFile(path, 'utf8');
  }

  const set = await iconifySet(prefix);
  const icon = set.icons[name];
  if (!icon) {
    throw new Error(`${spec} — not found in @iconify-json/${prefix}`);
  }
  return renderSvg(icon.body, icon.width ?? set.width ?? 24, icon.height ?? set.height ?? 24, kind);
}

function splitSpec(spec) {
  const at = spec.indexOf(':');
  if (at === -1) throw new Error(`Malformed source "${spec}" — expected "prefix:name"`);
  return [spec.slice(0, at), spec.slice(at + 1)];
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

// ---------------------------------------------------------------- build

/** @type {Map<string, string>} `${folder}/${name}.svg` → file contents */
const files = new Map();
/** @type {Array<[string, "color" | "mono"]>} `${folder}/${name}` → kind */
const kinds = [];

for (const folder of ['stacks', 'platforms']) {
  const entries = config[folder];
  for (const name of Object.keys(entries).sort()) {
    const { source, kind } = entries[name];
    files.set(`${folder}/${name}.svg`, await resolveSource(source, kind));
    kinds.push([`${folder}/${name}`, kind]);
  }
}

const manifest = {
  files: Object.fromEntries([...files].map(([path, contents]) => [path, sha256(contents)])),
};
const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;

const kindsSource = `// GENERATED by scripts/sync-icons.mjs — do not edit by hand.
// Run \`pnpm icons:sync\` to regenerate.
/**
 * How each packaged icon is painted.
 *
 * This map CLASSIFIES; it does not gate availability. A name that is
 * absent falls through to the \`<img>\` + initials path, which is what
 * keeps consumer-supplied SVGs under \`public/icons/\` working.
 *
 * Keyed by \`\${folder}/\${resolvedName}\` — the folder matters because
 * \`apple\` exists under both \`stacks/\` and \`platforms/\`.
 */
export type IconKind = 'color' | 'mono';

export const ICON_KINDS: Readonly<Record<string, IconKind>> = {
${kinds
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, kind]) => `  '${key}': '${kind}',`)
  .join('\n')}
};
`;

// ---------------------------------------------------------------- emit

if (check) {
  const problems = [];
  for (const target of [assetsDir, mirrorDir]) {
    for (const [path, contents] of files) {
      const full = resolve(target, path);
      if (!existsSync(full)) {
        problems.push(`missing: ${rel(full)}`);
      } else if ((await readFile(full, 'utf8')) !== contents) {
        problems.push(`drifted: ${rel(full)}`);
      }
    }
    for (const orphan of await orphans(target)) {
      problems.push(`orphan:  ${rel(orphan)}`);
    }
  }
  for (const [file, expected] of [
    [kindsFile, kindsSource],
    [resolve(assetsDir, manifestName), manifestJson],
    [resolve(mirrorDir, manifestName), manifestJson],
  ]) {
    if (!existsSync(file) || (await readFile(file, 'utf8')) !== expected) {
      problems.push(`drifted: ${rel(file)}`);
    }
  }

  if (problems.length > 0) {
    console.error('Icon set is out of date — run `pnpm icons:sync`:\n');
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log(`Icon set is up to date (${files.size} icons).`);
} else {
  for (const target of [assetsDir, mirrorDir]) {
    // Full rebuild: removing the folders is what prunes icons dropped
    // from the config, so a rename never leaves the old file behind.
    await rm(resolve(target, 'stacks'), { recursive: true, force: true });
    await rm(resolve(target, 'platforms'), { recursive: true, force: true });
    for (const [path, contents] of files) {
      const full = resolve(target, path);
      await mkdir(resolve(full, '..'), { recursive: true });
      await writeFile(full, contents);
    }
    // In `assets/` this is the source-of-truth manifest; in the
    // example site's `public/` it doubles as that site's ownership
    // sidecar, so a fresh `grove init` starts out fully owned.
    await writeFile(resolve(target, manifestName), manifestJson);
  }
  await writeFile(kindsFile, kindsSource);

  const mono = kinds.filter(([, kind]) => kind === 'mono').length;
  console.log(`Wrote ${files.size} icons (${mono} mono, ${files.size - mono} color) to`);
  console.log(`  ${rel(assetsDir)}`);
  console.log(`  ${rel(mirrorDir)}`);
}

async function orphans(target) {
  const found = [];
  for (const folder of ['stacks', 'platforms']) {
    const dir = resolve(target, folder);
    if (!existsSync(dir)) continue;
    for (const entry of await readdir(dir)) {
      if (!entry.endsWith('.svg')) continue;
      if (!files.has(`${folder}/${entry}`)) found.push(resolve(dir, entry));
    }
  }
  return found;
}

function rel(path) {
  return path.slice(root.length + 1);
}
