/**
 * Crawl smoke test over a built Grove site (`dist/`).
 *
 * Lighthouse (`grove audit`) runs page by page, so it cannot see problems
 * that only exist *across* pages. `checkBuiltSite` reads every built HTML
 * file and reports:
 *
 *   - a missing or empty `<title>` / meta description on an indexable page
 *   - two indexable pages sharing a `<title>` or a meta description
 *   - a canonical that is missing, duplicated, or points somewhere other
 *     than the page's own URL on the site URL
 *   - a `noindex` page the sitemap lists, or an indexable page it leaves
 *     out — the two must agree
 *   - a `noindex` page inside the Pagefind index (`data-pagefind-body`),
 *     unless the index policy excluded it (those stay findable on-site)
 *   - a record, collection or taxonomy page whose robots meta disagrees
 *     with `seo.*IndexPolicy`; a policy-excluded page must say exactly
 *     `noindex,follow`
 *   - a page without the parameter-URL robots script
 *     (`data-grove-param-robots`)
 *   - record JSON-LD outside the SoftwareApplication allowlist, or a
 *     `downloadUrl` that is not a verified distribution channel
 *   - a retired brand name (`seo.retiredBrands`) in a title,
 *     `og:site_name` or visible page text
 *
 * Over-long titles and descriptions are warnings: search engines truncate
 * them, nothing breaks.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { loadCollections } from './collections-io.js';
import {
  collectionIndexable,
  hasEditorialBody,
  type ListingIndexPolicy,
  type RecordIndexPolicy,
  recordIndexable,
  taxonomyTermIndexable,
} from './index-policy.js';
import { SOFTWARE_APPLICATION_FIELDS } from './page-document.js';

export interface BuiltSiteCheckOptions {
  /** Project root. Default: `process.cwd()`. */
  root?: string;
  /** Built site. Default: `dist`. */
  distDir?: string;
  /** Where `site-config.json` and `records.full.json` live. Default: `data/generated`. */
  generatedDir?: string;
  /** Brand names that must not appear on the site any more. */
  retiredBrands?: string[];
  /** Title length that triggers a warning. Default: 65. */
  titleMax?: number;
  /** Description length that triggers a warning. Default: 160. */
  descriptionMax?: number;
}

export interface BuiltSiteCheckResult {
  errors: string[];
  warnings: string[];
  indexable: number;
  noindex: number;
  /** Pages the index policy excluded (noindex,follow, still on-site). */
  policyNoindex: number;
  /** Pages checked against the index policy, by type. */
  checked: Record<string, number>;
}

type Expected = 'index' | 'policy-noindex' | 'noindex';
interface Expectation {
  type: string;
  why: string;
  expected: Expected;
  verifiedDownloads?: Set<string>;
}

interface GeneratedSiteConfig {
  siteUrl?: string;
  seo?: {
    recordIndexPolicy?: RecordIndexPolicy;
    collectionIndexPolicy?: ListingIndexPolicy;
    taxonomyIndexPolicy?: ListingIndexPolicy;
  };
  blueprintConfig?: { routeSlug?: string };
  taxonomy?: Record<string, Array<{ id: string; count?: number; description?: string }>>;
}

interface GeneratedRecordLite {
  slug: string;
  content?: string;
  visibility?: string;
  health?: { visibility?: string };
  curation?: { reviewed?: boolean };
  distribution?: { channels?: Array<{ url?: string; verified?: boolean }> };
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function decode(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith('.html') ? [path] : [];
  });
}

