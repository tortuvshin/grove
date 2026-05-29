// SPDX-License-Identifier: MIT
//
// `/sitemap.xml` — single-file sitemap, served as `application/xml`.
//
// Replaces `@astrojs/sitemap` so the public URL is exactly
// `/sitemap.xml` (the integration's default output is
// `/sitemap-index.xml`, which doesn't match what `robots.txt` and
// most crawler configs expect). For 79 apps + 4 static pages this
// is well under any per-sitemap limit, so a single file is fine.
//
// Excludes `/submit` (noindex form wrapper) and any other pages
// that opt out by setting `noindex` in their SEO props.

import type { APIRoute } from "astro";
import generatedJson from "../../data/generated/apps.json";

type GeneratedApp = {
  slug: string;
  name: string;
  lastCommitAt?: string;
  activity?: { lastCommitAt?: string };
};

const apps = (generatedJson as { apps?: GeneratedApp[] }).apps ?? [];

const STATIC_PAGES: { path: string; priority: string; changefreq: string }[] = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/about", priority: "0.8", changefreq: "monthly" },
  { path: "/apps", priority: "0.9", changefreq: "daily" },
];

function isoDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function urlEntry(loc: string, lastmod?: string, priority = "0.7", changefreq = "weekly"): string {
  const lm = isoDate(lastmod);
  return [
    "  <url>",
    `    <loc>${loc}</loc>`,
    lm ? `    <lastmod>${lm}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

export const GET: APIRoute = ({ site }) => {
  const base = (site?.toString() ?? "https://open-apps.dev.mn").replace(/\/$/, "");
  const today = new Date().toISOString().slice(0, 10);

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  for (const p of STATIC_PAGES) {
    lines.push(urlEntry(`${base}${p.path}`, today, p.priority, p.changefreq));
  }
  for (const app of apps) {
    const lastmod = app.lastCommitAt ?? app.activity?.lastCommitAt ?? today;
    lines.push(urlEntry(`${base}/apps/${app.slug}`, lastmod));
  }
  lines.push("</urlset>");
  lines.push("");

  const body = lines.join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
