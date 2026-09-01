import type { Heading, Link, List, ListItem, Root } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { visit } from 'unist-util-visit';
import { detectGithubRepo, extractDescription } from './markdown.js';

export interface CandidateLink {
  url: string;
  label?: string;
  kind: 'repository' | 'website' | 'unknown';
}

export interface CandidateSource {
  file?: string;
  line?: number;
  raw: string;
  sourceUrl?: string;
}

export interface CandidateEntry {
  name?: string;
  description?: string;
  links: CandidateLink[];
  sectionPath: string[];
  source: CandidateSource;
  confidence: number;
  warnings: string[];
}

export interface ExtractCandidatesOptions {
  file?: string;
  sourceUrl?: string;
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function classifyLink(url: string): CandidateLink['kind'] {
  if (detectGithubRepo(url)) return 'repository';
  if (isHttpUrl(url)) return 'website';
  return 'unknown';
}

// mdast strips Markdown syntax from inline children; reassembling the
// item's raw text this way (rather than re-parsing) is enough to feed
// the existing `extractDescription` regex cleanup, which expects
// Markdown-shaped input (link syntax, malformed brackets) to strip.
function inlineSource(node: ListItem, raw: string): string {
  const start = node.children[0]?.position?.start.offset;
  const end = node.children[node.children.length - 1]?.position?.end.offset;
  if (start === undefined || end === undefined) return '';
  return raw.slice(start, end);
}

function collectLinks(node: ListItem): Array<{ label: string; url: string }> {
  const links: Array<{ label: string; url: string }> = [];
  visit(node, 'link', (link: Link) => {
    const label = link.children
      .map((child) => ('value' in child ? String(child.value) : ''))
      .join('')
      .trim();
    links.push({ label, url: link.url });
  });
  return links;
}

/**
 * Extract every list item in `markdown` as a `CandidateEntry` — a
 * non-lossy, source-preserving representation. Unlike
 * `parseAwesomeMarkdown`, nothing is dropped: an item with no links
 * still becomes a candidate, flagged with a low confidence and a
 * warning, so downstream consumers (health checks, PR review) can see
 * what was actually in the document rather than a filtered subset.
 */
export function extractCandidates(
  markdown: string,
  options: ExtractCandidatesOptions = {},
): CandidateEntry[] {
  const tree = fromMarkdown(markdown) as Root;
  const candidates: CandidateEntry[] = [];
  const headingStack: Array<{ depth: number; text: string }> = [];

  function sectionPathAt(depth: number): string[] {
    while (headingStack.length && (headingStack[headingStack.length - 1]?.depth ?? -1) >= depth) {
      headingStack.pop();
    }
    return headingStack.map((h) => h.text);
  }

  function walkListItems(list: List) {
    for (const item of list.children) {
      if (item.type !== 'listItem') continue;
      const sectionPath = [...headingStack.map((h) => h.text)];
      const links: CandidateLink[] = collectLinks(item)
        .filter((link) => link.url)
        .map((link) => ({
          url: link.url,
          ...(link.label ? { label: link.label } : {}),
          kind: classifyLink(link.url),
        }));

      const start = item.position?.start.offset;
      const end = item.position?.end.offset;
      const raw = start !== undefined && end !== undefined ? markdown.slice(start, end) : '';

      const primary = links[0];
      const name = primary?.label;
      const body = inlineSource(item, markdown);
      const description = primary ? extractDescription(body) : undefined;

      const warnings: string[] = [];
      let confidence: number;
      if (links.length === 0) {
        warnings.push('no-links');
        confidence = 0;
      } else if (!name) {
        warnings.push('no-name');
        confidence = 0.4;
      } else {
        confidence = 1;
      }

      candidates.push({
        ...(name ? { name } : {}),
        ...(description ? { description } : {}),
        links,
        sectionPath,
        source: {
          ...(options.file ? { file: options.file } : {}),
          ...(item.position?.start.line !== undefined ? { line: item.position.start.line } : {}),
          raw,
          ...(options.sourceUrl ? { sourceUrl: options.sourceUrl } : {}),
        },
        confidence,
        warnings,
      });

      // Nested lists inside this item share the same section path —
      // Phase 1 doesn't model nesting depth separately, it flattens.
      for (const child of item.children) {
        if (child.type === 'list') walkListItems(child);
      }
    }
  }

  visit(tree, (node) => {
    if (node.type === 'heading') {
      const heading = node as Heading;
      const text = heading.children
        .map((child) => ('value' in child ? String(child.value) : ''))
        .join('')
        .trim();
      sectionPathAt(heading.depth);
      if (text) headingStack.push({ depth: heading.depth, text });
      return 'skip';
    }
    if (node.type === 'list') {
      walkListItems(node as List);
      return 'skip';
    }
    return undefined;
  });

  return candidates;
}
