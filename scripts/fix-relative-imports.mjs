// SPDX-License-Identifier: MIT
/**
 * Fix relative imports in moved components.
 *
 * Phase 4's mechanical move changed every file's on-disk path,
 * which broke three categories of relative import that the
 * primary migration script handled inline but that hand-applied
 * fixes (sed/perl during the early debugging) introduced
 * inconsistency around. This script runs a single pass that
 * resolves each `from "<relative>"` against the file's actual
 * location and corrects the path.
 *
 *   node scripts/fix-relative-imports.mjs
 *
 * Idempotent — re-runs are safe.
 */
import { existsSync } from "node:fs";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, join } from "node:path";

const ROOTS = [
  resolve("apps/example/src"),
  resolve("packages/registry/default"),
];

const TARGET_EXTS = new Set([".astro", ".ts", ".tsx", ".js"]);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (TARGET_EXTS.has("." + entry.name.split(".").pop())) yield full;
  }
}

function kebab(name) {
  return name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

function normalizeSpec(spec) {
  // Convert a relative spec's final segment from PascalCase to
  // kebab-case if needed (Phase 4 renamed files; older imports
  // still mention the PascalCase names).
  return spec.replace(
    /\/([A-Z][A-Za-z]*)(?=\.[a-z]+$|\/|$)/g,
    (whole, name) => `/${kebab(name)}`,
  );
}

function resolveImport(fromFile, spec) {
  // Resolve a relative spec against the importing file's directory.
  // Walks up if needed: if the literal path doesn't exist, try the
  // basename one level up. Lets us fix imports that should be `../../x`
  // but were written as `../x` after a directory was inserted.
  // Also tries kebab-case variants of PascalCase paths.
  if (!spec.startsWith(".")) return null;
  const fromDir = dirname(fromFile);
  const kebabbed = normalizeSpec(spec);
  const variants = kebabbed === spec ? [spec] : [spec, kebabbed];
  const candidates = [];
  for (const v of variants) {
    const base = resolve(fromDir, v);
    candidates.push(base, ...[".astro", ".ts", ".js"].map((e) => base + e));
    const stripped = v.replace(/^(\.\.[\/])+/, "");
    const upOne = resolve(fromDir, "..", stripped);
    candidates.push(upOne, ...[".astro", ".ts", ".js"].map((e) => upOne + e));
    const upTwo = resolve(fromDir, "../..", stripped);
    candidates.push(upTwo, ...[".astro", ".ts", ".js"].map((e) => upTwo + e));
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function findTarget(roots, sourceFile) {
  // Given an existing file path, find which root it lives under.
  for (const root of roots) {
    if (sourceFile.startsWith(root + "/")) {
      return { root, rel: sourceFile.slice(root.length + 1) };
    }
  }
  return null;
}

async function main() {
  let totalRewrites = 0;
  for (const root of ROOTS) {
    for await (const file of walk(root)) {
      const source = await readFile(file, "utf8");
      const fileDir = dirname(file);
      const replaced = source.replace(
        /from\s+["']([^"']+)["']/g,
        (whole, spec) => {
          if (!spec.startsWith(".")) return whole;
          // Resolve the spec to an existing absolute path.
          const resolved = resolveImport(file, spec);
          if (!resolved) return whole;
          const sourceInfo = findTarget(ROOTS, file);
          const targetInfo = findTarget(ROOTS, resolved);
          if (!sourceInfo || !targetInfo) return whole;
          // Compute the relative path from the importing file's
          // directory to the target file, preserving the extension.
          const wantRel = relative(fileDir, resolved);
          if (whole.includes(wantRel)) return whole; // already correct
          totalRewrites++;
          return `from "${wantRel.split("\\").join("/")}"`;
        },
      );
      if (replaced !== source) {
        await writeFile(file, replaced);
      }
    }
  }
  console.log(`Rewrote ${totalRewrites} relative imports across ${ROOTS.length} roots.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
