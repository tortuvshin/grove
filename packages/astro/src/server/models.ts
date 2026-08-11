/**
 * Page view-models for Grove's Astro adapter.
 *
 * These functions contain directory decisions and generated-data access,
 * while consumer-owned Astro pages keep control of markup and composition.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  IndexFilters,
  IndexRecord,
  ProjectRecord,
  ReadingMetrics,
  TocEntry,
} from "@grove-dev/core";
import {
  activeFilterChips,
  applySort,
  buildFacets,
  effectivePage,
  effectiveSort,
  extractToc,
  filterRecords,
  filtersFromSearchParams,
  formatRelative,
  formatStars,
  getOwnerAndRepoFromRepoUrl,
  getOwnerAvatarUrl,
  projectStackIds,
  readingMetrics,
  readContentFile,
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
  nav?: Array<{ label: string; href: string }>;
  facets?: string[];
  analytics?: {
    googleAnalyticsId?: string;
  };
  footer?: {
    columns?: Array<{
      heading: string;
      items: Array<{ label: string; href: string; external?: boolean }>;
    }>;
    copyright?: string;
    license?: string;
  };
  submission?: {
    eyebrow?: string;
    title?: string;
    description?: string;
    good?: string[];
    avoid?: string[];
  };
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

export function getHomePageModel(site: DirectorySiteConfig) {
  const slug = site.blueprintConfig?.routeSlug ?? "projects";
  const singular = site.blueprintConfig?.labelSingular ?? itemLabel();
  const plural = site.blueprintConfig?.labelPlural ?? itemLabelPlural();
  const projects = items.filter((record) => record.kind === "project");
  // Hot: most-starred items carrying the "hot" lens label. Without an
  // explicit sort, the filter preserves the index order, which is
  // alphabetical — so the homepage's "Trending now" panel ends up
  // showing the same 6 items as the "Established" panel (because
  // ~95% of mature items also carry the "hot" label).
  const hot = applySort(filterRecords(projects, { labels: ["hot"] }), "most-starred").slice(0, 6);
  // Recently added: most recently reviewed items. We exclude items
  // already shown in the hot panel so the three lens sections on the
  // homepage never echo the same record card.
  const hotSlugs = new Set(hot.map((r) => r.slug));
  const recentlyAdded = applySort(
    projects.filter((r) => !hotSlugs.has(r.slug)),
    "recently-added",
  ).slice(0, 6);
  // Established: longest-running mature items, again excluding any
  // record already surfaced in the hot or recently-added panel so the
  // three sections read as distinct perspectives.
  const recentSlugs = new Set([...hotSlugs, ...recentlyAdded.map((r) => r.slug)]);
  const established = applySort(
    filterRecords(projects, { labels: ["mature"] }).filter((r) => !recentSlugs.has(r.slug)),
    "most-starred",
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

const FACET_ALIASES: Record<string, "stacks" | "platforms" | "categories" | "tags" | "licenses"> = {
  stack: "stacks",
  stacks: "stacks",
  platform: "platforms",
  platforms: "platforms",
  category: "categories",
  categories: "categories",
  tag: "tags",
  tags: "tags",
  license: "licenses",
  licenses: "licenses",
};

function configuredFacets(site?: DirectorySiteConfig) {
  return new Set((site?.facets ?? ["category", "tags"])
    .map((facet) => FACET_ALIASES[facet])
    .filter((facet): facet is NonNullable<typeof facet> => Boolean(facet)));
}

export function getDirectoryIndexModel(searchParams: URLSearchParams, site?: DirectorySiteConfig) {
  const filters = filtersFromSearchParams(searchParams);
  const rawFacets = buildFacets(items, {
    curatedTagIds: site.taxonomy?.topics?.map((t) => t.id),
    filters, // Intersection counts: each facet reflects all OTHER filters.
  });
  const enabled = configuredFacets(site);
  const facets = {
    stacks: enabled.has("stacks") ? rawFacets.stacks.map((option) => ({ ...option, label: taxonomyLabel("stacks", option.value) })) : [],
    platforms: enabled.has("platforms") ? rawFacets.platforms.map((option) => ({ ...option, label: taxonomyLabel("platforms", option.value) })) : [],
    categories: enabled.has("categories") ? rawFacets.categories.map((option) => ({ ...option, label: taxonomyLabel("categories", option.value) })) : [],
    tags: enabled.has("tags") ? rawFacets.tags : [],
    licenses: enabled.has("licenses") ? rawFacets.licenses : [],
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
  // Render-time guard: even if a stale `data/generated/contributors.json`
  // was produced before the sync-time filter was added, never surface
  // bot accounts (login ends with `[bot]`) on the public contributors
  // page. The ContributorsGrid uses the same total for its heading, so
  // the headline count always agrees with the rendered grid.
  const human = contributors.filter((c) => !c.username.endsWith("[bot]"));
  const sorted = [...human].sort((a, b) =>
    (b.contributions ?? 0) - (a.contributions ?? 0) || a.username.localeCompare(b.username)
  );
  const repo = site.repoUrl?.replace(/\/$/, "");
  return {
    contributors: sorted,
    total: sorted.length,
    title: `Community — ${site.name}`,
    description: `The people who have contributed to ${site.name} through code, curation, and review.`,
    contributorsGraphHref: repo ? `${repo}/graphs/contributors` : null,
    // Surface the consumer's per-user contribution-count preference to
    // the consumer page so it can render quieter cards when the
    // directory does not curate contributor activity.
    showContributionCount: site.contributors?.showContributionCount ?? true,
  };
}

export function getSubmissionPageModel(site: DirectorySiteConfig) {
  const singular = site.blueprintConfig?.labelSingular ?? itemLabel();
  const enabled = configuredFacets(site);
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
    copy: site.submission ?? {},
    fields: {
      category: enabled.has("categories"),
      stack: enabled.has("stacks"),
      platforms: enabled.has("platforms"),
      tags: enabled.has("tags"),
    },
    categories,
    stacks,
    existingSlugs: fullProjects.map((record) => record.slug).filter(Boolean),
    existingFullNames,
    platformOptions: site.taxonomy?.platforms?.map(({ id, name }) => ({ id, label: name })) ??
      ["ios", "android", "web", "macos", "windows", "linux"].map((id) => ({ id, label: taxonomyLabel("platforms", id) })),
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
  const stacks = projectStackIds(proj);
  const platforms = proj?.platforms ?? [];
  const github = proj?.github?.repository;
  const stars = github?.stargazers_count ?? 0;
  const forks = github?.forks_count ?? 0;
  const language = github?.language ?? null;
  const licenseSpdx = github?.license?.spdx_id ?? null;
  const pushedAt = github?.pushed_at ?? null;
  const isArchived = !!github?.archived;
  const isDisabled = !!github?.disabled;
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
const healthLabel = healthStatus ? statusDisplay(healthStatus) : null;
const tags = record.tags ?? [];
const tocBody = readContentFile(typeof record.content === "string" ? record.content : "");

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
    tags,
    healthLabel,
    // Top-level `category` so the package's RecordHeader / RecordSidebar
    // components can render the category pill without each consumer
    // having to destructure `record.category` themselves.
    category: record.category,
    contentHtml: isProject ? getContentHtml(recordSlug) : null,
    // Curated summary (Open Apps-written) takes priority over the
    // raw `description` (typically copied from GitHub). Fall back to
    // `description` when the curator has not written a summary yet.
    summary: (record.summary && record.summary.trim()) || record.description || "",
    sourceDescription: record.sourceDescription ?? record.description ?? "",
    // Collection membership is populated by the consumer detail page
    // after calling `findCollectionsFor`. Defaulting to [] keeps the
    // model safe when the consumer doesn't wire it.
    collectionMembership: [],
    // Curated screenshots array. Defaulting to [] keeps the renderer
    // safe; RecordHeader shows a gallery strip when non-empty.
    screenshots: proj?.screenshots ?? [],
    monthlyCommits,
    maxMonthlyCommits: Math.max(1, ...monthlyCommits.map((item) => item.commits)),
    contributionSignals,
    languages,
    totalLanguageBytes: Math.max(1, languages.reduce((sum, [, bytes]) => sum + bytes, 0)),
    // ── Sidebar-shape fields ────────────────────────────────
    // Read once at model-build time so pages don't repeat the
    // "is there data for this card?" logic.
    activityBadge: computeActivityBadge({
      pushedAt,
      monthlyCommits,
      isArchived,
      isDisabled,
    }),
    sidebar: computeSidebarVisibility({
      language,
      licenseSpdx,
      repo: github,
      pushedAt,
      isArchived,
      healthLabel,
      stacks,
      platforms,
      tags,
      category: record.category,
      contributionSignals,
      reviewedAt: record.curation?.reviewedAt,
    }),
    // ── Body-derived fields ──────────────────────────────────
    // Both depend on the sidecar Markdown; the body is re-read
    // here even though it's also read for `contentHtml` upstream
    // because the TOC + reading-time want the *body* (frontmatter
    // stripped), not the HTML. Re-reading is cheap and keeps the
    // pipeline self-documenting.
    toc: tocBody ? extractToc(tocBody.body, { maxDepth: 2 }) : [],
    readingMetrics: tocBody ? readingMetrics(tocBody.body) : { wordCount: 0, minutes: 1 },
    jsonLd,
  };
}

// ── Sidebar predicates ────────────────────────────────────────────

/**
 * Tone + label for the activity badge that appears in the header.
 *
 * Rules (intentionally explicit so a reader can predict the badge
 * without consulting a weighting formula):
 *
 *   - Archived or disabled repo → "Archived"
 *   - Recent monthly-commit total ≥ 50 → "Very active"
 *   - ≥ 10 recent commits, or last push < 30d ago → "Active"
 *   - ≥ 1 commit, or last push < 180d ago → "Maintained"
 *   - last push 180d–365d → "Low activity"
 *   - last push > 365d → "Stale"
 *   - no push data and no commit data → null
 *
 * Returns `null` when neither GitHub push nor monthly commits are
 * present (e.g. an un-synced record), so the badge simply doesn't
 * render.
 */
