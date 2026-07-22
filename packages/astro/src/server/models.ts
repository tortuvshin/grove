/**
 * Page view-models for Grove's Astro adapter.
 *
 * These functions contain directory decisions and generated-data access,
 * while consumer-owned Astro pages keep control of markup and composition.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { IndexFilters, IndexRecord, ProjectRecord } from "@grove-dev/core";
import {
  activeFilterChips,
  applySort,
  buildFacets,
  effectivePage,
  effectiveSort,
  filterRecords,
  filtersFromSearchParams,
  formatRelative,
  formatStars,
  getOwnerAndRepoFromRepoUrl,
  getOwnerAvatarUrl,
  statusDisplay,
  totalPages,
} from "@grove-dev/core";
import {
  entityBySlug,
  fullItems,
  fullProjects,
  getContentHtml,
  itemLabel,
  itemLabelPlural,
  items,
  projectBySlug,
  resourceBySlug,
  taxonomyLabel,
} from "./directory.js";

export interface DirectorySiteConfig {
  name: string;
  tagline?: string;
  description?: string;
  repoUrl?: string;
  blueprintConfig?: {
    routeSlug?: string;
    labelSingular?: string;
    labelPlural?: string;
  };
  taxonomy?: {
    categories?: Array<{ id: string; name: string }>;
    stacks?: Array<{ id: string; name: string }>;
    platforms?: Array<{ id: string; name: string }>;
  };
  stats?: {
    originalRepo?: string;
    originalStars?: number;
    originalForks?: number;
    originalContributors?: number;
    totalApps?: number;
    totalCategories?: number;
    totalStacks?: number;
    totalOwners?: number;
    totalStars?: number;
  };
}

export interface DirectoryContributor {
  username: string;
  name?: string;
  avatarUrl?: string;
  profileUrl?: string;
  contributions?: number;
}

export function loadDirectoryContributors(root = process.cwd()): DirectoryContributor[] {
  const path = resolve(root, "data", "generated", "contributors.json");
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as {
      contributors?: DirectoryContributor[];
    };
    return parsed.contributors ?? [];
  } catch {
    return [];
  }
}

function daysSince(iso: string | null | undefined): number {
  if (!iso) return Infinity;
  const value = new Date(iso).valueOf();
  return Number.isNaN(value) ? Infinity : (Date.now() - value) / 86_400_000;
}

function projectStars(record: IndexRecord): number {
  return record.kind === "project" ? record.github?.stars ?? 0 : 0;
}

export function getHomePageModel(site: DirectorySiteConfig) {
  const slug = site.blueprintConfig?.routeSlug ?? "projects";
  const singular = site.blueprintConfig?.labelSingular ?? itemLabel();
  const plural = site.blueprintConfig?.labelPlural ?? itemLabelPlural();
  const projects = items.filter((record) => record.kind === "project");
  const hot = projects.filter((record) =>
    (record.curation?.labels ?? []).includes("hot") ||
    projectStars(record) >= 1000 ||
    daysSince(record.github?.pushedAt) <= 30
  ).slice(0, 6);
  const recentlyAdded = projects.filter((record) =>
    daysSince(record.curation?.reviewedAt) <= 21 ||
    (record.curation?.labels ?? []).includes("new")
  ).slice(0, 6);
  const established = projects.filter((record) =>
    (record.curation?.labels ?? []).includes("mature") || record.health?.tier === "curated"
  ).slice(0, 6);

  const stackCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  for (const record of fullItems) {
    if (record.category) categoryCounts.set(record.category, (categoryCounts.get(record.category) ?? 0) + 1);
    if (record.kind === "project" && record.stack) {
      stackCounts.set(record.stack, (stackCounts.get(record.stack) ?? 0) + 1);
    }
  }
  const stacks = [...stackCounts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([id, count]) => ({ name: taxonomyLabel("stacks", id), slug: id, count }));
  const categories = [...categoryCounts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id, count]) => ({ name: taxonomyLabel("categories", id), slug: id, count }));
  const contributors = loadDirectoryContributors();
  const description = site.description ??
    `A searchable directory of real ${plural} — organized by stack, category, platform, license, activity, and maturity.`;

  return {
    slug,
    itemSingular: singular,
    itemPlural: plural,
    hot,
    recentlyAdded,
    established,
    stacks,
    categories,
    contributors,
    title: `${site.name} — ${site.tagline ?? ""}`.trim(),
    description,
    stats: {
      originalRepo: site.stats?.originalRepo ?? "",
      apps: site.stats?.totalApps ?? 0,
      categories: site.stats?.totalCategories ?? 0,
      stacks: site.stats?.totalStacks ?? 0,
      owners: site.stats?.totalOwners ?? 0,
      stars: site.stats?.totalStars ?? 0,
    },
  };
}

export function getDirectoryIndexModel(searchParams: URLSearchParams) {
  const filters = filtersFromSearchParams(searchParams);
  const rawFacets = buildFacets(items);
  const facets = {
    ...rawFacets,
    stacks: rawFacets.stacks.map((option) => ({ ...option, label: taxonomyLabel("stacks", option.value) })),
    platforms: rawFacets.platforms.map((option) => ({ ...option, label: taxonomyLabel("platforms", option.value) })),
    categories: rawFacets.categories.map((option) => ({ ...option, label: taxonomyLabel("categories", option.value) })),
  };
  const sort = effectiveSort(filters);
  const sorted = applySort(filterRecords(items, filters), sort);
  const pageCount = totalPages(sorted.length);
  const page = Math.min(effectivePage(filters), pageCount);
  return {
    items,
    total: items.length,
    filters,
    facets,
    sort,
    sorted,
    pages: pageCount,
    page,
    chips: activeFilterChips(filters),
    clientItemsJson: JSON.stringify(items).replace(/</g, "\\u003c"),
  };
}

export function getContributorsPageModel(site: DirectorySiteConfig) {
  const contributors = loadDirectoryContributors();
  const sorted = [...contributors].sort((a, b) =>
    (b.contributions ?? 0) - (a.contributions ?? 0) || a.username.localeCompare(b.username)
  );
  const repo = site.repoUrl?.replace(/\/$/, "");
  return {
    contributors: sorted,
    total: sorted.length,
    title: `Community — ${site.name}`,
    description: `The people who have contributed to ${site.name} through code, curation, and review.`,
    contributorsGraphHref: repo ? `${repo}/graphs/contributors` : null,
  };
}

export function getSubmissionPageModel(site: DirectorySiteConfig) {
  const singular = site.blueprintConfig?.labelSingular ?? itemLabel();
  const values = (key: "category" | "stack") =>
    [...new Set(fullProjects.map((record) => String(record[key] ?? "")).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  const categories = (site.taxonomy?.categories?.length
    ? site.taxonomy.categories.map(({ id }) => id)
    : values("category"))
    .map((id) => ({ id, label: taxonomyLabel("categories", id) }));
  const stacks = (site.taxonomy?.stacks?.length
    ? site.taxonomy.stacks.map(({ id }) => id)
    : values("stack"))
    .map((id) => ({ id, label: taxonomyLabel("stacks", id) }));
  const existingFullNames = fullProjects.map((record) => {
    const url = String(record.repoUrl ?? record.links?.github ?? "");
    const match = url.match(/github\.com\/([^/]+)\/([^/?#]+)/i);
    return match ? `${match[1]}/${match[2].replace(/\.git$/, "")}`.toLowerCase() : null;
  }).filter((value): value is string => Boolean(value));

  return {
    singular,
    title: `Submit ${singular} - ${site.name}`,
    description: `Submit a new ${singular} to ${site.name}.`,
    repoUrl: site.repoUrl ?? "https://github.com/tortuvshin/grove",
    categories,
    stacks,
    existingSlugs: fullProjects.map((record) => record.slug).filter(Boolean),
    existingFullNames,
    platformOptions: site.taxonomy?.platforms?.map(({ name }) => name) ??
      ["iOS", "Android", "Web", "macOS", "Windows", "Linux"],
  };
}

type MonthlyCommit = number | { month: string; commits: number };
type ProjectExtras = {
  github?: {
    activity?: { monthlyCommits?: MonthlyCommit[] };
    files?: Record<string, boolean>;
    languages?: Record<string, number>;
  };
  health?: { status?: string; tier?: string };
};

export function getRecordDetailModel(
  recordSlug: string,
  site: DirectorySiteConfig,
  routeSlug = site.blueprintConfig?.routeSlug ?? "projects",
) {
  const project = projectBySlug(recordSlug);
  const resource = resourceBySlug(recordSlug);
  const entity = entityBySlug(recordSlug);
  const record = project ?? resource ?? entity;
  if (!record) return null;

  const isProject = record.kind === "project";
  const proj: ProjectRecord | null = project ?? null;
  const name = record.kind === "resource" ? record.title : record.name;
  const description = record.description ?? `${name} on ${site.name}`;
  const repoUrl = proj?.repoUrl ?? record.links?.github ?? "";
  const homepageUrl = record.links?.website ?? "";
  const stacks = proj?.stacks ?? (proj?.stack ? [proj.stack] : []);
  const platforms = proj?.platforms ?? [];
  const github = proj?.github?.repository;
  const stars = github?.stargazers_count ?? 0;
  const forks = github?.forks_count ?? 0;
  const language = github?.language ?? null;
  const licenseSpdx = github?.license?.spdx_id ?? null;
  const pushedAt = github?.pushed_at ?? null;
  const ownerRepo = repoUrl ? getOwnerAndRepoFromRepoUrl(repoUrl) : null;
  const avatarSrc = proj?.logoUrl ?? (ownerRepo ? getOwnerAvatarUrl(ownerRepo.owner, 80) : null);
  const rawScores = proj?.scores;
  const scores = rawScores && Object.values(rawScores).some((value) => typeof value === "number")
    ? rawScores
    : null;
  const healthStatus = proj?.health?.status;
  const extras = record as ProjectExtras;
  const monthlyCommits = (extras.github?.activity?.monthlyCommits ?? []).map(
    (value): { month: string; commits: number } => typeof value === "number"
      ? { month: "", commits: value }
      : { month: value.month ?? "", commits: value.commits ?? 0 },
  );
  const contributionLabels: Record<string, string> = {
    readme: "README",
    contributing: "Contributing",
    security: "Security",
    issueTemplates: "Issue templates",
    pullRequestTemplate: "PR template",
  };
  const contributionFiles = extras.github?.files ?? {};
  const contributionSignals = Object.keys(contributionLabels)
    .map((key) => ({ key, label: contributionLabels[key], ok: contributionFiles[key] }))
    .filter((signal) => signal.ok !== undefined);
  const languages = extras.github?.languages
    ? Object.entries(extras.github.languages).sort((a, b) => b[1] - a[1]).slice(0, 5)
    : [];

  let jsonLd: Record<string, unknown>;
  if (isProject && proj) {
    const sameAs = [repoUrl, homepageUrl].filter(Boolean);
    const dateCreated = record.curation?.reviewedAt;
    jsonLd = {
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      name,
      headline: name,
      description: record.description ?? undefined,
      url: repoUrl || homepageUrl || undefined,
      codeRepository: repoUrl || undefined,
      sameAs: sameAs.length ? sameAs : undefined,
      programmingLanguage: language ?? undefined,
      license: licenseSpdx ?? undefined,
      applicationCategory: record.category || undefined,
      operatingSystem: platforms.length ? platforms.join(", ") : undefined,
      keywords: record.tags?.length ? record.tags.join(", ") : undefined,
      dateCreated: dateCreated ?? undefined,
      dateModified: pushedAt ?? dateCreated ?? undefined,
      interactionStatistic: stars > 0 ? {
        "@type": "InteractionCounter",
        interactionType: { "@type": "LikeAction" },
        userInteractionCount: stars,
      } : undefined,
      author: ownerRepo ? {
        "@type": "Organization",
        name: ownerRepo.owner,
        url: `https://github.com/${ownerRepo.owner}`,
      } : undefined,
      isAccessibleForFree: true,
    };
  } else if (record.kind === "resource") {
    const schemaTypes: Record<string, string> = {
      article: "Article", book: "Book", course: "Course", podcast: "PodcastSeries", video: "VideoObject",
    };
    jsonLd = {
      "@context": "https://schema.org",
      "@type": schemaTypes[record.type] ?? "CreativeWork",
      name,
      headline: name,
      description: record.description || undefined,
      url: homepageUrl || undefined,
      author: record.author ? { "@type": "Person", name: record.author } : undefined,
      datePublished: record.publishedAt || undefined,
      keywords: record.tags?.length ? record.tags.join(", ") : undefined,
      isAccessibleForFree: true,
    };
  } else {
    jsonLd = {
      "@context": "https://schema.org",
      "@type": entity?.type === "person" ? "Person" : "Organization",
      name,
      headline: name,
      description: entity?.description || undefined,
      url: homepageUrl || undefined,
      foundingDate: entity?.founded || undefined,
      location: entity?.location || undefined,
      keywords: entity?.tags?.length ? entity.tags.join(", ") : undefined,
    };
  }

  return {
    slug: routeSlug,
    record,
    project: proj,
    entity,
    isProject,
    name,
    title: `${name} — ${site.name}`,
    description,
    itemSingular: site.blueprintConfig?.labelSingular ?? record.kind,
    repoUrl,
    homepageUrl,
    stacks,
    platforms,
    github,
    stars,
    forks,
    language,
    licenseSpdx,
    pushedAt,
    starsLabel: formatStars(stars),
    pushedLabel: formatRelative(pushedAt),
    ownerRepo,
    avatarSrc,
    initials: name.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase(),
    bestFor: proj?.bestFor ?? [],
    whyListed: proj?.whyListed ?? [],
    caveats: proj?.caveats ?? [],
    distribution: proj?.distribution?.channels ?? [],
    scores,
    curationLabels: record.curation?.labels ?? [],
    tags: record.tags ?? [],
    healthLabel: healthStatus ? statusDisplay(healthStatus) : null,
    contentHtml: isProject ? getContentHtml(recordSlug) : null,
    monthlyCommits,
    maxMonthlyCommits: Math.max(1, ...monthlyCommits.map((item) => item.commits)),
    contributionSignals,
    languages,
    totalLanguageBytes: Math.max(1, languages.reduce((sum, [, bytes]) => sum + bytes, 0)),
    jsonLd,
  };
}

export type DirectoryIndexModel = ReturnType<typeof getDirectoryIndexModel>;
export type DirectoryHomeModel = ReturnType<typeof getHomePageModel>;
export type SubmissionPageModel = ReturnType<typeof getSubmissionPageModel>;
export type ContributorsPageModel = ReturnType<typeof getContributorsPageModel>;
export type RecordDetailModel = NonNullable<ReturnType<typeof getRecordDetailModel>>;
export type { IndexFilters };
