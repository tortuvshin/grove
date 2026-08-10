/**
 * Content body helpers — pure, dependency-free logic for reading and
 * shaping the Markdown sidecar that sits next to each record.
 *
 * Five concerns live here, all framework-agnostic so any renderer
 * (Astro today, future options) can compose them:
 *
 *   1. `resolveContentPath(contentPath, candidates?)`
 *      Locate a `ProjectRecord.content` path on disk. The candidates
 *      list mirrors the conventions a CLI-scaffolded project uses
 *      (`./content/...`, bare `content/...`, the legacy `apps/example`
 *      form for older workspaces). Returns the first existing absolute
 *      path, or null.
 *
 *   2. `readContentFile(contentPath, candidates?)`
 *      Combine resolve + read + frontmatter strip. Returns
 *      `{ body, frontmatter }` where `body` is the Markdown without its
 *      leading `---...---` block and `frontmatter` is the YAML text
 *      between the fences (or empty string when there's no frontmatter).
 *
 *   3. `stripFrontmatter(text)` — single source of truth for the
 *      leading-YAML-block rule. Used by `readContentFile`; also
 *      exported for consumers who already have the file contents in
 *      memory.
 *
 *   4. `extractToc(body, { maxDepth })` — pull h2/h3 headings out of a
 *      body so a record page can render a Table-of-Contents. IDs go
 *      through `slug.uniqueSlug` so they match the IDs the markdown
 *      renderer will emit (and so two TOC entries with the same
 *      label get `foo`, `foo-2`, `foo-3` rather than colliding).
 *
 *   5. `readingMetrics(body, { wpm })` — word count + minutes for the
 *      "X min read" pill on a detail page. Returns zeros (not throws)
 *      for empty input.
 *
 * Why a separate module instead of tacking these onto `markdown.ts`?
 * That file is the **awesome-list importer** (parses READMEs into
 * Grove records). Conflating record-side rendering helpers with
 * importer-side parsing helpers would re-create the
 * "what does this file do?" confusion that already exists between
 * `parseReadme.ts` and `markdown.ts`.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { uniqueSlug } from "./slug.js";

// ── Path resolution ──────────────────────────────────────────────────

/**
 * Default candidate roots tried in order when resolving a content
 * path. Order matters: the first existing path wins.
 *
 *   - `path`                  — relative to the caller's cwd (the
 *                              conventional `./content/...` form the
 *                              CLI scaffold writes).
 *   - `path` (relative cwd)   — bare `content/...` form.
 *   - `process.cwd()/apps/example/<path>` — legacy workspace layout
 *                              where the example lives inside the
 *                              monorepo. Kept for back-compat so an
 *                              old scaffold doesn't break when the
 *                              package gets bumped.
 */
function defaultCandidates(contentPath: string): string[] {
  return [
    resolve(contentPath),
    resolve(process.cwd(), contentPath),
    resolve(process.cwd(), "apps", "example", contentPath),
  ];
}

/**
 * Resolve a record's `content` path against a list of candidate
 * roots. Returns the absolute path of the first existing candidate,
 * or null when none match.
 */
export function resolveContentPath(
  contentPath: string,
  candidates?: string[],
): string | null {
  const list = candidates ?? defaultCandidates(contentPath);
  for (const c of list) {
    if (existsSync(c)) return c;
  }
  return null;
}

// ── Frontmatter strip ────────────────────────────────────────────────

/**
 * Strip a leading YAML frontmatter block (`---\n...\n---`) from a
 * Markdown string. Returns the body with the frontmatter removed;
 * callers that need the frontmatter contents should use
 * `readContentFile` instead.
 *
 * Restricts the search to the first 200 lines so a `---` later in
 * the document (e.g. as a horizontal rule) isn't mistaken for the
 * closing fence.
 */
export function stripFrontmatter(text: string): string {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return text;
  const close = lines.slice(1, 200).findIndex((l) => l.trim() === "---");
  if (close < 0) return text;
  return lines.slice(close + 2).join("\n");
}

// ── File read ────────────────────────────────────────────────────────

export interface ReadContentFileResult {
  /** Markdown body with frontmatter stripped. */
  body: string;
  /** Raw YAML text between the frontmatter fences (no fences, no trim). */
  frontmatter: string;
  /** Absolute path the file was resolved from. */
  path: string;
}

