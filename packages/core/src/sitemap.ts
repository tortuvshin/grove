import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { type GroveConfig, loadConfig } from './config.js';
import { totalPages } from './directory-search.js';

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
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
  /** Collections to list under /collections/. Entries with `index: false`
   *  are noindex pages and are excluded. Passing the array (even empty)
   *  also emits the /collections/ index URL. */
  collections?: Array<{
    slug: string;
    index?: boolean;
    lastReviewedAt?: string;
  }>;
  /** Taxonomy route ids (matching the scaffold's getStaticPaths params).
   *  Emits /categories/, /stacks/ indexes plus each detail URL.
   *  Licenses have detail pages only (the scaffold has no licenses index). */
  taxonomies?: {
    categories?: string[];
    stacks?: string[];
    licenses?: string[];
  };
  /** Additional indexable static routes (site-relative, e.g. "about/").
   *  Defaults to the scaffold's about + contributors pages. Noindex
   *  routes (submit, 404, empty) must never be listed here. */
  staticPaths?: string[];
}

export interface SitemapResult {
  path: string;
  urlCount: number;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function entryToXml(entry: SitemapEntry): string {
  const lines: string[] = [`  <url>`, `    <loc>${escapeXml(entry.loc)}</loc>`];
  if (entry.lastmod) lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
  if (entry.changefreq) lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
  if (typeof entry.priority === 'number')
    lines.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
  lines.push(`  </url>`);
  return lines.join('\n');
}

export function buildSitemapXml(entries: SitemapEntry[]): string {
  const body = entries.map(entryToXml).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

const BLUEPRINT_INDEX: Record<string, string> = {
  'project-directory': 'projects',
  'resource-hub': 'resources',
  'ecosystem-map': 'entities',
};

function directorySlug(config: GroveConfig): string {
  return config.routes.directory ?? BLUEPRINT_INDEX[config.blueprint] ?? 'items';
}

/**
 * Build a sitemap from generated records data + Grove config.
 * Writes to public/sitemap.xml.
 *
 * Every loc ends with a trailing slash to match the canonical URLs the
 * pages emit (`build.format: 'directory'`) — a loc that disagrees with
 * the page's own canonical makes search engines pick one arbitrarily.
 */
export async function buildSitemap(
  input: SitemapInput,
  cwd = process.cwd(),
  config?: GroveConfig,
): Promise<SitemapResult> {
  const cfg = config ?? (await loadConfig(cwd));
  const siteUrl = (input.siteUrl ?? cfg.site.url ?? 'https://example.com').replace(/\/$/, '');
  const indexSlug = input.indexSlug ?? directorySlug(cfg);
  const entries: SitemapEntry[] = [];

  entries.push({
    loc: `${siteUrl}/`,
    lastmod: input.generatedAt,
    changefreq: 'daily',
    priority: 1.0,
  });
  entries.push({
    loc: `${siteUrl}/${indexSlug}/`,
    lastmod: input.generatedAt,
    changefreq: 'daily',
    priority: 0.9,
  });

  const listed = input.items.filter(
    (item) => item.visibility !== 'hide' && item.visibility !== 'remove',
  );

  // Browse pages 2..n. They are prerendered documents, and on a large
  // directory they are the path a crawler takes to every record that
  // is not on page 1 — leaving them out is the one thing that would
  // make paginating them pointless.
  for (let page = 2; page <= totalPages(listed.length); page += 1) {
    entries.push({
      loc: `${siteUrl}/${indexSlug}/page/${page}/`,
      lastmod: input.generatedAt,
      changefreq: 'daily',
      priority: 0.6,
    });
  }

  for (const item of listed) {
    const lastmod = item.lastCommitAt ?? item.addedAt ?? input.generatedAt;
    entries.push({
      loc: `${siteUrl}/${indexSlug}/${item.slug}/`,
      lastmod,
      changefreq: 'weekly',
      priority: 0.7,
    });
  }

  // Collections — the priority curated surface. Only indexable ones;
  // a collection with `seo.index: false` renders with noindex and must
  // not be advertised here.
  if (input.collections) {
    entries.push({
      loc: `${siteUrl}/collections/`,
      lastmod: input.generatedAt,
      changefreq: 'weekly',
      priority: 0.8,
    });
    for (const collection of input.collections) {
      if (collection.index === false) continue;
      entries.push({
        loc: `${siteUrl}/collections/${collection.slug}/`,
        lastmod: collection.lastReviewedAt ?? input.generatedAt,
        changefreq: 'weekly',
        priority: 0.8,
      });
    }
  }

  // Taxonomy landing pages. Categories and stacks have index pages in
  // the scaffold; licenses only have detail pages.
  const tax = input.taxonomies;
  if (tax) {
    for (const facet of ['categories', 'stacks'] as const) {
      const ids = tax[facet];
      if (!ids?.length) continue;
      entries.push({
        loc: `${siteUrl}/${facet}/`,
        lastmod: input.generatedAt,
        changefreq: 'weekly',
        priority: 0.6,
      });
      for (const id of ids) {
        entries.push({
          loc: `${siteUrl}/${facet}/${id}/`,
          lastmod: input.generatedAt,
          changefreq: 'weekly',
          priority: 0.6,
        });
      }
    }
    for (const id of tax.licenses ?? []) {
      entries.push({
        loc: `${siteUrl}/licenses/${id}/`,
        lastmod: input.generatedAt,
        changefreq: 'monthly',
        priority: 0.5,
      });
    }
  }

  for (const path of input.staticPaths ?? ['about/', 'contributors/']) {
    entries.push({
      loc: `${siteUrl}/${path.replace(/^\//, '')}`,
      lastmod: input.generatedAt,
      changefreq: 'monthly',
      priority: 0.4,
    });
  }

  const xml = buildSitemapXml(entries);
  const publicDir = resolve(cwd, cfg.paths.publicDir);
  await mkdir(publicDir, { recursive: true });
  const path = join(publicDir, 'sitemap.xml');
  await writeFile(path, xml, 'utf8');
  return { path, urlCount: entries.length };
}

export interface SitemapSection {
  pages: string[];
  records: string[];
  collections: string[];
  taxonomies: string[];
}

export function buildSitemapIndex(baseUrl: string, sections: SitemapSection): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const subs: Array<[string, string[]]> = [
    ['pages', sections.pages],
    ['records', sections.records],
    ['collections', sections.collections],
    ['taxonomies', sections.taxonomies],
  ];
  const lastmod = new Date().toISOString().slice(0, 10);
  const body = subs
    .filter(([, urls]) => urls.length > 0)
    .map(
      ([name]) =>
        `<sitemap><loc>${escapeXml(base)}sitemaps/${name}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>`;
}
