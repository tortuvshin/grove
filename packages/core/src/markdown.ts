import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { type Blueprint, blueprintKind, type ProjectRecord } from './schema.js';
import { uniqueSlug } from './slug.js';

export interface ImportedRecord {
  slug: string;
  name: string;
  description: string;
  category: string;
  links: { github?: string; website?: string; source?: string };
}

export interface ImportSummary {
  imported: number;
  skipped: number;
  categories: string[];
  duplicateSlugs: number;
  tocSkipped: number;
  anchorLinksSkipped: number;
}

export interface ImportResult {
  records: ImportedRecord[];
  report: ImportSummary;
}

const markdownLinkPattern = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

const TOC_TITLES = new Set([
  'contents',
  'table of contents',
  'contributing',
  'contribution',
  'license',
  'contributors',
]);

const EMOJIS = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

function stripAnchor(name: string): string {
  return name
    .replace(/<a\s+name="[^"]+"><\/a>/gi, '')
    .replace(/🔗/g, '')
    .replace(EMOJIS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const REPO_RESERVED = new Set(['issues', 'pulls', 'stargazers', 'network']);

export function detectGithubRepo(url: string): string | undefined {
  const match = url.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/#?\s]+)(?:[/?#].*)?$/i);
  if (!match) return undefined;
  const owner = match[1];
  const repoName = match[2];
  if (!owner || !repoName) return undefined;
  const repo = repoName.replace(/\.git$/, '');
  if (!repo || REPO_RESERVED.has(repo)) return undefined;
  return `https://github.com/${owner}/${repo}`;
}

function isAnchorLink(url: string): boolean {
  return url.startsWith('#') || url.startsWith('./#') || url.startsWith('../#');
}

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//.test(url) || /^[a-z][a-z0-9+.-]*:/i.test(url);
}

// Malformed-link cleanup. Some upstream awesome-lists produce
// fragments like `[Naser Elziadna](` (no closing paren, no URL)
// or `[@handle]` (no parens at all). The primary
// `markdownLinkPattern` only strips well-formed links, so these
// fragments survive into the description and render as raw
// Markdown. This pass deletes them.
const MALFORMED_OPEN_LINK = /\[[^\]\n]+\]\s*(?=$|\n)/g;
const MALFORMED_BARE_BRACKET = /\[[^\]\n]{1,80}\]/g;

