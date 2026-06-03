import type { CuratedItem } from "./schema.js";
import { uniqueSlug } from "./slug.js";

export interface ImportResult {
  items: CuratedItem[];
  report: {
    imported: number;
    skipped: number;
    categories: string[];
    duplicateSlugs: number;
    tocSkipped: number;
    anchorLinksSkipped: number;
  };
}

const markdownLinkPattern = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

const TOC_TITLES = new Set([
  "contents",
  "table of contents",
  "contributing",
  "contribution",
  "license",
  "contributors",
]);

function stripAnchor(name: string): string {
  return name
    .replace(/<a\s+name="[^"]+"><\/a>/gi, "")
    .replace(/🔗/g, "")
    .replace(/🚀|🎨|📐|👨‍💻|🤖|🖥️|💬|🗣️|🔑|👤|🗄️|📊|💻|🔒|🧮|📟|🎓|🛒|🌳|📂|💰|🎮|🏠|🧠|⚖️|🗺️|🎯|📋|🏠|🔬|🔎|🌐|🔮|🏃|🎧|🌎|🎙️|🚆|🔄|🏢|🛠️/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectGithubRepo(url: string): string | undefined {
  const match = url.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/#?\s]+)(?:[/?#].*)?$/i);
  if (!match) return undefined;
  const repo = match[2].replace(/\.git$/, "");
  if (!repo || ["issues", "pulls", "stargazers", "network"].includes(repo)) return undefined;
  return `https://github.com/${match[1]}/${repo}`;
}

function isAnchorLink(url: string): boolean {
  return url.startsWith("#") || url.startsWith("./#") || url.startsWith("../#");
}

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//.test(url) || /^[a-z][a-z0-9+.-]*:/i.test(url);
}

function extractDescription(body: string): string {
  return body
    .replace(markdownLinkPattern, "")
    .trim()
    .replace(/^[-:—–]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headingDepth(line: string): number | undefined {
  const match = line.match(/^(#{2,6})\s+(.+?)\s*$/);
  return match?.[1]?.length;
}

function headingText(line: string): string | undefined {
  return stripAnchor(line.match(/^#{2,6}\s+(.+?)\s*$/)?.[1]?.trim() ?? "");
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
  let tocSkipped = 0;
  let anchorLinksSkipped = 0;
  let inTocBlock = false;
  let consecutiveBlankLines = 0;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const depth = headingDepth(line);
    if (depth) {
      const title = headingText(line) ?? "";
      inTocBlock = TOC_TITLES.has(title.toLowerCase());
      if (title && !inTocBlock) {
        currentCategory = title;
        categoryDepth = depth;
        categories.add(currentCategory);
      }
      consecutiveBlankLines = 0;
      continue;
    }

    if (inTocBlock) {
      // TOC blocks: skip list items entirely. Exit when we see a non-list, non-blank line.
      if (!line.trim()) {
        consecutiveBlankLines++;
        continue;
      }
      if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
        tocSkipped++;
        consecutiveBlankLines = 0;
        continue;
      }
      // First non-list, non-blank line ends the TOC block.
      inTocBlock = false;
    }

    if (!/^\s*[-*+]\s+/.test(line)) {
      consecutiveBlankLines = line.trim() ? 0 : consecutiveBlankLines + 1;
      continue;
    }
    consecutiveBlankLines = 0;

    const body = line.replace(/^\s*[-*+]\s+/, "").trim();
    const parsedLinks = [...body.matchAll(markdownLinkPattern)].map((match) => ({
      label: match[1].trim(),
      url: match[2].trim(),
    }));
    if (parsedLinks.length === 0) {
      skipped++;
      continue;
    }

    // Filter out items whose primary link is an in-page anchor (TOC-style leftover).
    const primary = parsedLinks[0];
    if (!primary) {
      skipped++;
      continue;
    }
    if (isAnchorLink(primary.url)) {
      anchorLinksSkipped++;
      continue;
    }

    // Only keep items that have at least one external URL (HTTP/HTTPS or protocol-relative).
    // Project directories need a real link, not just text + bare words.
    const hasExternal = parsedLinks.some((link) => isExternalUrl(link.url) && !isAnchorLink(link.url));
    if (!hasExternal) {
      skipped++;
      continue;
    }

    // Prefer the first external link as the primary, ignoring any leading anchor links.
    const primaryExternal = parsedLinks.find((link) => isExternalUrl(link.url) && !isAnchorLink(link.url));
    if (!primaryExternal) {
      skipped++;
      continue;
    }

    const github = parsedLinks.map((link) => detectGithubRepo(link.url)).find(Boolean);
    const id = uniqueSlug(primaryExternal.label, seen);
    if (
      id !==
      (primaryExternal.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "item")
    ) {
      duplicateSlugs++;
    }

    const description = extractDescription(body);
    const links: CuratedItem["links"] = {
      ...(github ? { github } : {}),
      ...(!github ? { website: primaryExternal.url } : {}),
      ...(options.sourceUrl ? { source: options.sourceUrl } : {}),
    };

    items.push({
      id,
      name: primaryExternal.label,
      description: description || primaryExternal.label,
      links,
      source: {
        type: "markdown",
        file: options.file,
        line: index + 1,
        url: options.sourceUrl,
      },
      taxonomy: {
        category: currentCategory,
        tags: [],
        stacks: [],
        platforms: [],
      },
      labels: [],
      lenses: [],
      distribution: {
        channels: [],
      },
      curation: {
        bestFor: [],
        whyListed: [],
        caveats: [],
        launchAsk: [],
        scores: {},
      },
    });
  }

  return {
    items,
    report: {
      imported: items.length,
      skipped,
      categories: [...categories].filter((c) => c && c !== "uncategorized"),
      duplicateSlugs,
      tocSkipped,
      anchorLinksSkipped,
    },
  };
}
