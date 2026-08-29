// SPDX-License-Identifier: MIT
/**
 * Regenerate `packages/astro/INVENTORY.{md,json}` — the canonical
 * UI inventory for the v1 migration.
 *
 *   node scripts/build-inventory.mjs           write both files
 *   node scripts/build-inventory.mjs --check   exit 1 if drifted
 *
 * For every `.astro` and `.ts` file under `packages/astro/src/`
 * (excluding tests and `.d.ts`), the script reports:
 *
 *   - the path relative to the repo root
 *   - a `kind` classification per §18 of the v1 architecture spec:
 *       primitive | domain-ui | composition | layout | site | styles
 *   - whether the file contains "business logic" (defined as
 *     imports from the forbidden core subpaths per §22)
 *   - the destination path under the v1 registry scaffold
 *
 * Why this is a committed artifact rather than a runtime check:
 * the migration is large and the rename map (Phase 4) must be
 * reviewable as a single document. Generating it from the source
 * keeps it honest — a maintainer who adds a `.astro` without
 * updating this script will see the drift on the next `inventory:check`.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceDir = resolve(root, 'packages/astro/src');
const inventoryJsonPath = resolve(root, 'packages/astro/INVENTORY.json');
const inventoryMdPath = resolve(root, 'packages/astro/INVENTORY.md');

const check = process.argv.includes('--check');

// Forbidden subpaths per §22 of the v1 architecture spec.
// Registry UI may import only `@grove-dev/core/types` and
// `@grove-dev/astro/server` models. It must not import the runtime
// component/layout subpaths from `@grove-dev/astro` — those go away
// in v1. (`@grove-dev/core/directory` is the browser-safe subpath
// for filter/sort/facet logic and is permitted in client scripts.)
const FORBIDDEN_IMPORTS = [
  /from\s+["']@grove-dev\/astro\/components/,
  /from\s+["']@grove-dev\/astro\/ui/,
  /from\s+["']@grove-dev\/astro\/layouts/,
];

// Components explicitly known to host client-side domain logic.
// This list shrinks during Phase 2 as logic moves into core/server;
// new entries should be added if a `.astro` grows new business logic.
const KNOWN_CLIENT_CONTROLLERS = new Set([
  'components/DirectoryIndexClient.astro',
  'components/SubmissionClient.astro',
]);

// Manual override: components that have light, presentation-only
// "business logic" (URL builders, label derivation) and should be
// flagged but not classified as `client-controller`.
const KNOWN_LIGHT_LOGIC = new Set([
  'components/RefinePanel.astro',
  'components/CategoryGrid.astro',
  'components/StackGrid.astro',
  'components/Hero.astro',
  'components/RecordSection.astro',
]);

const KIND_BY_DIR = {
  ui: (file) =>
    KNOWN_LIGHT_LOGIC.has(file) || hasClientBehavior(file) ? 'composition' : 'primitive',
  layouts: () => 'layout',
  components: (file) => {
    if (KNOWN_CLIENT_CONTROLLERS.has(file)) return 'composition';
    if (KNOWN_LIGHT_LOGIC.has(file)) return 'composition';
    if (file.endsWith('Icon.astro')) return 'primitive';
    return 'domain-ui';
  },
  'styles.css': () => 'styles',
};

/** Heuristic: does this `.astro` file contain client-side JS? */
function hasClientBehavior(file) {
  return KNOWN_LIGHT_LOGIC.has(file) || KNOWN_CLIENT_CONTROLLERS.has(file);
}

