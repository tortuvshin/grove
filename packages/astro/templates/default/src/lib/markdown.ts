/**
 * Tiny markdown → HTML converter for page-level content bodies.
 *
 * Scope is intentionally narrow: it handles the markdown the
 * `content/pages/*.md` files actually use (headings, paragraphs,
 * unordered + ordered lists, fenced code, inline `code` and
 * links). Anything more elaborate (tables, footnotes, autolinks)
 * is out of scope — consumers can swap in a real renderer
 * (marked, remark, ...) by overriding the page-level helper.
 *
 * The output is HTML-escaped at the source so a stray `<` in the
 * markdown file can't break the page. Inline `code` and links are
 * processed before the escape pass.
 */
import { existsSync, readFileSync } from "node:fs";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderInline(line: string): string {
  let out = escapeHtml(line);
  // Inline code: `…` — render first so its content doesn't get
  // further processed.
  out = out.replace(/`([^`]+)`/g, (_, code: string) => `<code>${code}</code>`);
  // Links: [text](url)
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, text: string, url: string) =>
      `<a href="${url}" class="text-ink-900 underline hover:text-ink-700 dark:text-ink-100 dark:hover:text-white" rel="noopener noreferrer">${text}</a>`,
  );
  // Bold: **…**
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Italic: *…*
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return out;
}

interface Block {
  type: "h2" | "h3" | "p" | "ul" | "ol" | "pre";
  lines: string[];
}

function parseBlocks(md: string): Block[] {
  const lines = md.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", lines: [line.slice(3)] });
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", lines: [line.slice(4)] });
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push({ type: "pre", lines: buf });
      continue;
    }
    if (/^[-*] /.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        buf.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: "ul", lines: buf });
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        buf.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      blocks.push({ type: "ol", lines: buf });
      continue;
    }
    // Default: paragraph (consume contiguous non-blank lines).
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith("## ") &&
      !lines[i].startsWith("### ") &&
      !lines[i].startsWith("```") &&
      !/^[-*] /.test(lines[i]) &&
      !/^\d+\. /.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ type: "p", lines: buf });
  }
  return blocks;
}

export function renderMarkdown(md: string): string {
  const blocks = parseBlocks(md);
  const html: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "h2":
        html.push(
          `<h2 class="m-0 mt-10 text-[1.375rem] font-semibold tracking-tight text-ink-900 dark:text-ink-100">${renderInline(b.lines[0])}</h2>`,
        );
        break;
      case "h3":
        html.push(
          `<h3 class="m-0 mt-8 text-[1.125rem] font-semibold tracking-tight text-ink-900 dark:text-ink-100">${renderInline(b.lines[0])}</h3>`,
        );
        break;
      case "p":
        html.push(
          `<p class="m-0 mt-4 text-[0.9375rem] leading-relaxed text-ink-700 dark:text-ink-200">${b.lines.map(renderInline).join(" ")}</p>`,
        );
        break;
      case "ul":
        html.push(
          `<ul class="m-0 mt-4 list-disc space-y-1.5 pl-6 text-[0.9375rem] leading-relaxed text-ink-700 dark:text-ink-200">${b.lines
            .map((l) => `<li>${renderInline(l)}</li>`)
            .join("")}</ul>`,
        );
        break;
      case "ol":
        html.push(
          `<ol class="m-0 mt-4 list-decimal space-y-1.5 pl-6 text-[0.9375rem] leading-relaxed text-ink-700 dark:text-ink-200">${b.lines
            .map((l) => `<li>${renderInline(l)}</li>`)
            .join("")}</ol>`,
        );
        break;
      case "pre":
        html.push(
          `<pre class="mt-4 overflow-x-auto rounded-md border border-ink-200 bg-ink-50 p-4 text-xs leading-relaxed text-ink-800 dark:border-ink-800 dark:bg-ink-900/60 dark:text-ink-200"><code>${escapeHtml(b.lines.join("\n"))}</code></pre>`,
        );
        break;
    }
  }
  return html.join("\n");
}

/** Read a markdown file from a list of candidate paths, return null if missing. */
export function readMarkdownFile(candidates: string[]): string | null {
  for (const path of candidates) {
    try {
      if (!existsSync(path)) continue;
      return readFileSync(path, "utf8");
    } catch {
      continue;
    }
  }
  return null;
}