export function computeActivityBadge(input: {
  pushedAt: string | null;
  monthlyCommits: Array<{ month: string; commits: number }>;
  isArchived: boolean;
  isDisabled: boolean;
}): { label: string; tone: "fresh" | "ok" | "low" | "dead" } | null {
  if (input.isArchived || input.isDisabled) {
    return { label: "Archived", tone: "dead" };
  }
  const recentCommits = (input.monthlyCommits ?? [])
    .slice(-3)
    .reduce((sum, c) => sum + (c.commits ?? 0), 0);
  if (recentCommits >= 50) return { label: "Very active", tone: "fresh" };
  if (recentCommits >= 10) return { label: "Active", tone: "ok" };
  if (recentCommits > 0) return { label: "Maintained", tone: "ok" };
  if (input.pushedAt) {
    const days =
      (Date.now() - new Date(input.pushedAt).getTime()) / 86_400_000;
    if (days < 30) return { label: "Active", tone: "ok" };
    if (days < 180) return { label: "Maintained", tone: "ok" };
    if (days < 365) return { label: "Low activity", tone: "low" };
    return { label: "Stale", tone: "low" };
  }
  return null;
}

/**
 * Visibility booleans for each sidebar card. Cards with no data
 * suppress themselves entirely so the sidebar never shows "—" or
 * "0" placeholders that confuse "we haven't fetched yet" with
 * "the value is genuinely zero".
 */
