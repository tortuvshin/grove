#!/usr/bin/env node
// scripts/check-starlight-sidebar.mjs
//
// Smoke-test the Starlight sidebar: every `slug: 'foo/bar'` in
// docs/astro.config.mjs must point to an existing .md or .mdx file
// under docs/src/content/docs/. Astro's own build performs the same
// check, but this script surfaces *all* missing slugs at once and
// exits in milliseconds, so editor loops and CI catch the issue
// before a full `astro build`.
//
// Usage:   node scripts/check-starlight-sidebar.mjs
// Exits:   0 if every slug resolves; 1 otherwise.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = resolve(repoRoot, "docs/astro.config.mjs");
const docsRoot = resolve(repoRoot, "docs/src/content/docs");

const src = readFileSync(configPath, "utf8");

// Match `slug: 'foo/bar'` and `slug: "foo/bar"` anywhere in the
// config. The Starlight sidebar config typically writes slugs
// inline as `{ label: '...', slug: '...' }`, so a line-anchored
// regex would miss them. The Starlight sidebar config uses single
// quotes by convention, but tolerate double quotes too.
const slugRe = /\bslug:\s*['"]([^'"]+)['"]/g;
const slugs = [...src.matchAll(slugRe)].map((m) => m[1]);

// Sidebar slugs are local file paths under docs/src/content/docs/.
// External URLs (if any ever appear) are filtered out.
const localSlugs = slugs.filter((s) => !s.startsWith("http"));

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
console.log(
    `[sidebar-check] ok — ${localSlugs.length} sidebar slug(s) verified against docs/src/content/docs/`,
);
