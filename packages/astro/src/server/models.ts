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
  IndexProjectRecord,
  IndexRecord,
  ProjectRecord,
  ReadingMetrics,
  Resource,
  TocEntry,
} from "@grove-dev/core";
import {
  activeFilterChips,
  applySort,
  buildFacets,
  collectionSchema,
  configuredFacetDefs,
  effectivePage,
  effectiveSort,
  extractToc,
  filterRecords,
  filtersFromSearchParams,
  formatRelative,
  formatStars,
  getOwnerAndRepoFromRepoUrl,
  getOwnerAvatarUrl,
  hasAnyFilter,
  hrefForClearedFilters,
  hrefForFilters,
  nameInitials,
  pagePathHref,
  paginate,
  projectStackIds,
  readingMetrics,
  readContentFile,
  statusDisplay,
  totalPages,
  truncateWords,
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
import {
  absoluteUrl,
  breadcrumbs,
  ogPath,
  type PageSeo,
  recordSeoDescriptor,
  seoDescription,
  seoTitle,
  titleCaseFirst,
} from "./seo.js";

export interface DirectorySiteConfig {
  name: string;
  tagline?: string;
  description?: string;
  repoUrl?: string;
  /** Absolute site URL. `site-config.json` ships it as `siteUrl`;
   *  `url` is accepted for hand-built configs. Used to absolutize
   *  JSON-LD URLs (breadcrumbs, ItemList entries). */
  siteUrl?: string;
  url?: string;
  nav?: Array<{ label: string; href: string }>;
  browse?: {
    facets?: string[];
  };
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
    topics?: Array<{ id: string; name: string }>;
    licenses?: Array<{ id: string; name: string }>;
    distributionChannels?: Array<{ id: string; name: string }>;
  };
  contributors?: {
    showContributionCount?: boolean;
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

/** Site URL used to absolutize JSON-LD links. The generated
 *  site-config always carries `siteUrl`; the fallback mirrors
 *  build-data's own default so both stay aligned. */
function siteUrlOf(site?: DirectorySiteConfig): string {
  return (site?.siteUrl ?? site?.url ?? "https://example.com").replace(/\/$/, "");
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

/**
 * Canonical taxonomy counts — the ONE algorithm every count surface
 * uses. Counts the VISIBLE index (`items`, the same set browse
 * filters over) with the primary+supporting stack union
 * (`projectStackIds`), so the homepage grid, `/stacks`,
 * `/categories`, and the browse facet counts can never disagree.
 * (Counting `fullItems` with the singular `record.stack` was the
 * audit's "Python 3 vs 4" drift.)
 */
export function countTaxonomies() {
  const stackCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  for (const record of items) {
    if (record.category) categoryCounts.set(record.category, (categoryCounts.get(record.category) ?? 0) + 1);
    if (record.kind === "project") {
      for (const stackId of projectStackIds(record)) {
        stackCounts.set(stackId, (stackCounts.get(stackId) ?? 0) + 1);
      }
    }
  }
  const toEntries = (
    counts: Map<string, number>,
    kind: "stacks" | "categories",
  ) =>
    [...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([id, count]) => ({ name: taxonomyLabel(kind, id), slug: id, count }));
  return {
    stacks: toEntries(stackCounts, "stacks"),
    categories: toEntries(categoryCounts, "categories"),
  };
}

/**
 * Uncapped taxonomy index model for the `/stacks` and `/categories`
 * pages — same canonical counts, no homepage display cap.
 */
export function getTaxonomyIndexModel() {
  return countTaxonomies();
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
  //
  // Top-up guard: when fewer than MIN_HOT records carry the "hot"
  // label, fill the remainder from the most-starred remaining
  // projects so the first lens panel can always render a full
  // three-column grid. Topped-up records are still excluded from the
  // "Recently added" / "Established" panels below.
  const MIN_HOT = 3;
  const hotLabelled = applySort(filterRecords(projects, { labels: ["hot"] }), "most-starred").slice(0, 6);
  const labelledSlugs = new Set(hotLabelled.map((r) => r.slug));
  const hot =
    hotLabelled.length >= MIN_HOT
      ? hotLabelled
      : [
          ...hotLabelled,
          ...applySort(projects, "most-starred")
            .filter((r) => !labelledSlugs.has(r.slug))
            .slice(0, MIN_HOT - hotLabelled.length),
        ];
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

  // Homepage layout choice: cap the stack grid at 12. The counting
  // itself is the canonical algorithm in `countTaxonomies`.
  const { stacks: allStacks, categories } = countTaxonomies();
  const stacks = allStacks.slice(0, 12);
  const contributors = loadDirectoryContributors();
  const description = seoDescription(
    site.description,
    `A searchable directory of real ${plural} — organized by stack, category, platform, license, activity, and maturity.`,
  );
  // "{Site} — {tagline}", but never a dangling "{Site} —" when the
  // tagline is unset, and never a tagline that pushes the title past
  // the ~60-char display cap.
  const tagline = (site.tagline ?? "").trim();
  const title =
    tagline && `${site.name} — ${tagline}`.length <= 65
      ? `${site.name} — ${tagline}`
      : site.name;
  const seo: PageSeo = {
    title,
    description,
    image: ogPath("home"),
  };

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
    title,
    description,
    seo,
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

/**
 * Ordered facet definitions for this site — the single registry in
 * `@grove-dev/core` resolves `browse.facets`, so visibility, ORDER,
 * labels, and selection mode all come from one place.
 */
function enabledFacetDefs(site?: DirectorySiteConfig) {
  return configuredFacetDefs(site?.browse?.facets);
}

/** Taxonomy list that labels/orders each facet dimension. */
const TAXONOMY_KIND_FOR_DIMENSION = {
  stacks: "stacks",
  platforms: "platforms",
  categories: "categories",
  tags: "topics",
  licenses: "licenses",
} as const;

/**
 * @param options.page Route-supplied page number. The browse route is
 * prerendered per page (`/projects/`, `/projects/2/`), so the page comes
 * from the path, not from a query string the build can never see.
 */
export function getDirectoryIndexModel(
  searchParams: URLSearchParams,
  site?: DirectorySiteConfig,
  options: { page?: number } = {},
) {
  const filters = filtersFromSearchParams(searchParams);
  // Taxonomy YAML owns option order: the generated arrays preserve
  // file/`order:` position, so their id sequence IS the display order.
  const taxonomyOrder = {
    stacks: site?.taxonomy?.stacks?.map((t) => t.id),
    platforms: site?.taxonomy?.platforms?.map((t) => t.id),
    categories: site?.taxonomy?.categories?.map((t) => t.id),
    tags: site?.taxonomy?.topics?.map((t) => t.id),
    licenses: site?.taxonomy?.licenses?.map((t) => t.id),
  };
  const rawFacets = buildFacets(items, {
    curatedTagIds: taxonomyOrder.tags,
    filters, // Intersection counts: each facet reflects all OTHER filters.
    order: taxonomyOrder,
  });
  const defs = enabledFacetDefs(site);
  const enabled = new Set(defs.map((def) => def.dimension));
  const labeled = (dimension: keyof typeof TAXONOMY_KIND_FOR_DIMENSION) =>
    rawFacets[dimension].map((option) => ({
      ...option,
      label: taxonomyLabel(TAXONOMY_KIND_FOR_DIMENSION[dimension], option.value),
    }));
  const facets = {
    stacks: enabled.has("stacks") ? labeled("stacks") : [],
    platforms: enabled.has("platforms") ? labeled("platforms") : [],
    categories: enabled.has("categories") ? labeled("categories") : [],
    tags: enabled.has("tags") ? labeled("tags") : [],
    licenses: enabled.has("licenses") ? labeled("licenses") : [],
  };
  // Ordered filter groups — `browse.facets` array order is the render
  // order; label + selection mode come from the core registry.
  const facetGroups = defs
    .map((def) => ({
      id: def.id,
      filterKey: def.dimension,
      label: def.label,
      single: def.single,
      options: facets[def.dimension],
      initial: (filters[def.dimension] ?? []) as string[],
    }))
    .filter((group) => group.options.length > 0);
  const plural = site?.blueprintConfig?.labelPlural ?? itemLabelPlural();
  // Placeholder names only the ENABLED dimensions, in config order.
  const searchPlaceholder = `Search ${plural}, ${defs.map((def) => def.dimension).join(", ")}...`;
  const sort = effectiveSort(filters);
  const sorted = applySort(filterRecords(items, filters), sort);
  const pageCount = totalPages(sorted.length);
  const page = Math.min(Math.max(1, options.page ?? effectivePage(filters)), pageCount);
  const pathPrefix = `/${site?.blueprintConfig?.routeSlug ?? "projects"}`;
  const siteUrl = siteUrlOf(site);
  const siteName = site?.name ?? "";
  const pluralTitle = titleCaseFirst(plural);
  const facetNames = defs.map((def) => def.label.toLowerCase()).join(", ");
  const listItems = sorted.slice(0, 50).map((record) => {
    const r = record as { slug: string; name?: string; title?: string; description?: string };
    return {
      url: absoluteUrl(siteUrl, `${pathPrefix}/${r.slug}/`),
      name: r.name ?? r.title ?? r.slug,
      ...(r.description ? { description: r.description } : {}),
    };
  });
  const seo: PageSeo = {
    title: seoTitle(`Browse ${pluralTitle}`, siteName),
    // Build the page-aware description BEFORE seoDescription truncates,
    // so the page suffix fits inside the 160-char cap rather than
    // pushing the sentence over and getting clipped mid-word.
    description: seoDescription(
      undefined,
      page > 1
        ? `Browse page ${page} of ${pageCount} — ${items.length} curated ${plural} on ${siteName || "this site"}, filtered by ${facetNames || "category and stack"}.`
        : `Search and filter ${items.length} curated ${plural} on ${siteName || "this site"} — by ${facetNames || "category and stack"}.`,
    ),
    image: ogPath("default"),
    jsonLd: [
      ...collectionSchema({
        url: absoluteUrl(siteUrl, `${pathPrefix}/`),
        name: `Browse ${pluralTitle}`,
        description: `All ${plural} on ${siteName || "this site"}.`,
        items: listItems,
        crumbs: [
          { url: `${siteUrl}/`, name: "Home" },
          { url: absoluteUrl(siteUrl, `${pathPrefix}/`), name: pluralTitle },
        ],
      }),
    ],
  };
  return {
    seo,
    items,
    total: items.length,
    filters,
    facets,
    facetGroups,
    searchPlaceholder,
    sort,
    sorted,
    /**
     * The records this page actually renders. The page used to print
     * every record and let the client hide the rest, so the DOM and the
     * HTML both scaled with the whole directory.
     */
    pageItems: paginate(sorted, page),
    pages: pageCount,
    page,
    pathPrefix,
    /**
     * Plain pages are real paths; anything the URL narrows or reorders
     * stays a query. `sort` counts: every `/page/N/` document is built
     * with the default sort, so paging out of `?sort=most-starred` onto
     * one would re-sort the list mid-journey.
     */
    hrefForResultPage: (target: number) =>
      hasAnyFilter(filters) || filters.sort
        ? hrefForFilters({ ...filters, page: target }, pathPrefix)
        : pagePathHref(pathPrefix, target),
    clearFiltersHref: hrefForClearedFilters(filters, pathPrefix),
    chips: activeFilterChips(filters, { taxonomy: site?.taxonomy, pathPrefix }),
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
  const siteUrl = siteUrlOf(site);
  const title = seoTitle("Contributors", site.name);
  const description = seoDescription(
    undefined,
    sorted.length > 0
      ? `${sorted.length} people maintain ${site.name} — every entry is a file in a public repository, and these are the contributors behind it.`
      : `The people behind ${site.name} — every entry is a file in a public repository, maintained through code, curation, and review.`,
  );
  const seo: PageSeo = {
    title,
    description,
    image: ogPath("default"),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": ["CollectionPage", "WebPage"],
        "@id": `${absoluteUrl(siteUrl, "contributors/")}#page`,
        url: absoluteUrl(siteUrl, "contributors/"),
        name: title,
        description,
      },
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        numberOfItems: sorted.length,
        itemListElement: sorted.slice(0, 50).map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Person",
            name: c.name ?? c.username,
            ...(c.profileUrl ? { url: c.profileUrl } : {}),
            ...(c.avatarUrl ? { image: c.avatarUrl } : {}),
          },
        })),
      },
      breadcrumbs(siteUrl, [
        { path: "", name: "Home" },
        { path: "contributors/", name: "Contributors" },
      ]),
    ],
  };
  return {
    contributors: sorted,
    total: sorted.length,
    title,
    description,
    seo,
    contributorsGraphHref: repo ? `${repo}/graphs/contributors` : null,
    // Surface the consumer's per-user contribution-count preference to
    // the consumer page so it can render quieter cards when the
    // directory does not curate contributor activity.
    showContributionCount: site.contributors?.showContributionCount ?? true,
  };
}

