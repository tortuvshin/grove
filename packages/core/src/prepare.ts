import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { type GenerateResult, generate } from './build-data.js';
import { toCollectionEntries } from './collection-entries.js';
import { loadCollections } from './collections-io.js';
import { runCollection } from './collector.js';
import { type GroveConfig, loadConfig } from './config.js';
import { readContentFile, shiftHeadings, stripLeadingH1 } from './content-body.js';
import {
  collectionIndexable,
  hasEditorialBody,
  recordIndexable,
  taxonomyTermIndexable,
} from './index-policy.js';
import { buildLlmsFiles, type LlmsRecordInput, type LlmsResult } from './llms.js';
import { buildOgImages, type OgBuildResult } from './og-image.js';
import { buildSiteArtifacts, type SiteArtifactsResult } from './site-artifacts.js';
import { buildSitemap, type SitemapInput, type SitemapResult } from './sitemap.js';

export interface PrepareDirectoryResult {
  generated: GenerateResult;
  sitemap: SitemapResult;
  llms: LlmsResult;
  siteArtifacts: SiteArtifactsResult;
  ogImages: OgBuildResult;
}

type GeneratedRecord = {
  slug: string;
  name?: string;
  title?: string;
  description?: string;
  summary?: string;
  category?: string;
  stack?: string;
  visibility?: string;
  repoUrl?: string;
  homepageUrl?: string;
  addedAt?: string | null;
  lastCommitAt?: string | null;
  /** Path to the record's Markdown sidecar, relative to the project root. */
  content?: string;
  links?: { github?: string; website?: string };
  github?: {
    stars?: number;
    license?: string;
    pushedAt?: string | null;
    repository?: {
      stargazers_count?: number;
      pushed_at?: string | null;
      license?: { spdx_id?: string | null } | null;
    };
  };
  health?: { visibility?: string };
  curation?: { reviewed?: boolean };
};

