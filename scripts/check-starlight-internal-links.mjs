#!/usr/bin/env node
// scripts/check-starlight-internal-links.mjs
//
// Sibling to `check-starlight-sidebar.mjs`: walk every Markdown / MDX
// content file under `apps/docs/src/content/docs/`, extract every
// internal link (`/path/to/page/`), and assert each target resolves
// to either an `.md` or `.mdx` file under that root. External links
// (`https://...`, `mailto:...`) are skipped — they are out of scope
// for an offline docs-content walk.
//
// Why this exists: the docs site was previously shipping with broken
// internal links (e.g. `/getting-started/add-your-first-record/`
// pointing at a slug whose `.md` file does not exist). The Starlight
// build catches them per-page at runtime, but only the page that
// carries the link — the rest of the docs site can still ship with
// stale cross-links. This script finds them all at once and exits in
// under a second.
//
// Usage:   node scripts/check-starlight-internal-links.mjs
// Exits:   0 if every internal link resolves; 1 otherwise.
//
// Roadmap: v0.5.0 "Strict internal-link lint".

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = resolve(repoRoot, 'apps/docs/src/content/docs');

// Parse the Starlight `redirects:` block from astro.config.mjs so cross-
// links that point at moved or merged URLs are accepted when the
// destination file exists. Without this the link check would report
// every "old → new" cross-reference as broken during the migration.
const astroConfig = readFileSync(resolve(repoRoot, 'apps/docs/astro.config.mjs'), 'utf8');
const redirectsBlockMatch = astroConfig.match(/redirects:\s*\{([\s\S]*?)\n\s{12}\}/);
const redirectMap = new Map();
if (redirectsBlockMatch) {
  const inner = redirectsBlockMatch[1];
  for (const m of inner.matchAll(/['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g)) {
    redirectMap.set(normalize(m[1]), normalize(m[2]));
  }
}
function normalize(p) {
  if (!p.startsWith('/')) p = `/${p}`;
  if (!p.endsWith('/')) p = `${p}/`;
  return p;
}

// Recursively walk `docsRoot` and emit every `.md`/`.mdx` path.
function walkMd(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      out.push(...walkMd(path));
    } else if (entry.endsWith('.md') || entry.endsWith('.mdx')) {
      out.push(path);
    }
  }
  return out;
}

// Pull every internal-looking URL out of a Markdown / MDX body.
// Markdown link forms covered:
//   - inline:   [label](URL)
//   - reference: [label]: URL
// Plus raw HTML <a href="URL">.
//
// We deliberately do NOT match GitHub-style autolinks (`<URL>`)
// because Starlight MDX references component names the same way
// (`<Card>...</Card>`, `<Aside>...</Aside>`); pulling those in as
// "links" produces hundreds of false positives on the showcase pages.
//
// `URL` may end with `#anchor` and/or `?query`; we drop those before
// the existence check but record them so the report is exact.
function extractLinks(src) {
  const links = [];
  const patterns = [
    /\[(?<label>[^\]]*)\]\((?<url>[^)\s]+)(?:\s+"[^"]*")?\)/g,
    /^\[(?<label>[^\]]+)\]:\s+(?<url>\S+)/gm,
    /<a\s+[^>]*href=["'](?<url>[^"']+)["'][^>]*>/gi,
  ];
  for (const re of patterns) {
    for (const match of src.matchAll(re)) {
      const url = match.groups?.url;
      if (url) links.push(url);
    }
  }
  return links;
}

// URL → candidate on-disk paths. Return the first that exists, or
// null if none do. Also returns whether the URL was external (so the
// caller can report ignored externals separately if it wants to).
function resolveLink(url, knownHomepages = new Set(['/'])) {
  // Strip trailing punctuation that Markdown often leaves behind —
  // `(/path/).` shows up when a sentence ends right after a link.
  let u = url.replace(/[).,;]+$/, '');
  // Trim surrounding whitespace.
  u = u.trim();

  // Skip schemes that aren't local paths.
  if (!u.startsWith('/') || u.startsWith('//')) return { external: true, exists: null };
  if (knownHomepages.has(u)) return { external: false, exists: true };

  // Drop fragment + query.
  const pathOnly = u.split('#')[0].split('?')[0];
  if (pathOnly === '' || pathOnly === '/') return { external: false, exists: true };

  // Honor the Starlight `redirects:` block from astro.config.mjs.
  // The destination file is the canonical truth; if it exists on disk,
  // the link is considered valid even though the source path was moved.
  const normalized = normalize(pathOnly);
  if (redirectMap.has(normalized)) {
    const dest = redirectMap.get(normalized);
    if (resolveLink(dest).exists) return { external: false, exists: dest };
  }

  // Trailing-slash normalization: try both `path/index.md` and
  // `path.md` to match Starlight's `format: 'directory'` build.
  // Strip the leading slash so `join` (not `resolve`) treats the path
  // as relative — `resolve(docsRoot, "/foo")` ignores `docsRoot` and
  // would return `/foo`, defeating the on-disk lookup.
  const withoutSlash = pathOnly.replace(/^\//, '').replace(/\/$/, '');
  const candidates = [
    `${withoutSlash}.md`,
    `${withoutSlash}.mdx`,
    `${withoutSlash}/index.md`,
    `${withoutSlash}/index.mdx`,
  ];
  for (const candidate of candidates) {
    const abs = join(docsRoot, candidate);
    if (existsSync(abs)) return { external: false, exists: abs };
  }
  return { external: false, exists: null, raw: pathOnly };
}

const files = walkMd(docsRoot);
const broken = [];
let total = 0;
let external = 0;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const links = extractLinks(src);
  for (const url of links) {
    total++;
    const result = resolveLink(url);
    if (result.external) {
      external++;
      continue;
    }
    if (!result.exists) {
      broken.push({ file: file.slice(repoRoot.length + 1), url, target: result.raw });
    }
  }
}

if (broken.length > 0) {
  console.error(`[link-check] ${broken.length} broken internal link(s):`);
  for (const item of broken) {
    console.error(`  ${item.file}: ${item.url} → no candidate for "${item.target}"`);
  }
  console.error(
    `\n[link-check] FAIL — ${broken.length} broken link(s) across ${files.length} content file(s). ` +
      `${external} external link(s) skipped.`,
  );
  process.exit(1);
}

console.log(
  `[link-check] ok — ${total} link(s) verified across ${files.length} content file(s). ` +
    `${external} external link(s) skipped.`,
);