/**
 * Read a record's content file from disk and split it into
 * frontmatter + body. Returns null when the file can't be located.
 */
export function readContentFile(
  contentPath: string,
  candidates?: string[],
): ReadContentFileResult | null {
  const found = resolveContentPath(contentPath, candidates);
  if (!found) return null;
  let raw: string;
  try {
    raw = readFileSync(found, "utf8");
  } catch {
    return null;
  }
  const lines = raw.split(/\r?\n/);
  let frontmatter = "";
  let body = raw;
  if (lines[0]?.trim() === "---") {
    const close = lines.slice(1, 200).findIndex((l) => l.trim() === "---");
    if (close >= 0) {
      frontmatter = lines.slice(1, close + 1).join("\n");
      body = lines.slice(close + 2).join("\n");
    }
  }
  return { body, frontmatter, path: found };
}

// ── Heading slug (GitHub-flavoured, ASCII-only) ──────────────────────

/**
 * Slug used for heading anchors. Unlike `slug.ts:slugify`, this is
 * GitHub-flavoured:
 *   - drops diacritics / smart quotes the same way `slug.ts` does
 *     (so README-style copy-paste gives predictable IDs)
 *   - replaces spaces with hyphens (rather than dropping everything
 *     that isn't `[a-z0-9]`)
 *   - collapses repeated hyphens
 *   - trims leading/trailing hyphens
 *   - no length cap (headings are short by nature)
 *
 * The collision counter (via `uniqueSlug`) gives `foo`, `foo-2`, …
 * so two headings labelled "Examples" in the same document anchor
 * to distinct IDs.
 */
function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Table of Contents ────────────────────────────────────────────────

export interface TocEntry {
  /** Display text of the heading (Markdown syntax stripped). */
  text: string;
  /** Stable anchor id (kebab-case, collision-suffixed). */
  id: string;
  /** Heading depth — 2 or 3 by default. */
  depth: 2 | 3 | 4 | 5 | 6;
}

export interface ExtractTocOptions {
  /** Highest heading depth to include (default 2 → only `##` entries). */
  maxDepth?: 2 | 3 | 4 | 5 | 6;
}

/**
 * Pull a flat list of `{ text, id, depth }` out of a Markdown body,
 * skipping any leading frontmatter block. ID collisions are resolved
 * via `uniqueSlug` so the returned IDs match what a markdown→HTML
 * renderer (configured with the same slug rules) will emit.
 */
export function extractToc(
  body: string,
  options: ExtractTocOptions = {},
): TocEntry[] {
  const maxDepth = options.maxDepth ?? 2;
  const lines = body.split(/\r?\n/);
  const seen = new Map<string, number>();
  const out: TocEntry[] = [];
  for (const line of lines) {
    const m = line.match(/^(#{2,6})\s+(.+?)\s*$/);
    if (!m || !m[1] || !m[2]) continue;
    const depth = m[1].length as 2 | 3 | 4 | 5 | 6;
    if (depth > maxDepth) continue;
    const text = m[2].replace(/[`*_~\[\]()]/g, "").trim();
    if (!text) continue;
    const id = uniqueSlug(headingSlug(text) || "section", seen);
    out.push({ text, id, depth });
  }
  return out;
}

// ── Reading time ─────────────────────────────────────────────────────

export interface ReadingMetrics {
  /** Whitespace-separated token count of the body. */
  wordCount: number;
  /** Reading time in minutes, rounded up, never less than 1. */
  minutes: number;
}

export interface ReadingMetricsOptions {
  /** Words-per-minute baseline (default 200). */
  wpm?: number;
}

/**
 * Word count + minutes for "X min read". Whitespace-only and empty
 * bodies return `{ wordCount: 0, minutes: 1 }` — the `minutes: 1`
 * floor prevents detail pages from rendering "0 min" for short
 * placeholder bodies.
 */
export function readingMetrics(
  body: string,
  options: ReadingMetricsOptions = {},
): ReadingMetrics {
  const wpm = options.wpm ?? 200;
  const trimmed = body.trim();
  if (!trimmed) return { wordCount: 0, minutes: 1 };
  const wordCount = trimmed.split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(wordCount / wpm));
  return { wordCount, minutes };
}