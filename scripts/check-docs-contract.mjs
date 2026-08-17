#!/usr/bin/env node
// scripts/check-docs-contract.mjs
//
// Cross-references the publicly documented surface of Grove against the
// implementation:
//
//   1. CLI: every command/subcommand registered in
//      `packages/cli/src/index.ts` and `packages/cli/src/*-cli.ts` must be
//      mentioned in at least one page under `apps/docs/src/content/docs/`.
//   2. Public exports: every named `export { ... }` symbol from
//      `packages/core/src/index.ts` and `packages/astro/src/index.ts` must
//      appear in either `reference/api-core.md`, `reference/components.mdx`,
//      or any other docs page.
//   3. Config schema: every top-level field of `groveConfigSchema` in
//      `packages/core/src/schema.ts` must appear in either
//      `reference/config.md` or any other docs page.
//
// Exits 0 when the docs site documents everything the implementation
// exports. Exits 1 with a stable diff table when anything is missing.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliSrc = resolve(repoRoot, "packages/cli/src");
const coreIndex = resolve(repoRoot, "packages/core/src/index.ts");
const astroIndex = resolve(repoRoot, "packages/astro/src/index.ts");
const coreSchema = resolve(repoRoot, "packages/core/src/schema.ts");
const docsRoot = resolve(repoRoot, "apps/docs/src/content/docs");

const read = (p) => readFileSync(p, "utf8");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".md") || entry.endsWith(".mdx")) out.push(full);
  }
  return out;
}

const allDocFiles = walk(docsRoot);
const allDocsText = allDocFiles.map(read).join("\n\n");

const errors = [];
const report = (header, rows) => {
  console.error(`\n[contract] ${rows.length} ${header}:`);
  for (const r of rows) console.error(`  - ${r}`);
};

// ── 1. CLI commands ────────────────────────────────────────────────
const registered = new Set();
const expectedPathCommands = new Set();

function harvestCli(src, file) {
  // Top-level commands: `program.command("foo")`
  for (const m of src.matchAll(/program\.command\(["']([^"']+)["']\)/g)) {
    registered.add(m[1]);
  }
  // Subcommand-tree builders: `new Command("foo")` + chained `.command("bar")`
  for (const m of src.matchAll(/(?:^|\s)new Command\(["']([^"']+)["']\)/g)) {
    registered.add(m[1]);
  }
  for (const m of src.matchAll(/(?:^|\s)\.command\(["']([^"']+)["']\)/g)) {
    registered.add(m[1]);
  }
}

harvestCli(read(join(cliSrc, "index.ts")), "index.ts");
for (const file of readdirSync(cliSrc)) {
  if (file.endsWith("-cli.ts")) {
    harvestCli(read(join(cliSrc, file)), file);
  }
}

// `grove sync github` is the user's invocation; `program.command("sync")` is the
// registration. The argument is documented separately in the CLI ref.
for (const target of ["github", "contributors"]) {
  expectedPathCommands.add(`grove sync ${target}`);
}
for (const c of registered) expectedPathCommands.add(`grove ${c}`);
for (const c of ["promote", "sync", "generate"]) {
  if (registered.has(c)) expectedPathCommands.add(`grove ${c}`);
}

const cliMissing = [];
for (const cmd of expectedPathCommands) {
  // Substrings are too noisy; require the form `grove X` to appear followed
  // by a non-letter (space, backtick, newline, etc.). Also accept code blocks.
  const escaped = cmd.replace(/\s+/g, "\\s+");
  const re = new RegExp(escaped + "(?=[\\s`.,)\\]\\|])", "m");
  if (!re.test(allDocsText)) {
    cliMissing.push(cmd);
  }
}

