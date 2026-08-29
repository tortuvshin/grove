/**
 * Awesome-list README generator.
 *
 * Produces a deterministic markdown README in the canonical
 * sindresorhus/awesome format: an H1, the Awesome badge, a Contents
 * TOC, H2 category sections, and `- [Name](URL) - Description.` entries
 * sorted alphabetically within each section.
 *
 * The output is wrapped between `<!-- grove-readme:start -->` /
 * `<!-- grove-readme:end -->` sentinels so a project's hand-written
 * intro, contributing notes, and license section are preserved across
 * regenerations. When the sentinels are absent, a new block is appended.
 */

export interface AwesomeReadmeRecord {
  slug: string;
  name?: string | undefined;
  description?: string | undefined;
  category?: string | undefined;
  repoUrl?: string | undefined;
  homepageUrl?: string | undefined;
  stars?: number | undefined;
  license?: string | undefined;
  visibility?: string | undefined;
}

export interface AwesomeReadmeCategory {
  id: string;
  name: string;
}

export interface AwesomeReadmeOptions {
  title?: string | undefined;
  tagline?: string | undefined;
  description?: string | undefined;
  url?: string | undefined;
  browseLabel?: string | undefined;
  intro?: string | undefined;
  showBadge?: boolean | undefined;
  showToc?: boolean | undefined;
  showBrowseLink?: boolean | undefined;
}

export interface AwesomeReadmeInput {
  site: {
    name: string;
    tagline?: string | undefined;
    description?: string | undefined;
    url?: string | undefined;
    repoUrl?: string | undefined;
  };
  records: AwesomeReadmeRecord[];
  categories: AwesomeReadmeCategory[];
  generatedAt: string;
  readme?: AwesomeReadmeOptions | undefined;
}

export const AWESOME_README_START = '<!-- grove-readme:start -->';
export const AWESOME_README_END = '<!-- grove-readme:end -->';

const SENTINEL_PATTERN = /<!--\s*grove-readme:start\s*-->[\s\S]*?<!--\s*grove-readme:end\s*-->/;

function normalizeDescription(value: string | undefined): string {
  if (!value) return '';
  const collapsed = value.replace(/\s+/g, ' ').trim();
  const stripped = collapsed.replace(/[.!?…]+\s*$/u, '');
  return stripped;
}

function entryUrl(record: AwesomeReadmeRecord): string {
  return record.homepageUrl ?? record.repoUrl ?? '';
}

function entryLabel(record: AwesomeReadmeRecord): string {
  return record.name?.trim() || record.slug.trim();
}

function sortByName(a: AwesomeReadmeRecord, b: AwesomeReadmeRecord): number {
  return entryLabel(a).localeCompare(entryLabel(b), undefined, {
    sensitivity: 'base',
  });
}

function categoryDisplayName(id: string, categories: AwesomeReadmeCategory[]): string {
  const match = categories.find((c) => c.id === id);
  if (match) return match.name;
  return id
    .split('-')
    .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : ''))
    .join(' ');
}

function categoryAnchor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function buildEntryLine(record: AwesomeReadmeRecord): string {
  const label = entryLabel(record);
  const url = entryUrl(record);
  const desc = normalizeDescription(record.description);
  const link = url ? `[${label}](${url})` : label;
  return desc ? `- ${link} - ${desc}.` : `- ${link}`;
}

function isVisible(record: AwesomeReadmeRecord): boolean {
  return record.visibility !== 'hide' && record.visibility !== 'remove';
}

function hasLabel(record: AwesomeReadmeRecord): boolean {
  return Boolean(record.name?.trim() || record.slug?.trim());
}

export function buildAwesomeReadme(input: AwesomeReadmeInput): string {
  const visible = input.records.filter((r) => isVisible(r) && hasLabel(r));
  const opts = input.readme ?? {};
  const showBadge = opts.showBadge !== false;
  const showToc = opts.showToc !== false;
  const showBrowseLink = opts.showBrowseLink !== false;

  const declaredIds = input.categories.map((c) => c.id);
  const usedIds = new Set<string>();
  for (const record of visible) {
    if (record.category) usedIds.add(record.category);
  }

  const orderedIds: string[] = [];
  for (const id of declaredIds) {
    if (usedIds.has(id)) {
      orderedIds.push(id);
      usedIds.delete(id);
    }
  }
  for (const id of usedIds) orderedIds.push(id);

  const grouped = new Map<string, AwesomeReadmeRecord[]>();
  for (const record of visible) {
    const id = record.category ?? 'other';
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id)!.push(record);
  }
  for (const list of grouped.values()) list.sort(sortByName);

  const title = opts.title ?? input.site.name;
  const tagline = opts.tagline ?? opts.description ?? input.site.tagline ?? input.site.description;
  const browseUrl = opts.url ?? input.site.url;
  const browseLabel = opts.browseLabel ?? 'Browse the full directory →';

  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push('');
  if (showBadge) {
    lines.push('[![Awesome](https://awesome.re/badge.svg)](https://awesome.re)');
    lines.push('');
  }
  if (tagline) {
    lines.push(tagline);
    lines.push('');
  }
  if (showBrowseLink && browseUrl) {
    lines.push(`${browseLabel} ${browseUrl}`);
    lines.push('');
  }

  if (opts.intro) {
    const introLines = opts.intro.replace(/\n+$/, '').split('\n');
    lines.push(...introLines);
    lines.push('');
  }

  if (showToc) {
    lines.push('## Contents');
    lines.push('');
    for (const id of orderedIds) {
      const name = categoryDisplayName(id, input.categories);
      lines.push(`- [${name}](#${categoryAnchor(name)})`);
    }
    lines.push('');
  }

  for (const id of orderedIds) {
    const name = categoryDisplayName(id, input.categories);
    const records = grouped.get(id) ?? [];
    if (records.length === 0) continue;
    lines.push(`## ${name}`);
    lines.push('');
    for (const record of records) lines.push(buildEntryLine(record));
    lines.push('');
  }

  return lines.join('\n').replace(/\n+$/, '\n');
}

export interface AwesomeReadmeSections {
  before: string;
  entries: string;
  after: string;
}

export function parseAwesomeReadmeSections(readme: string): AwesomeReadmeSections {
  const match = readme.match(SENTINEL_PATTERN);
  if (!match || match.index === undefined) {
    return { before: readme, entries: '', after: '' };
  }
  const start = match.index;
  const end = match.index + match[0].length;
  const before = readme.slice(0, start);
  const inner = match[0];
  const entriesStart = inner.indexOf(AWESOME_README_START) + AWESOME_README_START.length;
  const entriesEnd = inner.lastIndexOf(AWESOME_README_END);
  const entries = inner.slice(entriesStart, entriesEnd);
  const after = readme.slice(end);
  return { before, entries, after };
}

export function injectAwesomeReadmeBlock(readme: string, block: string): string {
  const trimmed = block.replace(/\n+$/, '\n');
  const wrapped = `${AWESOME_README_START}\n${trimmed}${AWESOME_README_END}`;
  if (SENTINEL_PATTERN.test(readme)) {
    return readme.replace(SENTINEL_PATTERN, wrapped);
  }
  const trailing = readme.endsWith('\n') ? readme : `${readme}\n`;
  return `${trailing}\n${wrapped}\n`;
}