export function computeSidebarVisibility(input: {
  language: string | null;
  licenseSpdx: string | null;
  repo: Record<string, unknown> | null | undefined;
  pushedAt: string | null;
  isArchived: boolean;
  healthLabel: string | null;
  stacks: string[];
  platforms: string[];
  tags: string[];
  category: string | undefined;
  contributionSignals: Array<{ key: string; label: string; ok: boolean }>;
  reviewedAt: string | undefined;
}): {
  showActivity: boolean;
  showFreshness: boolean;
  showEcosystem: boolean;
  showSource: boolean;
} {
  const repoFields = input.repo ?? {};
  const hasRepo =
    typeof input.repo === "object" &&
    input.repo !== null &&
    Object.keys(repoFields).length > 0;
  return {
    showActivity:
      hasRepo ||
      !!input.language ||
      !!input.licenseSpdx,
    showFreshness:
      hasRepo ||
      !!input.pushedAt ||
      !!input.healthLabel ||
      input.isArchived,
    showEcosystem:
      input.stacks.length > 0 ||
      input.platforms.length > 0 ||
      input.tags.length > 0 ||
      !!input.category ||
      input.contributionSignals.length > 0,
    showSource: !!input.reviewedAt,
  };
}

/**
 * `getStaticPaths()` body for the consumer's detail page. Centralized
 * here so the CLI's scaffold and the example app share one definition.
 */
export function recordDetailPaths(site: DirectorySiteConfig) {
  const dirSlug = site.blueprintConfig?.routeSlug ?? "items";
  return fullItems.map((record) => ({
    params: { slug: dirSlug, recordSlug: record.slug },
  }));
}

export type DirectoryIndexModel = ReturnType<typeof getDirectoryIndexModel>;
export type DirectoryHomeModel = ReturnType<typeof getHomePageModel>;
export type SubmissionPageModel = ReturnType<typeof getSubmissionPageModel>;
export type ContributorsPageModel = ReturnType<typeof getContributorsPageModel>;
export type RecordDetailModel = NonNullable<ReturnType<typeof getRecordDetailModel>>;
export type { IndexFilters };
