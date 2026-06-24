import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type GroveConfig, loadConfig } from "./config.js";

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

export interface SitemapInput {
  siteUrl?: string;
  generatedAt: string;
  items: Array<{
    slug: string;
    visibility?: string;
    lastCommitAt?: string | null;
    addedAt?: string | null;
  }>;
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

export function buildSitemapXml(entries: SitemapEntry[]): string {
  const body = entries.map(entryToXml).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

const BLUEPRINT_INDEX: Record<string, string> = {
  "project-directory": "projects",
  "resource-hub": "resources",
  "ecosystem-map": "entities",
};

function directorySlug(config: GroveConfig): string {
  return config.routes.directory ?? BLUEPRINT_INDEX[config.blueprint] ?? "items";
}

/**
 * Build a sitemap from generated records data + Grove config.
 * Writes to public/sitemap.xml.
 */
export async function buildSitemap(
  input: SitemapInput,
  cwd = process.cwd(),
  config?: GroveConfig,
): Promise<SitemapResult> {
  const cfg = config ?? (await loadConfig(cwd));
  const siteUrl = (input.siteUrl ?? cfg.site.url ?? "https://example.com").replace(/\/$/, "");
  const indexSlug = input.indexSlug ?? directorySlug(cfg);
  const entries: SitemapEntry[] = [];

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
  const publicDir = resolve(cwd, cfg.paths.publicDir);
  await mkdir(publicDir, { recursive: true });
  const path = join(publicDir, "sitemap.xml");
  await writeFile(path, xml, "utf8");
  return { path, urlCount: entries.length };
}
