import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { generate, type GenerateResult } from "./build-data.js";
import { loadCollections } from "./collections-io.js";
import { loadConfig } from "./config.js";
import {
  buildLlmsFiles,
  type LlmsRecordInput,
  type LlmsResult,
} from "./llms.js";
import {
  buildSitemap,
  type SitemapInput,
  type SitemapResult,
} from "./sitemap.js";
import {
  buildSiteArtifacts,
  type SiteArtifactsResult,
} from "./site-artifacts.js";

export interface PrepareDirectoryResult {
  generated: GenerateResult;
  sitemap: SitemapResult;
  llms: LlmsResult;
  siteArtifacts: SiteArtifactsResult;
}

type GeneratedRecord = {
  slug: string;
  name?: string;
  title?: string;
  description?: string;
  category?: string;
  stack?: string;
  visibility?: string;
  repoUrl?: string;
  homepageUrl?: string;
  addedAt?: string | null;
  lastCommitAt?: string | null;
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
};

function toSitemapItem(record: GeneratedRecord): SitemapInput["items"][number] {
  const visibility = record.health?.visibility ?? record.visibility;
  const lastCommitAt =
    record.lastCommitAt ??
    record.github?.pushedAt ??
    record.github?.repository?.pushed_at;
  return {
    slug: record.slug,
    ...(visibility !== undefined ? { visibility } : {}),
    ...(lastCommitAt !== undefined ? { lastCommitAt } : {}),
    ...(record.addedAt !== undefined ? { addedAt: record.addedAt } : {}),
  };
}

function toLlmsRecord(record: GeneratedRecord): LlmsRecordInput {
  const stars =
    record.github?.stars ?? record.github?.repository?.stargazers_count;
  const visibility = record.health?.visibility ?? record.visibility;
  const repoUrl = record.repoUrl ?? record.links?.github;
  const homepageUrl = record.homepageUrl ?? record.links?.website;
  const license =
    record.github?.license ??
    record.github?.repository?.license?.spdx_id ??
    undefined;
  const lastCommitAt =
    record.lastCommitAt ??
    record.github?.pushedAt ??
    record.github?.repository?.pushed_at;
  return {
    slug: record.slug,
    name: record.name ?? record.title ?? record.slug,
    ...(record.description !== undefined
      ? { description: record.description }
      : {}),
    ...(record.category !== undefined ? { category: record.category } : {}),
    ...(record.stack !== undefined ? { stack: record.stack } : {}),
    ...(stars !== undefined ? { stars } : {}),
    ...(visibility !== undefined ? { visibility } : {}),
    ...(repoUrl !== undefined ? { repoUrl } : {}),
    ...(homepageUrl !== undefined ? { homepageUrl } : {}),
    ...(license !== undefined ? { license } : {}),
    ...(lastCommitAt !== undefined ? { lastCommitAt } : {}),
    ...(record.addedAt !== undefined ? { addedAt: record.addedAt } : {}),
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
export async function prepareDirectory(
  cwd = process.cwd(),
): Promise<PrepareDirectoryResult> {
  const root = resolve(cwd);
  const config = await loadConfig(root);
  const generated = await generate(root, config);
  const payload = JSON.parse(
    await readFile(
      join(root, config.paths.generatedDir, "records.full.json"),
      "utf8",
    ),
  ) as { generatedAt?: string; records?: GeneratedRecord[] };
  const generatedAt = payload.generatedAt ?? new Date().toISOString();
  const records = payload.records ?? [];

  const sitePayload = JSON.parse(
    await readFile(
      join(root, config.paths.generatedDir, "site-config.json"),
      "utf8",
    ),
  ) as {
    stats?: { totalRecords?: number; repositoryStars?: number };
    blueprintConfig?: { labelPlural?: string };
    taxonomy?: {
      categories?: Array<{ id: string; name?: string }>;
      stacks?: Array<{ id: string; name?: string }>;
      licenses?: Array<{ id: string; name?: string }>;
    };
  };

  const collections = await loadCollections(root);

  const sitemap = await buildSitemap(
    {
      generatedAt,
      items: records.map(toSitemapItem),
      collections: collections.map((c) => ({
        slug: c.slug,
        index: c.seo?.index !== false,
        ...(c.editorial?.lastReviewedAt
          ? { lastReviewedAt: c.editorial.lastReviewedAt }
          : {}),
      })),
      taxonomies: {
        categories: (sitePayload.taxonomy?.categories ?? []).map((t) => t.id),
        stacks: (sitePayload.taxonomy?.stacks ?? []).map((t) => t.id),
        licenses: (sitePayload.taxonomy?.licenses ?? []).map((t) => t.id),
      },
    },
    root,
    config,
  );

  const llms = await buildLlmsFiles(
    {
      generatedAt,
      records: records.map(toLlmsRecord),
    },
    root,
    config,
  );
  const siteArtifacts = await buildSiteArtifacts(
    root,
    config,
    sitePayload.stats,
  );

  return { generated, sitemap, llms, siteArtifacts };
}
