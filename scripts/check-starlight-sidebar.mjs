#!/usr/bin/env node
// scripts/check-starlight-sidebar.mjs
//
// Two-way Starlight sidebar validation:
//
//   1. Every `slug: 'foo/bar'` in apps/docs/astro.config.mjs must point to
//      an existing .md or .mdx file under apps/docs/src/content/docs/.
//   2. Every .md/.mdx file under apps/docs/src/content/docs/ must appear
//      either in the sidebar or in the navLinks section (no orphans).
//
// Astro's own build performs check (1) but fails on the first missing
// slug; this script surfaces *all* missing slugs at once and exits in
// milliseconds. Check (2) catches the inverse — files that no one can
// find because they aren't linked anywhere.
//
// Usage:   node scripts/check-starlight-sidebar.mjs [--check-orphans]
// Exits:   0 if every slug resolves and no orphans exist; 1 otherwise.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = resolve(repoRoot, 'apps/docs/astro.config.mjs');
// The sidebar itself lives in its own module (shared with the llms.txt
// endpoint); astro.config.mjs only imports it. Scan both, so the slug
// check sees the sidebar and the orphan check still sees navLinks.
const sidebarPath = resolve(repoRoot, 'apps/docs/src/data/docs-sidebar.mjs');
const docsRoot = resolve(repoRoot, 'apps/docs/src/content/docs');

const checkOrphans = process.argv.includes('--check-orphans');

const src = `${readFileSync(configPath, 'utf8')}\n${readFileSync(sidebarPath, 'utf8')}`;

// Match `slug: 'foo/bar'` and `slug: "foo/bar"` anywhere in the
// config. The Starlight sidebar config typically writes slugs
// inline as `{ label: '...', slug: '...' }`, so a line-anchored
// regex would miss them. The Starlight sidebar config uses single
// quotes by convention, but tolerate double quotes too.
const slugRe = /\bslug:\s*['"]([^'"]+)['"]/g;
const slugs = [...src.matchAll(slugRe)].map((m) => m[1]);

// Match navLinks `link: '/path/'` for orphan detection.
const navLinkRe = /\blink:\s*['"]([^'"]+)['"]/g;
const navLinks = [...src.matchAll(navLinkRe)].map((m) => m[1]);

// Sidebar slugs are local file paths under apps/docs/src/content/docs/.
// External URLs (if any ever appear) are filtered out.
const localSlugs = slugs.filter((s) => !s.startsWith('http'));

let missing = 0;
const missingList = [];
for (const slug of localSlugs) {
  const md = resolve(docsRoot, `${slug}.md`);
  const mdx = resolve(docsRoot, `${slug}.mdx`);
  if (!existsSync(md) && !existsSync(mdx)) {
    console.error(`[sidebar-check] missing file for slug: ${slug}`);
    missingList.push(slug);
    missing++;
  }
}

if (missing > 0) {
  console.error(
    `\n[sidebar-check] FAIL — ${missing} of ${localSlugs.length} sidebar slug(s) point to a missing file.`,
  );
  process.exit(1);
}

let orphans = 0;
const orphanList = [];

if (checkOrphans) {
  // Walk docsRoot recursively and find all .md/.mdx files.
  const allFiles = [];
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (entry.endsWith('.md') || entry.endsWith('.mdx')) {
        allFiles.push(relative(docsRoot, full));
      }
    }
  }
  walk(docsRoot);

  // Files referenced by sidebar slugs (relative path without extension).
  const referencedFiles = new Set(
    localSlugs.map((slug) => `${slug}.md`).concat(localSlugs.map((slug) => `${slug}.mdx`)),
  );

  // Files referenced by navLinks: '/introduction/' → 'introduction.md'.
  for (const link of navLinks) {
    if (!link.startsWith('/')) continue;
    const slug = link.replace(/^\//, '').replace(/\/$/, '');
    if (slug) {
      referencedFiles.add(`${slug}.md`);
      referencedFiles.add(`${slug}.mdx`);
    }
  }

  for (const file of allFiles) {
    if (!referencedFiles.has(file)) {
      console.error(`[sidebar-check] orphan file (not in sidebar or navLinks): ${file}`);
      orphanList.push(file);
      orphans++;
    }
  }

  if (orphans > 0) {
    console.error(
      `\n[sidebar-check] FAIL — ${orphans} orphan file(s) under apps/docs/src/content/docs/. Add them to the sidebar or navLinks, or remove them.`,
    );
    process.exit(1);
  }
}

const tail = checkOrphans ? `, ${orphanList.length === 0 ? 'no' : 'no'} orphans found` : '';
console.log(
  `[sidebar-check] ok — ${localSlugs.length} sidebar slug(s) verified against apps/docs/src/content/docs/${tail}`,
);