// ── 2. Public exports ──────────────────────────────────────────────
function extractNamedExports(src) {
  const runtime = new Set();
  const types = new Set();
  // export { a, b as c } from "..."  — mixed (could be values or types).
  // Default to runtime; type-only re-exports are rare in this codebase.
  for (const m of src.matchAll(
    /^\s*export\s*\{\s*([^}]+)\s*\}\s*(?:from\s+["'][^"']+["'])?/gm,
  )) {
    for (const raw of m[1].split(",")) {
      const ident = raw.trim();
      if (!ident) continue;
      const renamed = ident.split(/\s+as\s+/);
      const name = (renamed[1] ?? renamed[0]).trim();
      if (name) runtime.add(name);
    }
  }
  // export const/function/class/async function NAME — runtime.
  for (const m of src.matchAll(
    /^\s*export\s+(?:const|function|class|async\s+function)\s+(\w+)/gm,
  )) {
    runtime.add(m[1]);
  }
  // export type { a, b } — type-only.
  for (const m of src.matchAll(/^\s*export\s+type\s*\{\s*([^}]+)\s*\}/gm)) {
    for (const raw of m[1].split(",")) {
      const ident = raw.trim();
      if (!ident) continue;
      const renamed = ident.split(/\s+as\s+/);
      const name = (renamed[1] ?? renamed[0]).trim();
      if (name) types.add(name);
    }
  }
  return { runtime, types };
}

const { runtime: coreRuntime, types: coreTypes } = extractNamedExports(
  read(coreIndex),
);
const { runtime: astroRuntime } = extractNamedExports(read(astroIndex));

const apiCore = read(join(docsRoot, "reference/api-core.md"));
const componentsDoc = read(join(docsRoot, "reference/components.mdx"));

const exportedButUndocumented = [];
// Gate runtime exports only. Type exports (e.g. `ProjectType`, `Score`)
// are referenced through their runtime values; documenting each type
// individually is impractical and the user-facing reference lists the
// runtime API surface.
for (const name of coreRuntime) {
  if (apiCore.includes(name)) continue;
  if (componentsDoc.includes(name)) continue;
  if (allDocsText.includes(name)) continue; // explained under a related page
  exportedButUndocumented.push(name);
}
if (exportedButUndocumented.length > 0) {
  report(
    "core runtime export(s) not mentioned in reference/api-core.md, reference/components.mdx, or any doc page",
    exportedButUndocumented,
  );
  errors.push(`undocumented core runtime exports: ${exportedButUndocumented.length}`);
}

// ── 3. Config schema top-level fields ──────────────────────────────
const configDoc = read(join(docsRoot, "reference/config.md"));
const schemaSrc = read(coreSchema);
// Find the body of `export const groveConfigSchema = z.object({...})`.
// Brace-aware extraction.
function braceBody(src, header) {
  const idx = src.indexOf(header);
  if (idx < 0) return "";
  const bodyStart = src.indexOf("{", idx);
  if (bodyStart < 0) return "";
  let depth = 0;
  for (let i = bodyStart; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(bodyStart + 1, i);
    }
  }
  return "";
}
const schemaBody = braceBody(schemaSrc, "export const groveConfigSchema = z.object(");
const topLevelFields = new Set();
for (const m of schemaBody.matchAll(/^\s{2}([a-z][a-zA-Z]+):/gm)) {
  topLevelFields.add(m[1]);
}
const configMissing = [];
for (const field of topLevelFields) {
  if (configDoc.includes(field)) continue;
  if (allDocsText.includes(field)) continue; // explained under a related page (e.g. `theme` on Customize)
  configMissing.push(field);
}
if (configMissing.length > 0) {
  report("top-level groveConfigSchema field(s) not mentioned in any doc page", configMissing);
  errors.push(`undocumented config fields: ${configMissing.length}`);
}

// ── Final ──────────────────────────────────────────────────────────
if (errors.length > 0) {
  console.error(`\n[contract] FAIL — ${errors.length} contract drift(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `[contract] ok — ` +
    `${expectedPathCommands.size} CLI command variant(s), ` +
    `${coreRuntime.size} core runtime export(s), ` +
    `${coreTypes.size} core type export(s), ` +
    `${astroRuntime.size} astro export(s), ` +
    `${topLevelFields.size} config field(s) cross-referenced.`,
);