function contentCandidates(root: string, content: string): string[] {
  return [resolve(root, content), join(root, content.replace(/^\.\//, ''))];
}

function toSitemapItem(
  root: string,
  record: GeneratedRecord,
  policy: GroveConfig['seo']['recordIndexPolicy'],
): SitemapInput['items'][number] {
  const visibility = record.health?.visibility ?? record.visibility;
  const lastCommitAt =
    record.lastCommitAt ?? record.github?.pushedAt ?? record.github?.repository?.pushed_at;
  // Same rule the detail page model applies (`getRecordDetailModel`).
  const index =
    policy === 'all' ||
    recordIndexable(
      {
        hasBody: record.content
          ? hasEditorialBody(record.content, contentCandidates(root, record.content))
          : false,
        reviewed: record.curation?.reviewed === true,
      },
      policy,
    );
  return {
    slug: record.slug,
    ...(index ? {} : { index: false }),
    ...(visibility !== undefined ? { visibility } : {}),
    ...(lastCommitAt !== undefined ? { lastCommitAt } : {}),
    ...(record.addedAt !== undefined ? { addedAt: record.addedAt } : {}),
  };
}

/**
 * Read a record's Markdown sidecar for the `#### Detail` block in
 * llms-full.txt. `LlmsRecordInput.detail` has always been supported by
 * `buildDetailSection`, but nothing populated it, so the block was
 * unreachable in a real build and llms-full.txt carried metadata only.
 */
function readDetailBody(root: string, record: GeneratedRecord): string | undefined {
  if (!record.content) return undefined;
  const found = readContentFile(record.content, contentCandidates(root, record.content));
  if (!found) return undefined;
  // The body lands under `### <name>` → `#### Detail`, so its own title
  // is redundant and its `##` sections must sit below level 4.
  const body = shiftHeadings(stripLeadingH1(found.body), 3).trim();
  return body ? body : undefined;
}

function toLlmsRecord(root: string, record: GeneratedRecord): LlmsRecordInput {
  const stars = record.github?.stars ?? record.github?.repository?.stargazers_count;
  const visibility = record.health?.visibility ?? record.visibility;
  const repoUrl = record.repoUrl ?? record.links?.github;
  const homepageUrl = record.homepageUrl ?? record.links?.website;
  const license =
    record.github?.license ?? record.github?.repository?.license?.spdx_id ?? undefined;
  const lastCommitAt =
    record.lastCommitAt ?? record.github?.pushedAt ?? record.github?.repository?.pushed_at;
  return {
    slug: record.slug,
    name: record.name ?? record.title ?? record.slug,
    ...(record.description !== undefined ? { description: record.description } : {}),
    ...(record.category !== undefined ? { category: record.category } : {}),
    ...(record.stack !== undefined ? { stack: record.stack } : {}),
    ...(stars !== undefined ? { stars } : {}),
    ...(visibility !== undefined ? { visibility } : {}),
    ...(repoUrl !== undefined ? { repoUrl } : {}),
    ...(homepageUrl !== undefined ? { homepageUrl } : {}),
    ...(license !== undefined ? { license } : {}),
    ...(lastCommitAt !== undefined ? { lastCommitAt } : {}),
    ...(record.addedAt !== undefined ? { addedAt: record.addedAt } : {}),
    ...((): { detail?: string } => {
      const detail = readDetailBody(root, record);
      return detail ? { detail } : {};
    })(),
  };
}

/**
 * Prepare every generated artifact consumed by the Astro site.
 *
 * This is the single application-facing pipeline used by the Astro
 * integration and by CLI validation. A Grove-powered Astro project can
 * therefore run `astro dev`, `astro check`, and `astro build` directly;
 * it does not need consumer-owned prebuild scripts.
 */
export async function prepareDirectory(cwd = process.cwd()): Promise<PrepareDirectoryResult> {
  const root = resolve(cwd);
  const config = await loadConfig(root);
  const generated = await generate(root, config);
  const payload = JSON.parse(
    await readFile(join(root, config.paths.generatedDir, 'records.full.json'), 'utf8'),
  ) as { generatedAt?: string; records?: GeneratedRecord[] };
  const generatedAt = payload.generatedAt ?? new Date().toISOString();
  const records = payload.records ?? [];

  const sitePayload = JSON.parse(
    await readFile(join(root, config.paths.generatedDir, 'site-config.json'), 'utf8'),
  ) as {
    stats?: { totalRecords?: number; repositoryStars?: number };
    blueprintConfig?: { labelPlural?: string; routeSlug?: string };
    taxonomy?: {
      categories?: Array<{ id: string; name?: string; count?: number; description?: string }>;
      stacks?: Array<{ id: string; name?: string; count?: number; description?: string }>;
      licenses?: Array<{ id: string; name?: string; count?: number }>;
    };
  };

  const collections = await loadCollections(root);
  // Resolved once: the sitemap needs to know which collections are
  // empty, the OG captions how many entries each one has. It is the
  // same projection the collection page uses, so all three agree.
  const collectionEntries = toCollectionEntries(records, {
    routeSlug: sitePayload.blueprintConfig?.routeSlug ?? 'projects',
  });
  const collectionCounts = new Map(
    collections.map((c) => [c.slug, runCollection(c, collectionEntries).entries.length] as const),
  );
  // A taxonomy id with no matching record gets no detail page at all
  // (see `[name].astro`'s `getStaticPaths`) — keep it out of the
  // sitemap too, instead of advertising a URL that 404s.
  const hasRecords = (t: { count?: number }) => (t.count ?? 0) > 0;
  // Categories and stacks also follow `seo.taxonomyIndexPolicy`, the
  // rule `getTaxonomyPageModel` applies to the page itself.
  const termIndexable = (t: { count?: number; description?: string }) =>
    taxonomyTermIndexable(
      { count: t.count ?? 0, description: t.description },
      config.seo.taxonomyIndexPolicy,
    );

  const sitemap = await buildSitemap(
    {
      generatedAt,
      items: records.map((r) => toSitemapItem(root, r, config.seo.recordIndexPolicy)),
      collections: collections.map((c) => ({
        slug: c.slug,
        // An empty collection renders noindex (there is nothing to
        // rank for), so it stays out of the sitemap as well; so does one
        // `seo.collectionIndexPolicy` excludes.
        index: collectionIndexable(
          {
            introduction: c.editorial?.introduction,
            hasBody: c.content
              ? hasEditorialBody(c.content, contentCandidates(root, c.content))
              : false,
            seoIndex: c.seo?.index,
            entryCount: collectionCounts.get(c.slug) ?? 0,
          },
          config.seo.collectionIndexPolicy,
        ),
        ...(c.editorial?.lastReviewedAt ? { lastReviewedAt: c.editorial.lastReviewedAt } : {}),
      })),
      taxonomies: {
        categories: (sitePayload.taxonomy?.categories ?? []).filter(termIndexable).map((t) => t.id),
        stacks: (sitePayload.taxonomy?.stacks ?? []).filter(termIndexable).map((t) => t.id),
        licenses: (sitePayload.taxonomy?.licenses ?? []).filter(hasRecords).map((t) => t.id),
      },
    },
    root,
    config,
  );

  const llms = await buildLlmsFiles(
    {
      generatedAt,
      records: records.map((r) => toLlmsRecord(root, r)),
    },
    root,
    config,
  );
  const siteArtifacts = await buildSiteArtifacts(root, config, sitePayload.stats);

  // ── Per-page OG images ────────────────────────────────────────────
  // Everything below is derived data for social cards; a wrong count
  // in a caption is acceptable, a failed build is not (buildOgImages
  // is internally non-fatal).
  const visible = records.filter((r) => {
    const visibility = r.health?.visibility ?? r.visibility;
    return visibility !== 'hide' && visibility !== 'remove';
  });
  const licenseOf = (r: GeneratedRecord) =>
    r.github?.license ?? r.github?.repository?.license?.spdx_id ?? undefined;
  const countBy = (pick: (r: GeneratedRecord) => string | undefined) => {
    const counts = new Map<string, number>();
    for (const r of visible) {
      const id = pick(r)?.toLowerCase();
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  };
  const categoryCounts = countBy((r) => r.category);
  const stackCounts = countBy((r) => r.stack);
  const licenseCounts = countBy(licenseOf);
  const taxonomyJobs = [
    ...(sitePayload.taxonomy?.categories ?? []).map((t) => ({
      facet: 'category' as const,
      id: t.id,
      label: t.name ?? t.id,
      count: categoryCounts.get(t.id.toLowerCase()) ?? 0,
    })),
    ...(sitePayload.taxonomy?.stacks ?? []).map((t) => ({
      facet: 'stack' as const,
      id: t.id,
      label: t.name ?? t.id,
      count: stackCounts.get(t.id.toLowerCase()) ?? 0,
    })),
    ...(sitePayload.taxonomy?.licenses ?? []).map((t) => ({
      facet: 'license' as const,
      id: t.id,
      label: t.name ?? t.id,
      count: licenseCounts.get(t.id.toLowerCase()) ?? 0,
    })),
  ];
  const categoryNames = new Map(
    (sitePayload.taxonomy?.categories ?? []).map((t) => [t.id.toLowerCase(), t.name ?? t.id]),
  );
  const ogImages = await buildOgImages(root, config, {
    records: visible.map((r) => {
      const descriptor = r.summary ?? r.description;
      const stars = r.github?.stars ?? r.github?.repository?.stargazers_count;
      const category = r.category
        ? (categoryNames.get(r.category.toLowerCase()) ?? r.category)
        : undefined;
      return {
        slug: r.slug,
        name: r.name ?? r.title ?? r.slug,
        ...(descriptor ? { descriptor } : {}),
        ...(stars !== undefined ? { stars } : {}),
        ...(category ? { category } : {}),
      };
    }),
    collections: collections.map((c) => ({
      slug: c.slug,
      title: c.seo?.title ?? c.title,
      count: collectionCounts.get(c.slug) ?? 0,
    })),
    taxonomies: taxonomyJobs,
    ...(sitePayload.stats ? { stats: sitePayload.stats } : {}),
    ...(sitePayload.blueprintConfig?.labelPlural
      ? { noun: sitePayload.blueprintConfig.labelPlural }
      : {}),
  });

  return { generated, sitemap, llms, siteArtifacts, ogImages };
}