function extractDescription(body: string): string {
  return body
    .replace(markdownLinkPattern, '')
    .replace(MALFORMED_OPEN_LINK, '')
    .replace(MALFORMED_BARE_BRACKET, '')
    .trim()
    .replace(/^[-:—–]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function headingDepth(line: string): number | undefined {
  const match = line.match(/^(#{2,6})\s+(.+?)\s*$/);
  return match?.[1]?.length;
}

function headingText(line: string): string | undefined {
  return stripAnchor(line.match(/^#{2,6}\s+(.+?)\s*$/)?.[1]?.trim() ?? '');
}

function slugify(label: string, seen: Map<string, number>): string {
  // Delegate to the public `uniqueSlug` so the package ships a single
  // collision-counter behavior (foo, foo-2, foo-3). The previous
  // hand-rolled version (foo, foo-1, foo-2) had an off-by-one against
  // `slug.ts:uniqueSlug` and was the source of subtle duplicate-slug
  // reports from awesome-list importers.
  return uniqueSlug(label, seen);
}

function githubReadmeUrl(input: string): string | undefined {
  const match = input.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/#?\s]+)\/?$/i);
  if (!match) return undefined;
  return `https://raw.githubusercontent.com/${match[1]}/${match[2]}/HEAD/README.md`;
}

export function parseAwesomeMarkdown(
  text: string,
  options: { file?: string; sourceUrl?: string } = {},
): ImportResult {
  const lines = text.split(/\r?\n/);
  const seen = new Map<string, number>();
  const categories = new Set<string>();
  const records: ImportedRecord[] = [];
  let currentCategory = 'uncategorized';
  let skipped = 0;
  let duplicateSlugs = 0;
  let tocSkipped = 0;
  let anchorLinksSkipped = 0;
  let inTocBlock = false;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? '';
    const depth = headingDepth(line);
    if (depth) {
      const title = headingText(line) ?? '';
      inTocBlock = TOC_TITLES.has(title.toLowerCase());
      if (title && !inTocBlock) {
        currentCategory = title;
        categories.add(currentCategory);
      }
      continue;
    }

    if (inTocBlock) {
      if (!line.trim()) continue;
      if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
        tocSkipped++;
        continue;
      }
      inTocBlock = false;
    }

    if (!/^\s*[-*+]\s+/.test(line)) continue;

    const body = line.replace(/^\s*[-*+]\s+/, '').trim();
    const parsedLinks = [...body.matchAll(markdownLinkPattern)].map((match) => ({
      label: (match[1] ?? '').trim(),
      url: (match[2] ?? '').trim(),
    }));
    if (parsedLinks.length === 0) {
      skipped++;
      continue;
    }
    const primary = parsedLinks[0];
    if (!primary) {
      skipped++;
      continue;
    }
    if (isAnchorLink(primary.url)) {
      anchorLinksSkipped++;
      continue;
    }
    const hasExternal = parsedLinks.some(
      (link) => isExternalUrl(link.url) && !isAnchorLink(link.url),
    );
    if (!hasExternal) {
      skipped++;
      continue;
    }
    const primaryExternal = parsedLinks.find(
      (link) => isExternalUrl(link.url) && !isAnchorLink(link.url),
    );
    if (!primaryExternal) {
      skipped++;
      continue;
    }
    const github = parsedLinks
      .map((link) => detectGithubRepo(link.url))
      .find((u): u is string => Boolean(u));
    const id = slugify(primaryExternal.label, seen);
    const lowerSlug =
      primaryExternal.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'item';
    if (id !== lowerSlug) duplicateSlugs++;
    const description = extractDescription(body);
    const links: ImportedRecord['links'] = {
      ...(github ? { github } : {}),
      ...(!github ? { website: primaryExternal.url } : {}),
      ...(options.sourceUrl ? { source: options.sourceUrl } : {}),
    };
    records.push({
      slug: id,
      name: primaryExternal.label,
      description: description || primaryExternal.label,
      category: currentCategory,
      links,
    });
  }

  return {
    records,
    report: {
      imported: records.length,
      skipped,
      categories: [...categories].filter((c) => c && c !== 'uncategorized'),
      duplicateSlugs,
      tocSkipped,
      anchorLinksSkipped,
    },
  };
}

export async function importAwesomeList(input: string): Promise<ImportResult> {
  const remote = githubReadmeUrl(input) ?? (/^https?:\/\//.test(input) ? input : undefined);
  let text: string;
  let file: string | undefined;
  let sourceUrl: string | undefined;
  if (remote) {
    const response = await fetch(remote);
    if (!response.ok) {
      throw new Error(`Could not fetch ${remote}: ${response.status} ${response.statusText}`);
    }
    text = await response.text();
    file = 'sources/README.md';
    sourceUrl = input;
  } else {
    const path = resolve(input);
    const { readFile } = await import('node:fs/promises');
    text = await readFile(path, 'utf8');
    file = basename(path);
  }
  return parseAwesomeMarkdown(text, sourceUrl !== undefined ? { file, sourceUrl } : { file });
}

/**
 * Write imported records out as `data/records/<slug>.yml`, one per
 * record. Each file is shaped for the `project-directory` blueprint
 * (kind: project). Other blueprints should use a separate importer.
 */
export async function writeImportedRecords(
  result: ImportResult,
  cwd = process.cwd(),
  blueprint: Blueprint = 'project-directory',
): Promise<{ written: number; dir: string }> {
  const expectedKind = blueprintKind[blueprint];
  const dir = resolve(cwd, 'data', 'records');
  await mkdir(dir, { recursive: true });
  let written = 0;
  for (const record of result.records) {
    let yamlObj: Record<string, unknown>;
    if (expectedKind === 'project') {
      const project: Partial<ProjectRecord> = {
        kind: 'project',
        slug: record.slug,
        name: record.name,
        description: record.description,
        category: record.category,
        tags: [],
        links: record.links,
        source: { type: 'import' },
      };
      yamlObj = project as Record<string, unknown>;
    } else {
      yamlObj = { ...record, kind: expectedKind };
    }
    const path = join(dir, `${record.slug}.yml`);
    await writeFile(path, stringifyYaml(yamlObj, { lineWidth: 100 }), 'utf8');
    written++;
  }
  return { written, dir };
}
