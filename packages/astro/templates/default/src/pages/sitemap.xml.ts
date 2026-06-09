// SPDX-License-Identifier: MIT
//
// `/sitemap.xml` — single-file sitemap, served as `application/xml`.
//
// Replaces `@astrojs/sitemap` so the public URL is exactly `/sitemap.xml`.
// This is a V1 static fallback; the `grove sitemap` CLI command writes a
// richer sitemap to `public/sitemap.xml` ahead of `astro build` if you'd
// rather use that one.
//
// Excludes `/submit` (noindex form wrapper) and any other pages that
// opt out by setting `noindex`.

import type { APIRoute } from "astro";
import generatedJson from "../../data/generated/records.json";
import { indexSlug } from "../data/site-config";

type GeneratedRecord = {
  slug: string;
  visibility?: string;
  lastCommitAt?: string;
};

const records = (generatedJson as { records?: GeneratedRecord[] }).records ?? [];
const slug = indexSlug();

function isoDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return null;
  return d.toISOString().slice(0, 10);
}

function urlEntry(
  loc: string,
  lastmod?: string,
  priority = "0.7",
  changefreq = "weekly",
): string {
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
  const base = (site?.toString() ?? "https://example.com").replace(/\/$/, "");
  const today = new Date().toISOString().slice(0, 10);

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  lines.push(urlEntry(`${base}/`, today, "1.0", "weekly"));
  lines.push(urlEntry(`${base}/${slug}`, today, "0.9", "daily"));
  lines.push(urlEntry(`${base}/about`, today, "0.8", "monthly"));
  for (const record of records) {
    if (record.visibility === "hide" || record.visibility === "remove") continue;
    const lastmod = record.lastCommitAt ?? today;
    lines.push(urlEntry(`${base}/${slug}/${record.slug}`, lastmod));
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
