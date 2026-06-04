import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type CuratedConfig, loadConfig } from "./config.js";

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

export interface SitemapInput {
  /** Site base URL. Falls back to config.siteUrl. */
  siteUrl?: string;
  /** ISO timestamp used as <lastmod> for the directory index. */
  generatedAt: string;
  /**
   * Build a list of items (apps, projects) to include.
   * Typically `data/generated/apps.full.json` after `grove build-data`.
   */
  items: Array<{
    slug: string;
    name?: string;
    visibility?: string;
    lastCommitAt?: string | null;
    addedAt?: string | null;
  }>;
  /** Slug of the index page (e.g. "apps" or "projects"). */
  indexSlug?: string;
}

export interface SitemapResult {
  path: string;
  urlCount: number;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function entryToXml(entry: SitemapEntry): string {
  const lines: string[] = [`  <url>`, `    <loc>${escapeXml(entry.loc)}</loc>`];
  if (entry.lastmod) lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
  if (entry.changefreq) lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
  if (typeof entry.priority === "number")
    lines.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
  lines.push(`  </url>`);
  return lines.join("\n");
}

/** Build a sitemap.xml string from a list of entries. */
export function buildSitemapXml(entries: SitemapEntry[]): string {
  const body = entries.map(entryToXml).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

/**
 * Build a sitemap from generated apps data + curated config.
 * Writes to public/sitemap.xml by default.
 */
export async function buildSitemap(
  input: SitemapInput,
  cwd = process.cwd(),
  config?: CuratedConfig,
): Promise<SitemapResult> {
  const cfg = config ?? (await loadConfig(cwd));
  const siteUrl = (input.siteUrl ?? cfg.siteUrl ?? "https://example.com").replace(/\/$/, "");
  const indexSlug = input.indexSlug ?? "apps";
  const entries: SitemapEntry[] = [];

  // Home + directory index
  entries.push({
    loc: `${siteUrl}/`,
    lastmod: input.generatedAt,
    changefreq: "daily",
    priority: 1.0,
  });
  entries.push({
    loc: `${siteUrl}/${indexSlug}`,
    lastmod: input.generatedAt,
    changefreq: "daily",
    priority: 0.9,
  });

  // Per-item pages — only visible items
  for (const item of input.items) {
    if (item.visibility === "hide" || item.visibility === "remove") continue;
    const lastmod = item.lastCommitAt ?? item.addedAt ?? input.generatedAt;
    entries.push({
      loc: `${siteUrl}/${indexSlug}/${item.slug}`,
      lastmod,
      changefreq: "weekly",
      priority: 0.7,
    });
  }

  const xml = buildSitemapXml(entries);
  const publicDir = resolve(cwd, "public");
  await mkdir(publicDir, { recursive: true });
  const path = join(publicDir, "sitemap.xml");
  await writeFile(path, xml, "utf8");
  return { path, urlCount: entries.length };
}
