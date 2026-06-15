/**
 * Parse a legacy awesome-list README into structured entries.
 *
 * Legacy format: `- [Name](repoUrl) - description` (or em-dash),
 * grouped under `### Category` headings. Used by `grove import`
 * when the source is a flat awesome list rather than a schema-v1
 * per-app directory.
 */

export interface ParsedEntry {
  name: string;
  repoUrl: string;
  description: string;
  author: string | null;
}

const markdownLinkRe = /\[([^\]]+)\]\(([^)]+)\)/g;

function extractLinks(text: string): Array<{ label: string; href: string }> {
  const out: Array<{ label: string; href: string }> = [];
  let m: RegExpExecArray | null;
  markdownLinkRe.lastIndex = 0;
  while ((m = markdownLinkRe.exec(text)) !== null) {
    const label = m[1];
    const href = m[2];
    if (label === undefined || href === undefined) continue;
    out.push({ label, href });
  }
  return out;
}

/**
 * Parse one `- [Name](repoUrl) - desc` line.
 * Returns null on miss (no link, non-github URL, etc).
 */
export function parseEntry(line: string): ParsedEntry | null {
  const body = line.replace(/^\s*-\s+/, "").trim();
  if (!body) return null;

  const links = extractLinks(body);
  if (links.length === 0) return null;

  const app = links[0];
  if (!app) return null;
  if (!/^https?:\/\/(github|gitlab)\.com\//i.test(app.href)) return null;

  let afterApp = body
    .replace(/^\s*\[[^\]]+\]\([^)]+\)\s*/, "")
    .replace(/^[-—–]\s*/, "")
    .trim();

  while (/\s*\([^)]*\)\s*$/.test(afterApp)) {
    let depth = 0;
    let i = afterApp.length;
    for (; i > 0; i--) {
      const c = afterApp[i - 1];
      if (c === ")") depth++;
      else if (c === "(") {
        depth--;
        if (depth === 0) break;
      }
    }
    if (i <= 0) break;
    afterApp = afterApp.slice(0, i).trim();
  }

  let description = afterApp;
  let author: string | null = null;

  const byLinkIdx = afterApp.lastIndexOf(" by [");
  if (byLinkIdx >= 0) {
    description = afterApp.slice(0, byLinkIdx).trim();
    const close = afterApp.indexOf("]", byLinkIdx);
    if (close > 0) {
      author = afterApp.slice(byLinkIdx + 5, close).trim();
    }
  } else {
    const byPlain = afterApp.match(/^(.*?)\s+by\s+([A-Z][\w .'-]+?)\s*$/);
    if (byPlain && byPlain[1] && byPlain[2]) {
      description = byPlain[1].trim();
      author = byPlain[2].trim();
    }
  }

  description = description.replace(/[.\s]+$/, "").trim();
  if (!description) description = app.label;

  return {
    name: app.label,
    repoUrl: app.href,
    description,
    author,
  };
}

export interface ParsedSection {
  category: string;
  lines: string[];
}

export function parseSections(text: string): ParsedSection[] {
  const lines = text.split(/\r?\n/);
  const out: ParsedSection[] = [];
  let current: ParsedSection | null = null;
  for (const line of lines) {
    const m = line.match(/^###\s+(.+?)\s*$/);
    if (m && m[1]) {
      current = { category: m[1].trim(), lines: [] };
      out.push(current);
      continue;
    }
    if (current && /^\s*-\s/.test(line)) {
      current.lines.push(line);
    }
  }
  return out;
}