export function getSubmissionPageModel(site: DirectorySiteConfig) {
  const singular = site.blueprintConfig?.labelSingular ?? itemLabel();
  const enabled = new Set(enabledFacetDefs(site).map((def) => def.dimension));
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

  const title = seoTitle(`Submit ${singular}`, site.name);
  const description = seoDescription(
    undefined,
    `Submit a new ${singular} to ${site.name}. Every listing is a file in a public repository — open a pull request and it ships everywhere at once.`,
  );
  return {
    singular,
    title,
    description,
    // Thin form wrapper — kept out of the index, so no OG/JSON-LD.
    seo: { title, description, noindex: true } satisfies PageSeo,
    repoUrl: site.repoUrl ?? "https://github.com/tortuvshin/grove",
    copy: site.submission ?? {},
    fields: {
      category: enabled.has("categories"),
      stack: enabled.has("stacks"),
      platforms: enabled.has("platforms"),
      tags: enabled.has("tags"),
      // The submit form mirrors the browse dimensions: a directory
      // that filters by license also collects it at submission time.
      license: enabled.has("licenses"),
    },
    categories,
    stacks,
    existingSlugs: fullProjects.map((record) => record.slug).filter(Boolean),
    existingFullNames,
    platformOptions: site.taxonomy?.platforms?.map(({ id, name }) => ({ id, label: name })) ??
      ["ios", "android", "web", "macos", "windows", "linux"].map((id) => ({ id, label: taxonomyLabel("platforms", id) })),
    licenseOptions: site.taxonomy?.licenses?.map(({ id, name }) => ({ id, label: name })) ?? [],
    // Ids for client-side validation — without this the submit form's
    // taxonomy checks silently no-op.
    taxonomy: {
      categoryIds: categories.map((option) => option.id),
      stackIds: stacks.map((option) => option.id),
      platformIds: (site.taxonomy?.platforms ?? []).map(({ id }) => id),
    },
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
  const singular = site.blueprintConfig?.labelSingular ?? itemLabel();
  const categoryLabel = record.category ? taxonomyLabel("categories", record.category) : undefined;
  // Fallback sentence when neither a curated summary nor a GitHub
  // description is available. The noun follows the schema.org @type
  // implied by `record.kind` so entities don't read as "open-source
  // Database project" and resources use their subtype (article, book,
  // etc.). Curated summary wins over `record.description` because the
  // latter is usually GitHub-synced and noisy.
  const fallbackSentence = recordFallbackSentence({
    name,
    kind: record.kind,
    entityType: entity?.type,
    resourceType: record.type,
    categoryLabel,
    singular,
    siteName: site.name,
  });
  const description = seoDescription(
    (record.summary && record.summary.trim()) || record.description,
    fallbackSentence,
  );
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
  // Pre-formatted date fields for the record sidebar — computed once
  // here so the template never does its own `new Date(...)` business
  // logic (only the raw ISO string for a `<time datetime>` attribute
  // is still read directly off the record in the template).
  const firstCommitYear = github?.created_at
    ? new Date(String(github.created_at)).getUTCFullYear()
    : null;
  const lastFetchedLabel = github?.updated_at
    ? new Date(String(github.updated_at)).toLocaleDateString()
    : null;
  const reviewedAtLabel = record.curation?.reviewedAt
    ? new Date(String(record.curation.reviewedAt)).toLocaleDateString()
    : null;
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

  const siteUrl = siteUrlOf(site);
  const pageUrl = absoluteUrl(siteUrl, `${routeSlug}/${recordSlug}/`);

  let recordLd: Record<string, unknown>;
  if (isProject && proj) {
    const sameAs = [repoUrl, homepageUrl].filter(Boolean);
    const dateCreated = record.curation?.reviewedAt;
    recordLd = {
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      "@id": `${pageUrl}#record`,
      name,
      headline: name,
      description,
      url: pageUrl,
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
    recordLd = {
      "@context": "https://schema.org",
      "@type": schemaTypes[record.type] ?? "CreativeWork",
      "@id": `${pageUrl}#record`,
      name,
      headline: name,
      description,
      url: pageUrl,
      ...(homepageUrl ? { sameAs: [homepageUrl] } : {}),
      author: record.author ? { "@type": "Person", name: record.author } : undefined,
      datePublished: record.publishedAt || undefined,
      keywords: record.tags?.length ? record.tags.join(", ") : undefined,
      isAccessibleForFree: true,
    };
  } else {
    recordLd = {
      "@context": "https://schema.org",
      "@type": entity?.type === "person" ? "Person" : "Organization",
      "@id": `${pageUrl}#record`,
      name,
      headline: name,
      description,
      url: pageUrl,
      ...(homepageUrl ? { sameAs: [homepageUrl] } : {}),
      foundingDate: entity?.founded || undefined,
      location: entity?.location || undefined,
      keywords: entity?.tags?.length ? entity.tags.join(", ") : undefined,
    };
  }

  // "<Name> — <descriptor> | <Site>": the descriptor gives the search
  // snippet a reason to exist beyond the bare project name.
  const descriptor = recordSeoDescriptor({
    summary: record.summary,
    ...(categoryLabel ? { categoryLabel } : {}),
    singular,
  });
  const title = seoTitle(`${name} — ${descriptor}`, site.name);
  const pluralTitle = titleCaseFirst(site.blueprintConfig?.labelPlural ?? itemLabelPlural());
  const jsonLd = [
    recordLd,
    breadcrumbs(siteUrl, [
      { path: "", name: "Home" },
      { path: `${routeSlug}/`, name: pluralTitle },
      { path: `${routeSlug}/${recordSlug}/`, name },
    ]),
  ];
  const seo: PageSeo = {
    title,
    description,
    image: ogPath("record", recordSlug),
    imageAlt: `${name} — ${site.name}`,
    jsonLd,
  };

  return {
    slug: routeSlug,
    record,
    project: proj,
    entity,
    isProject,
    name,
    title,
    description,
    seo,
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
    firstCommitYear,
    lastFetchedLabel,
    reviewedAtLabel,
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
    // Depth 3 so subsections surface in the TOC, indented under
    // their h2 parents.
    toc: tocBody ? extractToc(tocBody.body, { maxDepth: 3 }) : [],
    readingMetrics: tocBody ? readingMetrics(tocBody.body) : { wordCount: 0, minutes: 1 },
    jsonLd,
  };
}

/**
 * Fallback meta description when neither a curated summary nor a
 * GitHub description is available. Noun follows the schema.org
 * @type implied by `kind` so an entity never reads as
 * "an open-source Database project".
 */
function recordFallbackSentence(input: {
  name: string;
  kind: "project" | "resource" | "entity";
  entityType?: string;
  resourceType?: string;
  categoryLabel?: string;
  singular: string;
  siteName: string;
}): string {
  const category = input.categoryLabel;
  const listed = `listed on ${input.siteName}.`;
  if (input.kind === "entity") {
    if (input.entityType === "person") {
      return `${input.name}${category ? `, a ${category.toLowerCase()} contributor` : ""} ${listed}`;
    }
    return `${input.name}, an open-source ${category ? `${category} ` : ""}organization ${listed}`;
  }
  if (input.kind === "resource") {
    const type = input.resourceType ?? "resource";
    return `${input.name}, a ${type}${category ? ` in ${category}` : ""} ${listed}`;
  }
  return `${input.name}, an open-source ${category ? `${category} ` : ""}${input.singular} ${listed}`;
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

// ── Taxonomy page models ──────────────────────────────────────────

export type TaxonomyPageKind = "categories" | "stacks" | "licenses";

const TAXONOMY_EYEBROW: Record<TaxonomyPageKind, string> = {
  categories: "Category",
  stacks: "Stack",
  licenses: "License",
};

/**
 * View-model for a taxonomy detail page (`/categories/<id>/`,
 * `/stacks/<id>/`, `/licenses/<id>/`). Owns the record filtering the
 * three pages used to inline, plus the full SEO block. The three
 * title patterns are deliberately distinct so `/categories/python/`
 * and `/stacks/python/` never emit duplicate titles:
 *
 *   category: "Python projects on Open Apps"
 *   stack:    "Projects built with Python on Open Apps"
 *   license:  "MIT-licensed projects on Open Apps"
 */
export function getTaxonomyPageModel(
  kind: TaxonomyPageKind,
  id: string,
  displayName: string,
  site: DirectorySiteConfig,
) {
  const plural = site.blueprintConfig?.labelPlural ?? itemLabelPlural();
  const filters: IndexFilters =
    kind === "categories"
      ? { categories: [id] }
      : kind === "stacks"
        ? { stacks: [id] }
        : { licenses: [id] };
  const records = filterRecords(items, filters);
  const count = records.length;
  const siteUrl = siteUrlOf(site);
  const routeSlug = site.blueprintConfig?.routeSlug ?? "projects";
  const pagePath = `${kind}/${id}/`;

  // "MIT License" → "MIT" so the license title reads "MIT-licensed
  // projects", not "MIT License-licensed projects". The description
  // uses the same stripped form ("under the MIT license") so a single
  // displayName yields a consistent title and description — Google
  // flags title/description fragments that disagree on whether the
  // word "License" appears as low quality.
  const licenseLabel = displayName.replace(/\s+license$/i, "");
  const main =
    kind === "categories"
      ? `${displayName} ${plural} on ${site.name}`
      : kind === "stacks"
        ? `${titleCaseFirst(plural)} built with ${displayName} on ${site.name}`
        : `${licenseLabel}-licensed ${plural} on ${site.name}`;
  const description = seoDescription(
    undefined,
    kind === "categories"
      ? `${count} curated open-source ${plural} in the ${displayName} category on ${site.name}. Compare stars, activity, and licenses.`
      : kind === "stacks"
        ? `${count} curated open-source ${plural} built with ${displayName}, listed on ${site.name} with stars, activity, and license data.`
        : `${count} open-source ${plural} under the ${licenseLabel} license on ${site.name}.`,
  );

  const crumbs: Array<{ path: string; name: string }> = [
    { path: "", name: "Home" },
    // Licenses have no index page in the scaffold, so their trail
    // goes straight from Home to the license itself.
    ...(kind === "licenses"
      ? []
      : [{ path: `${kind}/`, name: titleCaseFirst(kind) }]),
    { path: pagePath, name: displayName },
  ];
  const listItems = records.slice(0, 50).map((record) => {
    const r = record as { slug: string; name?: string; title?: string; description?: string };
    return {
      url: absoluteUrl(siteUrl, `${routeSlug}/${r.slug}/`),
      name: r.name ?? r.title ?? r.slug,
      ...(r.description ? { description: r.description } : {}),
    };
  });
  const seo: PageSeo = {
    // `main` already names the site, so seoTitle appends nothing —
    // it still runs for the length/whitespace normalization.
    title: seoTitle(main, site.name),
    description,
    image: ogPath(
      kind === "categories" ? "category" : kind === "stacks" ? "stack" : "license",
      id,
    ),
    imageAlt: `${displayName} — ${site.name}`,
    jsonLd: [
      ...collectionSchema({
        url: absoluteUrl(siteUrl, pagePath),
        name: main,
        description,
        items: listItems,
        crumbs: crumbs.map((c) => ({
          url: absoluteUrl(siteUrl, c.path),
          name: c.name,
        })),
      }),
    ],
  };

  return {
    kind,
    id,
    displayName,
    eyebrow: TAXONOMY_EYEBROW[kind],
    records,
    count,
    seo,
  };
}

/**
 * SEO block for the `/categories/` and `/stacks/` index pages.
 */
export function getTaxonomyIndexSeo(
  kind: "categories" | "stacks",
  site: DirectorySiteConfig,
): PageSeo {
  const plural = site.blueprintConfig?.labelPlural ?? itemLabelPlural();
  const { categories, stacks } = countTaxonomies();
  const entries = kind === "categories" ? categories : stacks;
  const sample = entries.slice(0, 3).map((entry) => entry.name).join(", ");
  const siteUrl = siteUrlOf(site);
  const title = seoTitle(kind === "categories" ? "Categories" : "Stacks", site.name);
  const description = seoDescription(
    undefined,
    kind === "categories"
      ? `Browse all ${entries.length} categories of ${plural} on ${site.name}${sample ? ` — from ${sample} and more` : ""}.`
      : `Browse ${plural} on ${site.name} by technology stack — ${entries.length} stacks${sample ? ` including ${sample}` : ""}.`,
  );
  return {
    title,
    description,
    image: ogPath("default"),
    jsonLd: [
      ...collectionSchema({
        url: absoluteUrl(siteUrl, `${kind}/`),
        name: title,
        description,
        items: entries.map((entry) => ({
          url: absoluteUrl(siteUrl, `${kind}/${entry.slug}/`),
          name: entry.name,
        })),
        crumbs: [
          { url: `${siteUrl}/`, name: "Home" },
          { url: absoluteUrl(siteUrl, `${kind}/`), name: titleCaseFirst(kind) },
        ],
      }),
    ],
  };
}

/**
 * SEO block for the static About page.
 */
export function getAboutPageSeo(site: DirectorySiteConfig): PageSeo {
  const siteUrl = siteUrlOf(site);
  const title = seoTitle("About", site.name);
  const description = seoDescription(
    undefined,
    `About ${site.name}: ${site.tagline ?? site.description ?? "a file-first knowledge site."}`,
  );
  return {
    title,
    description,
    image: ogPath("default"),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": ["AboutPage", "WebPage"],
        "@id": `${absoluteUrl(siteUrl, "about/")}#page`,
        url: absoluteUrl(siteUrl, "about/"),
        name: title,
        description,
      },
      breadcrumbs(siteUrl, [
        { path: "", name: "Home" },
        { path: "about/", name: "About" },
      ]),
    ],
  };
}

// ── ProjectCard view-model ──────────────────────────────────────────

/**
 * The raw shapes `ProjectCard` has historically been asked to render:
 * a slim index record (browse/home lists), a full `Resource` (a
 * project or resource sidecar), a full `ProjectRecord`, or the
 * index-projected `IndexProjectRecord`. `buildProjectCardModel`
 * absorbs all four so the component itself never branches on `kind`.
 */
export type CardRecord = IndexRecord | Resource | ProjectRecord | IndexProjectRecord;

export interface ProjectCardModel {
  name: string;
  slug?: string;
  description: string;
  initials: string;
  avatarUrl?: string;
  repoHref?: string;
  owner?: string;
  repo?: string;
  /** True when repoHref+owner+repo all resolved — the card renders
   *  as an `<article>` with a stretched title link. */
  isArticle: boolean;
  stars?: number;
  starsLabel: string | null;
  hasStars: boolean;
  pushedAt?: string | null;
  updatedLabel: string | null;
  hasUpdated: boolean;
  stackIds: string[];
  /** First 4 stack ids — what the card footer actually renders. */
  visibleStacks: string[];
  /** `stackIds.length - visibleStacks.length`. */
  stackOverflow: number;
  hasStacks: boolean;
}

/** Explicit overrides for record-derived `ProjectCardModel` fields.
 *  Adapters that only have a lightweight shape (e.g. `CollectionEntry`)
 *  pass these instead of a `record`; explicit values always win over
 *  whatever the record would have derived. */
export interface ProjectCardModelOverrides {
  logoUrl?: string;
  description?: string;
  name?: string;
  slug?: string;
  repoUrl?: string;
  stars?: number;
  pushedAt?: string | null;
  stack?: string;
}

/**
 * Build the presentation-ready model for `ProjectCard` — every
 * branch/cast/format call that used to live in the component's
 * frontmatter, extracted verbatim. Registry UI reads `model.*` and
 * does no derivation of its own (see `v1-architecture.md` §7-14).
 */
export function buildProjectCardModel(
  record?: CardRecord,
  overrides: ProjectCardModelOverrides = {},
): ProjectCardModel {
  const {
    logoUrl: logoUrlProp,
    description: descriptionProp,
    name: nameProp,
    slug: slugProp,
    repoUrl: repoUrlProp,
    stars: starsProp,
    pushedAt: pushedAtProp,
    stack: stackProp,
  } = overrides;

  const isProject = record?.kind === "project";
  const name =
    nameProp ??
    (record
      ? record.kind === "resource"
        ? (record as { title: string }).title
        : (record as { name: string }).name
      : "");
  const slug = slugProp ?? (record as { slug?: string } | undefined)?.slug;
  const repoHref =
    repoUrlProp ??
    (isProject
      ? (record as { repoUrl?: string }).repoUrl
      : (record as { links?: { github?: string } } | undefined)?.links?.github);

  const { owner, repo } = getOwnerAndRepoFromRepoUrl(repoHref ?? "");
  const avatarUrl =
    logoUrlProp ??
    (isProject ? (record as { logoUrl?: string }).logoUrl : undefined) ??
    getOwnerAvatarUrl(owner, 80) ??
    undefined;

  const initials = nameInitials(name);

  // Trimmed on a word boundary before the two-line clamp gets to it: a
  // CSS clamp cuts at whatever character the box runs out of room on,
  // which is what produced "…and multi-", "…and retrieval", "…an" across
  // a grid.
  const description = truncateWords(
    descriptionProp ?? (record as { description?: string } | undefined)?.description ?? "",
  );

  const stars =
    starsProp ?? (isProject ? (record as { github?: { stars?: number } }).github?.stars : undefined);
  const pushedAt =
    pushedAtProp ??
    (isProject
      ? (record as { github?: { pushedAt?: string | null } }).github?.pushedAt
      : (record as { publishedAt?: string | null } | undefined)?.publishedAt);
  const stackIds = stackProp
    ? [stackProp]
    : isProject
      ? projectStackIds(record as { stack?: string; stacks?: string[] })
      : [];

  const starsLabel = formatStars(stars);
  const updatedLabel = formatRelative(pushedAt);

  const hasStars = starsLabel !== null && typeof stars === "number" && stars > 0;
  const hasUpdated = Boolean(pushedAt);

  // `<a>`-in-`<a>` is invalid HTML, and the `owner/repo` line is its own
  // link to the repository — so any card that shows one renders as an
  // `<article>` whose title link is stretched over the whole card.
  const isArticle = Boolean(repoHref && owner && repo);

  const visibleStacks = stackIds.slice(0, 4);
  const stackOverflow = stackIds.length - visibleStacks.length;
  const hasStacks = visibleStacks.length > 0;

  return {
    name,
    slug,
    description,
    initials,
    avatarUrl,
    repoHref,
    owner: owner ?? undefined,
    repo: repo ?? undefined,
    isArticle,
    stars,
    starsLabel,
    hasStars,
    pushedAt,
    updatedLabel,
    hasUpdated,
    stackIds,
    visibleStacks,
    stackOverflow,
    hasStacks,
  };
}

export type DirectoryIndexModel = ReturnType<typeof getDirectoryIndexModel>;
export type DirectoryHomeModel = ReturnType<typeof getHomePageModel>;
export type SubmissionPageModel = ReturnType<typeof getSubmissionPageModel>;
export type ContributorsPageModel = ReturnType<typeof getContributorsPageModel>;
export type RecordDetailModel = NonNullable<ReturnType<typeof getRecordDetailModel>>;
export type TaxonomyPageModel = ReturnType<typeof getTaxonomyPageModel>;
export type { IndexFilters };