function jsonLdNodes(head: string): Record<string, unknown>[] {
  return [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(
    (m) => {
      try {
        const parsed = JSON.parse(m[1] ?? '');
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    },
  );
}

const typesOf = (node: Record<string, unknown> | undefined): string[] =>
  [node?.['@type']].flat().filter((t): t is string => typeof t === 'string');

export async function checkBuiltSite(
  options: BuiltSiteCheckOptions = {},
): Promise<BuiltSiteCheckResult> {
  const root = options.root ?? process.cwd();
  const dist = resolve(root, options.distDir ?? 'dist');
  const generated = resolve(root, options.generatedDir ?? 'data/generated');
  const titleMax = options.titleMax ?? 65;
  const descriptionMax = options.descriptionMax ?? 160;
  const retired = (options.retiredBrands ?? [])
    .filter((b) => b.trim())
    .map((b) => ({ name: b, re: new RegExp(`\\b${escapeRegExp(b)}\\b`) }));

  const errors: string[] = [];
  const warnings: string[] = [];
  const result = (): BuiltSiteCheckResult => ({
    errors,
    warnings,
    indexable: indexable.length,
    noindex: noindexCount,
    policyNoindex,
    checked,
  });
  const indexable: string[] = [];
  let noindexCount = 0;
  let policyNoindex = 0;
  const checked: Record<string, number> = {};

  if (!existsSync(dist)) {
    errors.push(`${options.distDir ?? 'dist'}/ does not exist — build the site first`);
    return result();
  }
  const siteConfigPath = join(generated, 'site-config.json');
  if (!existsSync(siteConfigPath)) {
    errors.push(`${siteConfigPath} is missing — run \`grove check\` or the build first`);
    return result();
  }
  const site = JSON.parse(readFileSync(siteConfigPath, 'utf8')) as GeneratedSiteConfig;
  const siteUrl = site.siteUrl?.replace(/\/$/, '');
  if (!siteUrl) {
    errors.push('site.url is not set — canonicals and the sitemap cannot be checked');
    return result();
  }
  const routeSlug = site.blueprintConfig?.routeSlug ?? 'projects';

  // ── What each page type should say, from the data ───────────────
  const expectations = new Map<string, Expectation>();
  const recordsPath = join(generated, 'records.full.json');
  const records: GeneratedRecordLite[] = existsSync(recordsPath)
    ? ((JSON.parse(readFileSync(recordsPath, 'utf8')) as { records?: GeneratedRecordLite[] })
        .records ?? [])
    : [];
  const recordPolicy = site.seo?.recordIndexPolicy ?? 'all';
  for (const record of records) {
    const visibility = record.health?.visibility ?? record.visibility;
    const hidden = visibility === 'hide' || visibility === 'remove';
    const body = record.content
      ? hasEditorialBody(record.content, [resolve(root, record.content)])
      : false;
    const reviewed = record.curation?.reviewed === true;
    const index = recordIndexable(
      { hasBody: body, reviewed, ...(visibility ? { visibility } : {}) },
      recordPolicy,
    );
    expectations.set(`/${routeSlug}/${record.slug}/`, {
      type: 'record',
      why: hidden
        ? `hidden (${visibility})`
        : index
          ? 'meets policy'
          : `${recordPolicy}: ${body ? 'body' : 'no body'}, ${reviewed ? 'reviewed' : 'not reviewed'}`,
      expected: hidden ? 'noindex' : index ? 'index' : 'policy-noindex',
      verifiedDownloads: new Set(
        (record.distribution?.channels ?? [])
          .filter((c) => c.verified === true && c.url)
          .map((c) => String(c.url)),
      ),
    });
  }

  const collectionPolicy = site.seo?.collectionIndexPolicy ?? 'all';
  for (const collection of await loadCollections(root)) {
    const hasBody = collection.content
      ? hasEditorialBody(collection.content, [resolve(root, collection.content)])
      : false;
    // Entry count is read from the page's ItemList below; assume one here.
    const index = collectionIndexable(
      {
        introduction: collection.editorial?.introduction,
        hasBody,
        seoIndex: collection.seo?.index,
        entryCount: 1,
      },
      collectionPolicy,
    );
    expectations.set(`/collections/${collection.slug}/`, {
      type: 'collection',
      why:
        collection.seo?.index === false
          ? 'seo.index: false'
          : index
            ? 'meets policy'
            : `${collectionPolicy}: no introduction`,
      expected: collection.seo?.index === false ? 'noindex' : index ? 'index' : 'policy-noindex',
    });
  }

  const taxonomyPolicy = site.seo?.taxonomyIndexPolicy ?? 'all';
  for (const kind of ['categories', 'stacks', 'licenses']) {
    for (const term of site.taxonomy?.[kind] ?? []) {
      const count = term.count ?? 0;
      // A term no record uses gets no page at all.
      if (count === 0) continue;
      const index = taxonomyTermIndexable({ count, description: term.description }, taxonomyPolicy);
      expectations.set(`/${kind}/${term.id}/`, {
        type: kind,
        why: index ? 'meets policy' : `${taxonomyPolicy}: no description`,
        expected: index ? 'index' : 'policy-noindex',
      });
    }
  }

  // ── The sitemap: the data's second opinion ──────────────────────
  const sitemapFiles = readdirSync(dist).filter((name) => /^sitemap.*\.xml$/.test(name));
  const listed = new Set(
    sitemapFiles.flatMap((name) =>
      [...readFileSync(join(dist, name), 'utf8').matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) =>
        decode(m[1] ?? '').replace(/\/$/, ''),
      ),
    ),
  );
  const inSitemap = (path: string) => listed.has(`${siteUrl}${path}`.replace(/\/$/, ''));

  const titles = new Map<string, string[]>();
  const descriptions = new Map<string, string[]>();
  const built = new Set<string>();

  for (const file of walk(dist)) {
    const html = readFileSync(file, 'utf8');
    const head = html.slice(0, html.indexOf('</head>') + 1 || html.length);
    const rel = relative(dist, file).split(sep).join('/');
    const path =
      rel === 'index.html'
        ? '/'
        : `/${rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel}`;

    // Redirect stubs carry a meta refresh and nothing to index.
    if (/http-equiv="refresh"/i.test(head)) continue;
    built.add(path);

    const title = decode(head.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '');
    const description = decode(
      head.match(/<meta name="description" content="([^"]*)"/i)?.[1] ?? '',
    );
    const canonicals = [...head.matchAll(/<link rel="canonical" href="([^"]*)"/gi)].map(
      (m) => m[1] ?? '',
    );
    const robots = head.match(/<meta name="robots" content="([^"]*)"/i)?.[1] ?? '';
    const siteName = decode(
      head.match(/<meta property="og:site_name" content="([^"]*)"/i)?.[1] ?? '',
    );
    const noindex = /noindex/i.test(robots);
    const expectation = expectations.get(path);

    // Every page rendered through the Seo layout has a canonical.
    if (canonicals.length > 0 && !/data-grove-param-robots/.test(html)) {
      errors.push(`${path}: no parameter-URL robots script (data-grove-param-robots)`);
    }

    if (expectation) {
      checked[expectation.type] = (checked[expectation.type] ?? 0) + 1;
      const itemCount = jsonLdNodes(head).find((n) =>
        typesOf(n).includes('ItemList'),
      )?.numberOfItems;
      const empty = expectation.type === 'collection' && itemCount === 0;
      if (expectation.expected === 'index' && noindex && !empty) {
        errors.push(`${path}: noindex (${robots}), but the policy indexes it (${expectation.why})`);
      } else if (expectation.expected !== 'index' && !noindex) {
        errors.push(`${path}: indexable, but expected noindex (${expectation.why})`);
      } else if (expectation.expected === 'policy-noindex' && robots !== 'noindex,follow') {
        errors.push(
          `${path}: excluded by policy (${expectation.why}), robots must be "noindex,follow", got "${robots}"`,
        );
      }
    }

    if (expectation?.type === 'record' && expectation.expected === 'index') {
      const app = jsonLdNodes(head).find((n) =>
        typesOf(n).some((t) => t === 'SoftwareApplication' || t === 'SoftwareSourceCode'),
      );
      if (!app) {
        errors.push(`${path}: no SoftwareApplication JSON-LD`);
      } else {
        const allowed = new Set<string>(SOFTWARE_APPLICATION_FIELDS);
        const extra = Object.keys(app).filter((key) => !allowed.has(key));
        if (extra.length) errors.push(`${path}: unverified JSON-LD field(s): ${extra.join(', ')}`);
        for (const url of [app.downloadUrl ?? []].flat()) {
          if (!expectation.verifiedDownloads?.has(String(url))) {
            errors.push(`${path}: JSON-LD downloadUrl ${String(url)} is not a verified channel`);
          }
        }
      }
    }

    if (noindex) {
      noindexCount += 1;
      if (inSitemap(path)) errors.push(`${path}: noindex, but listed in the sitemap`);
      if (expectation?.expected === 'policy-noindex') policyNoindex += 1;
      else if (/data-pagefind-body/.test(html)) {
        errors.push(`${path}: noindex, but in the search index`);
      }
      continue;
    }

    if (!title) errors.push(`${path}: missing <title>`);
    if (!description) errors.push(`${path}: missing meta description`);
    if (retired.length) {
      const visibleText = html
        .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
        .replace(/<[^>]+>/g, ' ');
      for (const { name, re } of retired) {
        if (re.test(title)) errors.push(`${path}: retired brand "${name}" in <title>`);
        else if (re.test(siteName)) errors.push(`${path}: retired brand "${name}" in og:site_name`);
        else if (re.test(visibleText)) errors.push(`${path}: retired brand "${name}" in page text`);
      }
    }

    if (canonicals.length !== 1) {
      errors.push(`${path}: expected 1 canonical, found ${canonicals.length}`);
    } else if (canonicals[0]?.replace(/\/$/, '') !== `${siteUrl}${path}`.replace(/\/$/, '')) {
      errors.push(`${path}: canonical points to ${canonicals[0]}`);
    }

    if (title.length > titleMax) warnings.push(`${path}: title is ${title.length} chars`);
    if (description.length > descriptionMax + 1) {
      warnings.push(`${path}: description is ${description.length} chars`);
    }

    indexable.push(path);
    if (title) titles.set(title, [...(titles.get(title) ?? []), path]);
    if (description)
      descriptions.set(description, [...(descriptions.get(description) ?? []), path]);
  }

  for (const [title, paths] of titles) {
    if (paths.length > 1) errors.push(`duplicate <title> "${title}": ${paths.join(', ')}`);
  }
  for (const [description, paths] of descriptions) {
    if (paths.length > 1) {
      errors.push(`duplicate description "${description.slice(0, 60)}…": ${paths.join(', ')}`);
    }
  }

  if (sitemapFiles.length === 0) errors.push('no sitemap*.xml in the built site');
  for (const path of indexable) {
    if (!inSitemap(path)) errors.push(`${path}: indexable but not in the sitemap`);
  }
  for (const [path, expectation] of expectations) {
    if (expectation.expected === 'index' && !built.has(path)) {
      errors.push(`${path}: indexable by policy, but not built`);
    }
  }

  return result();
}
