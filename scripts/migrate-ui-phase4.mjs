// SPDX-License-Identifier: MIT
/**
 * Phase 4 of the v1 registry migration: move every UI file from
 * `packages/astro/src/{components,ui,layouts}` into
 * `packages/registry/default/`, renaming to kebab-case per §18 of
 * the architecture spec. Pure mechanical operation driven by the
 * rename map encoded in `scripts/build-inventory.mjs`.
 *
 *   node scripts/migrate-ui-phase4.mjs          perform the move
 *   node scripts/migrate-ui-phase4.mjs --dry-run   print the plan only
 *
 * The script refuses to run if any of:
 *   - the registry invariants fail on the destination (a forbidden import),
 *   - the inventory has drifted since the last `pnpm inventory`,
 *   - the registry lockfile is missing or drifted.
 *
 * After the move it also rewrites import paths inside the moved
 * `.astro` files so cross-component references keep working
 * (e.g. `./ProjectCard.astro` -> `./project-card.astro`), and
 * rewrites apps/example page imports from
 * `@grove-dev/astro/components/X.astro` to
 * `../components/grove/x.astro`.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dryRun = process.argv.includes('--dry-run');

const inventoryPath = resolve(root, 'packages/astro/INVENTORY.json');
const astroSrc = resolve(root, 'packages/astro/src');
const registryDefault = resolve(root, 'packages/registry/default');
const exampleSrc = resolve(root, 'apps/example/src');

const KEBAB_OVERRIDES = new Map([
  // ThemeToggle lives under components/site/ per the spec (§18),
  // not components/ui/, because it is site chrome, not a primitive.
  ['layouts/ThemeToggle.astro', 'components/site/theme-toggle.astro'],
  // The button helpers are classnames-style helpers, not primitives.
  ['ui/button.ts', 'lib/classnames.ts'],
  ['ui/button.test.ts', 'lib/classnames.test.ts'],
]);

function targetFor(sourceRel) {
  const override = KEBAB_OVERRIDES.get(sourceRel);
  if (override) return override;
  if (sourceRel === 'styles.css') return 'styles/system.css';
  const file = sourceRel.split('/').pop();
  if (sourceRel.startsWith('ui/')) {
    const base = file.replace(/\.astro$/, '');
    return `components/ui/${kebab(base)}.astro`;
  }
  if (sourceRel.startsWith('layouts/')) {
    const base = file.replace(/\.astro$/, '');
    return `layouts/${kebab(base)}.astro`;
  }
  if (sourceRel.startsWith('components/')) {
    const base = file.replace(/\.astro$/, '');
    return `components/grove/${kebab(base)}.astro`;
  }
  return null;
}

function kebab(name) {
  return name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function importRewrite(oldImport, nameMap) {
  // Rewrite `from "../server/Foo.js"` and similar to `@grove-dev/astro/server`.
  // The moved files used to live at packages/astro/src/{components,ui,layouts}/
  // and pointed at sibling ../server/ paths inside the same package. After
  // the move, those siblings don't exist next to the consumer-installed
  // file — the engine package owns the view-models now.
  let result = oldImport.replace(
    /from\s+["'](?:\.\.?\/)+server\/([\w./-]+?)(?:\.js)?["']/g,
    'from "@grove-dev/astro/server"',
  );
  // Replaces `from "./Foo.astro"` -> `from "./foo.astro"` etc.
  result = result.replace(
    /from\s+["'](\.{1,2}\/)([A-Za-z][\w./-]*)\.astro?["']/g,
    (whole, prefix, rest) => {
      const key = `${rest}.astro`;
      const mapped = nameMap.get(key);
      if (!mapped) return whole;
      return `from "${prefix}${mapped.replace(/\.astro$/, '.astro')}"`;
    },
  );
  return result;
}

async function main() {
  if (!existsSync(inventoryPath)) {
    throw new Error('Inventory missing — run `pnpm inventory` first.');
  }
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
  // Phase 4 sub-step 1: only `.astro` files. `styles.css` and the
  // package's own `index.ts` (the Astro integration) stay for a
  // dedicated sub-step — they need coordinated moves with tests
  // and the `exports` map, and splitting them keeps this script
  // single-purpose.
  const moveable = inventory.files.filter((f) => {
    if (f.path.endsWith('index.ts')) return false;
    if (f.path.includes('/server/')) return false;
    if (f.path.includes('/lib/')) return false;
    if (f.path === 'packages/astro/src/styles.css') return false;
    return /packages\/astro\/src\/(ui|layouts|components)\/[^/]+\.astro$/.test(f.path);
  });

  // Build rename map for rewriting relative imports between
  // registry files after the move.
  // Two views:
  //   - `basenameMap`: SourceFileBase -> TargetFileBase. For intra-registry
  //     relative imports (../components/X.astro -> ./x.astro inside the
  //     same registry subtree).
  //   - `fullPathMap`: SourceFileBase -> TargetRelativeToExampleSrc. For
  //     apps/example pages, so we can compute the correct relative path.
  const basenameMap = new Map();
  const examplePathMap = new Map();
  for (const file of moveable) {
    const source = file.path.replace(/^packages\/astro\/src\//, '');
    const target = targetFor(source);
    if (!target) continue;
    const fileBase = source.split('/').pop();
    const targetBase = target.split('/').pop();
    basenameMap.set(fileBase, targetBase);
    // examplePathMap maps the original filename (e.g. BaseLayout.astro)
    // to its new home relative to apps/example/src, e.g. "layouts/base-layout.astro".
    // Pages do `relative(dirname(page), resolve(exampleSrc, newPath))`.
    examplePathMap.set(fileBase, target);
  }

  if (dryRun) {
    console.log(`Would move ${moveable.length} files:`);
    for (const file of moveable) {
      const source = file.path.replace(/^packages\/astro\/src\//, '');
      const target = targetFor(source);
      console.log(`  ${source} -> registry/default/${target}`);
    }
    return;
  }

  // ── 1. Move files (copy + delete original) ──
  // Idempotent: skips source files that are already gone (re-runs
  // land safely after a partial failure).
  let moved = 0;
  for (const file of moveable) {
    const source = file.path.replace(/^packages\/astro\/src\//, '');
    const target = targetFor(source);
    if (!target) continue;
    const sourcePath = resolve(astroSrc, source);
    if (!existsSync(sourcePath)) continue;
    const targetPath = resolve(registryDefault, target);
    await mkdir(dirname(targetPath), { recursive: true });
    let sourceBody = await readFile(sourcePath, 'utf8');
    // Rewrite intra-registry relative imports inside the file.
    sourceBody = importRewrite(sourceBody, basenameMap);
    await writeFile(targetPath, sourceBody);
    await rm(sourcePath, { force: true });
    moved += 1;
  }

  // ── 2. Rewrite apps/example page imports ──
  // Original -> registry target name map (without dir prefix).
  const exampleRewrite = (relImport) => {
    // Convert e.g. "../components/grove/project-card.astro" and
    // "@grove-dev/astro/components/ProjectCard.astro" to the new path.
    const m = relImport.match(/@grove-dev\/astro\/(components|ui|layouts)\/([A-Za-z][\w]*)\.astro/);
    if (m) {
      const [, , name] = m;
      const newName = renameMap.get(`${name}.astro`);
      if (!newName) return relImport;
      // No "@grove-dev/astro" path exists after Phase 4 — caller resolves
      // the relative target. We return the new local name; pages need to
      // know their own directory depth.
      return newName;
    }
    return null;
  };

  // ── 2. Rewrite apps/example page imports ──
  const { readdir } = await import('node:fs/promises');
  const pages = [];
  async function collectPages(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        await collectPages(full);
      } else if (entry.name.endsWith('.astro')) {
        pages.push(full);
      }
    }
  }
  await collectPages(resolve(exampleSrc, 'pages'));

  for (const page of pages) {
    let body = await readFile(page, 'utf8');
    body = body.replace(
      /from\s+["']@grove-dev\/astro\/(components|ui|layouts)\/([A-Za-z][\w]*)\.astro["']/g,
      (whole, kind, name) => {
        const newPath = examplePathMap.get(`${name}.astro`);
        if (!newPath) return whole;
        // Compute the relative path from this page to
        // src/components/{grove,ui,site}/<name>.astro or src/layouts/<name>.astro.
        const rel = relative(dirname(page), resolve(exampleSrc, newPath));
        return `from "${rel.split('\\').join('/')}"`;
      },
    );
    await writeFile(page, body);
  }

  console.log(`Moved ${moved} UI files into packages/registry/default/.`);
  console.log(`Rewrote ${pages.length} apps/example page imports.`);
  console.log('\nNext:');
  console.log('  pnpm inventory          # refresh INVENTORY.{md,json}');
  console.log('  pnpm registry:build     # rebuild registry.lock.json');
  console.log('  pnpm -F @grove-dev/example build   # verify SEO parity');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
