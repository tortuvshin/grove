import type { CuratedItem } from "./schema.js";
import { uniqueSlug } from "./slug.js";

export interface ImportResult {
  items: CuratedItem[];
  report: {
    imported: number;
    skipped: number;
    categories: string[];
    duplicateSlugs: number;
  };
}

const markdownLinkPattern = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export function detectGithubRepo(url: string): string | undefined {
  const match = url.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/#?\s]+)(?:[/?#].*)?$/i);
  if (!match) return undefined;
  const repo = match[2].replace(/\.git$/, "");
  if (!repo || ["issues", "pulls", "stargazers", "network"].includes(repo)) return undefined;
  return `https://github.com/${match[1]}/${repo}`;
}

function extractDescription(body: string): string {
  return body
    .replace(markdownLinkPattern, "")
    .replace(/^[-:—–]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headingDepth(line: string): number | undefined {
  const match = line.match(/^(#{2,6})\s+(.+?)\s*$/);
  return match?.[1]?.length;
}

function headingText(line: string): string | undefined {
  return line.match(/^#{2,6}\s+(.+?)\s*$/)?.[1]?.trim();
}

export function parseAwesomeMarkdown(text: string, options: { file?: string; sourceUrl?: string } = {}): ImportResult {
  const lines = text.split(/\r?\n/);
  const seen = new Map<string, number>();
  const categories = new Set<string>();
  const items: CuratedItem[] = [];
  let currentCategory = "uncategorized";
  let categoryDepth = 2;
  let skipped = 0;
  let duplicateSlugs = 0;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const depth = headingDepth(line);
    if (depth) {
      const title = headingText(line);
      if (title && !/^(contents|table of contents|license|contributing)$/i.test(title)) {
        currentCategory = title;
        categoryDepth = depth;
        categories.add(currentCategory);
      }
      continue;
    }

    if (headingDepth(line) && (headingDepth(line) ?? 0) <= categoryDepth) {
      currentCategory = headingText(line) ?? currentCategory;
    }

    if (!/^\s*[-*+]\s+/.test(line)) continue;

    const body = line.replace(/^\s*[-*+]\s+/, "").trim();
    const links = [...body.matchAll(markdownLinkPattern)].map((match) => ({
      label: match[1].trim(),
      url: match[2].trim(),
    }));
    if (links.length === 0) {
      skipped++;
      continue;
    }

    const primary = links[0];
    if (!primary) {
      skipped++;
      continue;
    }

    const github = links.map((link) => detectGithubRepo(link.url)).find(Boolean);
    const id = uniqueSlug(primary.label, seen);
    if (id !== (primary.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "item")) {
      duplicateSlugs++;
    }

    const description = extractDescription(body);
    items.push({
      id,
      name: primary.label,
      description: description || primary.label,
      links: {
        ...(github ? { github } : {}),
        ...(!github ? { website: primary.url } : {}),
        source: options.sourceUrl,
      },
      source: {
        type: "markdown",
        file: options.file,
        line: index + 1,
        url: options.sourceUrl,
      },
      taxonomy: {
        category: currentCategory,
        tags: [],
      },
    });
  }

  return {
    items,
    report: {
      imported: items.length,
      skipped,
      categories: [...categories],
      duplicateSlugs,
    },
  };
}
