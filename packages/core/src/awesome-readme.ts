/**
 * Awesome-list README generator.
 *
 * Produces a deterministic markdown README in the canonical
 * sindresorhus/awesome format: an H1, the Awesome badge, a Contents
 * TOC, H2 category sections, and `- [Name](URL) - Description.` entries
 * sorted alphabetically within each section.
 *
 * Entries link to the project's homepage (falling back to its
 * repository) by default. `readme.entryLinkTarget: 'detail'` links
 * each entry to its page on the directory site instead and keeps the
 * repository as a secondary `([Source](…))` link, so the README sends
 * readers to the reviewed page rather than past it.
 *
 * The output is wrapped between `<!-- grove-readme:start -->` /
 * `<!-- grove-readme:end -->` sentinels so a project's hand-written
 * intro, contributing notes, and license section are preserved across
 * regenerations. When the sentinels are absent, a new block is appended.
 */

import { type Resource, recordVisibility } from './schema.js';

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

/**
 * Project a normalized record (see `loadNormalizedRecords`) onto the
 * README entry shape. Visibility is the record's effective visibility
 * (`recordVisibility`: decision, then health, then the record field),
 * so the README lists exactly the records the site shows.
 */
export function toAwesomeReadmeRecord(record: Resource): AwesomeReadmeRecord {
  const github = (record.kind === 'project' ? record.github : undefined) as
    | { stars?: unknown; license?: unknown; repository?: { stargazers_count?: unknown } }
    | undefined;
  const stars =
    typeof github?.stars === 'number'
      ? github.stars
      : typeof github?.repository?.stargazers_count === 'number'
        ? github.repository.stargazers_count
        : undefined;
  const license = typeof github?.license === 'string' ? github.license : undefined;
  const repoUrl = (record.kind === 'project' ? record.repoUrl : undefined) ?? record.links.github;
  return {
    slug: record.slug,
    name: record.kind === 'resource' ? record.title : record.name,
    ...(record.description ? { description: record.description } : {}),
    category: record.category,
    ...(repoUrl !== undefined ? { repoUrl } : {}),
    ...(record.links.website !== undefined ? { homepageUrl: record.links.website } : {}),
    visibility: recordVisibility(record),
    ...(stars !== undefined ? { stars } : {}),
    ...(license !== undefined ? { license } : {}),
  };
}

export interface AwesomeReadmeCategory {
  id: string;
  name: string;
}

/**
 * Where each entry's main link points.
 * - `homepage` (default): homepage, falling back to the repository.
 * - `repository`: repository, falling back to the homepage.
 * - `detail`: the record's page on the site (`site.url` + directory
 *   route + slug + `/`), with the repository as a secondary link.
 */
export type ReadmeEntryLinkTarget = 'detail' | 'homepage' | 'repository';

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
  entryLinkTarget?: ReadmeEntryLinkTarget | undefined;
}

export interface AwesomeReadmeInput {
  site: {
    name: string;
    tagline?: string | undefined;
    description?: string | undefined;
    url?: string | undefined;
    repoUrl?: string | undefined;
  };
  /**
   * Directory route segment for record pages (e.g. `apps` for
   * `/apps/<slug>/`). Required when `readme.entryLinkTarget` is
   * `detail`.
   */
  directoryRoute?: string | undefined;
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

/**
 * Canonical URL of a record's detail page: `site.url` without a
 * trailing slash, the directory route, the URI-encoded slug, and a
 * trailing slash to match the canonical URLs pages emit (see
 * `buildSitemap`).
 */
export function recordDetailUrl(siteUrl: string, directoryRoute: string, slug: string): string {
  const base = siteUrl.replace(/\/+$/, '');
  const route = directoryRoute.replace(/^\/+|\/+$/g, '');
  return `${base}/${route}/${encodeURIComponent(slug)}/`;
}

/**
 * Throws when `detail` links cannot be built. A README that silently
 * fell back to repository links would hide the misconfiguration.
 */
export function assertReadmeLinkConfig(input: {
  readme?: AwesomeReadmeOptions | undefined;
  site: { url?: string | undefined };
  directoryRoute?: string | undefined;
}): void {
  if (input.readme?.entryLinkTarget !== 'detail') return;
  const missing: string[] = [];
  if (!input.site.url) missing.push('site.url');
  if (!input.directoryRoute) missing.push('the directory route (routes.directory)');
  if (missing.length > 0) {
    throw new Error(
      `readme.entryLinkTarget is 'detail' but ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not set.`,
    );
  }
}

interface EntryLinks {
  main: string;
  source?: string | undefined;
}

function entryLinks(record: AwesomeReadmeRecord, input: AwesomeReadmeInput): EntryLinks {
  const target = input.readme?.entryLinkTarget ?? 'homepage';
  const { directoryRoute } = input;
  const siteUrl = input.site.url;
  // assertReadmeLinkConfig in buildAwesomeReadme guarantees both are set.
  if (target === 'detail' && siteUrl && directoryRoute) {
    return { main: recordDetailUrl(siteUrl, directoryRoute, record.slug), source: record.repoUrl };
  }
  if (target === 'repository') return { main: record.repoUrl ?? record.homepageUrl ?? '' };
  return { main: record.homepageUrl ?? record.repoUrl ?? '' };
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

function buildEntryLine(record: AwesomeReadmeRecord, input: AwesomeReadmeInput): string {
  const label = entryLabel(record);
  const { main, source } = entryLinks(record, input);
  const desc = normalizeDescription(record.description);
  const link = main ? `[${label}](${main})` : label;
  const sourceLink = source ? ` ([Source](${source}))` : '';
  return desc ? `- ${link} - ${desc}.${sourceLink}` : `- ${link}${sourceLink}`;
}

function isVisible(record: AwesomeReadmeRecord): boolean {
  return record.visibility !== 'hide' && record.visibility !== 'remove';
}

function hasLabel(record: AwesomeReadmeRecord): boolean {
  return Boolean(record.name?.trim() || record.slug?.trim());
}

export function buildAwesomeReadme(input: AwesomeReadmeInput): string {
  assertReadmeLinkConfig(input);
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
    for (const record of records) lines.push(buildEntryLine(record, input));
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
