/**
 * sitemap.xml.ts — Astro endpoint that serves the site map.
 *
 * The CLI's `grove sitemap` command also writes a sitemap into
 * `public/sitemap.xml`. This endpoint is the consumer-facing
 * version: it builds the sitemap from the live record set at
 * request time, so a manual `astro build` (without running the
 * CLI first) still gets a correct map.
 *
 * In practice the CLI's output is preferred for SEO (it's
 * deterministic and includes the build timestamp); the consumer
 * is expected to wire `public/sitemap.xml` and this endpoint to
 * the same source. We keep the endpoint thin so it can serve as
 * either a fallback or a live override.
 */
import type { APIRoute } from "astro";
import { fullRecords, indexSlug } from "../data/records";
import siteConfig from "../../data/generated/site-config.json";

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
}

function absoluteUrl(siteUrl: string, path: string): string {
  const base = siteUrl.replace(/\/$/, "");
  const tail = path.startsWith("/") ? path : `/${path}`;
  return `${base}${tail}`;
}

function buildEntries(siteUrl: string, blueprint: string | undefined): SitemapEntry[] {
  const slug = indexSlug(blueprint);
  const now = new Date().toISOString().slice(0, 10);

  const top: SitemapEntry[] = [
    { loc: absoluteUrl(siteUrl, "/"), lastmod: now, changefreq: "daily", priority: 1.0 },
    { loc: absoluteUrl(siteUrl, "/about"), lastmod: now, changefreq: "monthly", priority: 0.5 },
    { loc: absoluteUrl(siteUrl, "/submit"), lastmod: now, changefreq: "yearly", priority: 0.3 },
  ];

  if (fullRecords.length > 0) {
    top.push({
      loc: absoluteUrl(siteUrl, `/${slug}`),
      lastmod: now,
      changefreq: "daily",
      priority: 0.9,
    });
  }

  const recordEntries: SitemapEntry[] = fullRecords
    .filter((r) => r.kind === "project")
    .map((r) => ({
      loc: absoluteUrl(siteUrl, `/${slug}/${r.slug}`),
      // detail pages don't carry a `pushedAt` in the typed union;
      // we use the build date so crawlers see a recent timestamp.
      lastmod: now,
      changefreq: "weekly",
      priority: 0.7,
    }));

  return [...top, ...recordEntries];
}

function renderXml(entries: SitemapEntry[]): string {
  const body = entries
    .map((e) => {
      const lines: string[] = [`  <url>`, `    <loc>${e.loc}</loc>`];
      if (e.lastmod) lines.push(`    <lastmod>${e.lastmod}</lastmod>`);
      if (e.changefreq) lines.push(`    <changefreq>${e.changefreq}</changefreq>`);
      if (e.priority !== undefined) lines.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
      lines.push(`  </url>`);
      return lines.join("\n");
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export const GET: APIRoute = () => {
  const xml = renderXml(buildEntries(siteConfig.siteUrl ?? "", siteConfig.blueprint));
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