function classify(relPath) {
  const parts = relPath.split('/');
  if (parts[0] === 'ui') return KIND_BY_DIR.ui(relPath.replace(/^ui\//, ''));
  if (parts[0] === 'layouts') return KIND_BY_DIR.layouts(relPath);
  if (parts[0] === 'components') return KIND_BY_DIR.components(relPath);
  if (relPath === 'styles.css') return 'styles';
  return 'lib';
}

/** Map current path → registry destination per §18 of the spec. */
function registryTarget(relPath) {
  const file = relPath.split('/').pop();
  if (relPath === 'styles.css') return 'registry/default/styles/system.css';
  if (relPath.startsWith('ui/')) {
    if (file === 'button.ts') return 'registry/default/lib/classnames.ts';
    if (file === 'button.test.ts') return 'registry/default/lib/classnames.test.ts';
    const base = file.replace(/\.astro$/, '');
    return `registry/default/components/ui/${kebab(base)}.astro`;
  }
  if (relPath.startsWith('layouts/')) {
    const base = file.replace(/\.astro$/, '');
    if (base === 'ThemeToggle') return `registry/default/components/site/theme-toggle.astro`;
    return `registry/default/layouts/${kebab(base)}.astro`;
  }
  if (relPath.startsWith('components/')) {
    const base = file.replace(/\.astro$/, '');
    return `registry/default/components/grove/${kebab(base)}.astro`;
  }
  return `registry/default/lib/${file}`;
}

function kebab(name) {
  return name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function findForbiddenImports(source) {
  const hits = [];
  for (const pattern of FORBIDDEN_IMPORTS) {
    const match = source.match(pattern);
    if (match) hits.push(match[0]);
  }
  return hits;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function build() {
  const files = [];
  for await (const full of walk(sourceDir)) {
    const rel = relative(root, full);
    // Normalize to the "src/..." form so classify/registryTarget can
    // match the documented path layout, not the repo-relative form.
    const normalized = rel.replace(/^packages\/astro\/src\//, '');
    // Scope: only UI directories are migrating to `@grove-dev/registry`.
    // `server/` (view-models), `lib/` (helpers), and `pages/` (reference
    // routes that are not what gets installed) stay in `@grove-dev/astro`.
    const isUi = /^(ui|layouts|components)\//.test(normalized) || normalized === 'styles.css';
    if (!isUi) continue;
    if (rel.endsWith('.d.ts') || rel.endsWith('.test.ts')) continue;
    const ext = full.split('.').pop();
    if (ext !== 'astro' && ext !== 'ts' && ext !== 'css') continue;
    const source = await readFile(full, 'utf8');
    files.push({
      path: rel,
      kind: classify(normalized),
      hasBusinessLogic:
        KNOWN_CLIENT_CONTROLLERS.has(normalized) || KNOWN_LIGHT_LOGIC.has(normalized),
      forbiddenImports: ext === 'astro' ? findForbiddenImports(source) : [],
      hash: sha256(source),
      lines: source.split('\n').length,
      target: registryTarget(normalized),
    });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

function renderJson(files) {
  return `${JSON.stringify(
    {
      sourceRoot: 'packages/astro/src',
      fileCount: files.length,
      businessLogicCount: files.filter((f) => f.hasBusinessLogic).length,
      forbiddenImportCount: files.map((f) => f.forbiddenImports.length).reduce((a, b) => a + b, 0),
      files,
    },
    null,
    2,
  )}\n`;
}

function renderMarkdown(files) {
  const header = [
    '# `packages/astro` UI Inventory',
    '',
    '> **Generated by `scripts/build-inventory.mjs`** — do not edit by hand.',
    '> Run `pnpm inventory` to regenerate, `pnpm inventory:check` to verify.',
    '',
    'Per [the v1 architecture spec](../docs/v1-architecture.md), every `.astro`',
    'and `.ts` file in this directory is migrating to `packages/registry/default/`',
    'in Phase 4 of the plan. This table is the rename map.',
    '',
    '## Summary',
    '',
    `| Metric | Count |`,
    `| --- | --- |`,
    `| Total files inventoried | ${files.length} |`,
    `| Files with business logic to extract | ${files.filter((f) => f.hasBusinessLogic).length} |`,
    `| Forbidden core subpath imports | ${files.map((f) => f.forbiddenImports.length).reduce((a, b) => a + b, 0)} |`,
    '',
    '## File Table',
    '',
    '| Path | Kind | Lines | Business logic? | Forbidden imports | Destination |',
    '| --- | --- | ---: | :---: | --- | --- |',
  ];
  const rows = files.map((f) => {
    const flag = f.hasBusinessLogic ? '✓' : '';
    const forbidden = f.forbiddenImports.length > 0 ? `${f.forbiddenImports.length} hit(s)` : '';
    return `| \`${f.path}\` | ${f.kind} | ${f.lines} | ${flag} | ${forbidden} | \`${f.target}\` |`;
  });
  return `${[...header, ...rows, ''].join('\n')}`;
}

async function main() {
  const files = await build();
  const json = renderJson(files);
  const md = renderMarkdown(files);

  if (check) {
    let drifted = false;
    for (const [path, contents] of [
      [inventoryJsonPath, json],
      [inventoryMdPath, md],
    ]) {
      if (!existsSync(path) || (await readFile(path, 'utf8')) !== contents) {
        console.error(`drifted: ${relative(root, path)}`);
        drifted = true;
      }
    }
    if (drifted) {
      console.error('\nInventory is out of date — run `pnpm inventory`.');
      process.exit(1);
    }
    console.log(`Inventory is up to date (${files.length} files).`);
    return;
  }

  await writeFile(inventoryJsonPath, json);
  await writeFile(inventoryMdPath, md);
  console.log(`Wrote inventory for ${files.length} files to:`);
  console.log(`  ${relative(root, inventoryJsonPath)}`);
  console.log(`  ${relative(root, inventoryMdPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
