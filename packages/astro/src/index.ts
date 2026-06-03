import type { AppLabel, CuratedItem, Decision, HealthEntry, HealthStatus, Score as CuratedScores } from "@open-curated/core";

export interface DirectoryStats {
  total: number;
  active: number;
  mature: number;
  needsReview: number;
  archived: number;
  stale: number;
  inactive: number;
  unknown: number;
}

export function buildDirectoryStats(items: CuratedItem[], health: HealthEntry[] = []): DirectoryStats {
  const byId = new Map(health.map((entry) => [entry.id, entry]));
  const count = (status: HealthStatus) => items.filter((item) => byId.get(item.id)?.health.status === status).length;
  return {
    total: items.length,
    active: count("active"),
    mature: count("mature"),
    needsReview: count("needs_review"),
    archived: count("archived"),
    stale: count("stale"),
    inactive: count("inactive"),
    unknown: count("unknown"),
  };
}

export function healthForItem(item: CuratedItem, health: HealthEntry[] = []): HealthEntry | undefined {
  return health.find((entry) => entry.id === item.id);
}

export function decisionForItem(item: CuratedItem, decisions: Decision[] = []): Decision | undefined {
  return decisions.find((decision) => decision.id === item.id);
}

export interface DirectoryRecord {
  item: CuratedItem;
  health?: HealthEntry;
  decision?: Decision;
}

export interface DirectoryFilters {
  q?: string;
  category?: string;
  tag?: string;
  language?: string;
  license?: string;
  health?: HealthStatus | "all";
  label?: string;
  lens?: string;
  sort?: DirectorySort;
  density?: "comfortable" | "compact";
  page?: number;
  maintained?: boolean;
  hideArchived?: boolean;
  hasRecentRelease?: boolean;
}

export const SORT_OPTIONS = [
  { value: "recently-updated", label: "Recently updated" },
  { value: "most-starred", label: "Most starred" },
  { value: "most-mature", label: "Most mature" },
  { value: "best-learning", label: "Best learning" },
  { value: "contribution-ready", label: "Contribution ready" },
  { value: "alphabetical", label: "Alphabetical" },
] as const;

export type DirectorySort = (typeof SORT_OPTIONS)[number]["value"];

export const PAGE_SIZE = 12;

export const LENSES = [
  { id: "all", label: "All", description: "Every visible project", params: {} },
  { id: "new", label: "New", description: "Recently added or emerging projects", params: { label: "new" } },
  { id: "hot", label: "Hot", description: "Projects with strong recent attention", params: { label: "hot" } },
  { id: "mature", label: "Mature", description: "Established and useful projects", params: { health: "mature" } },
  { id: "good-to-learn", label: "Good to learn", description: "Readable references with learning value", params: { lens: "good-to-learn" } },
  { id: "contribution-ready", label: "Contribution ready", description: "Projects with contribution signals", params: { lens: "contribution-ready" } },
] as const;

export function buildDirectoryRecords(
  items: CuratedItem[],
  health: HealthEntry[] = [],
  decisions: Decision[] = [],
): DirectoryRecord[] {
  return items.map((item) => ({
    item,
    health: healthForItem(item, health),
    decision: decisionForItem(item, decisions),
  }));
}

export function visibleRecords(records: DirectoryRecord[]): DirectoryRecord[] {
  return records.filter((record) => {
    const visibility = record.decision?.decision.visibility;
    return visibility !== "hide" && visibility !== "remove";
  });
}

export function filterRecords(records: DirectoryRecord[], filters: DirectoryFilters): DirectoryRecord[] {
  const query = filters.q?.trim().toLowerCase();
  return records.filter((record) => {
    const { item, health } = record;
    const status = health?.health.status ?? "unknown";
    const searchable = [
      item.name,
      item.description,
      item.taxonomy.category,
      item.taxonomy.language,
      health?.github?.language,
      health?.github?.license,
      ...(item.taxonomy.tags ?? []),
      ...(health?.github?.topics ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (query && !searchable.includes(query)) return false;
    if (filters.category && item.taxonomy.category !== filters.category) return false;
    if (filters.tag && !item.taxonomy.tags.includes(filters.tag)) return false;
    if (filters.language && (item.taxonomy.language ?? health?.github?.language) !== filters.language) return false;
    if (filters.license && health?.github?.license !== filters.license) return false;
    if (filters.health && filters.health !== "all" && status !== filters.health) return false;
    if (filters.label && !(item.labels as string[]).includes(filters.label)) return false;
    if (filters.lens && !item.lenses.includes(filters.lens)) return false;
    if (filters.maintained && !["active", "mature"].includes(status)) return false;
    if (filters.hideArchived && status === "archived") return false;
    if (filters.hasRecentRelease && !health?.github?.latestReleaseAt) return false;
    return true;
  });
}

function updatedTime(record: DirectoryRecord): number {
  const value = record.health?.github?.pushedAt ?? record.health?.github?.updatedAt;
  return value ? new Date(value).valueOf() || 0 : 0;
}

function scoreValue(record: DirectoryRecord, key: keyof CuratedScores): number {
  return record.item.curation.scores?.[key] ?? 0;
}

export function sortRecords(records: DirectoryRecord[], sort: DirectorySort = "recently-updated"): DirectoryRecord[] {
  const rank: Record<string, number> = {
    mature: 0,
    active: 1,
    stale: 2,
    needs_review: 3,
    unknown: 4,
    inactive: 5,
    archived: 6,
    historical: 7,
  };
  return [...records].sort((a, b) => {
    const aHighlight = a.decision?.decision.visibility === "highlight" ? -1 : 0;
    const bHighlight = b.decision?.decision.visibility === "highlight" ? -1 : 0;
    if (aHighlight !== bHighlight) return aHighlight - bHighlight;
    if (sort === "most-starred") return (b.health?.github?.stars ?? 0) - (a.health?.github?.stars ?? 0);
    if (sort === "recently-updated") return updatedTime(b) - updatedTime(a);
    if (sort === "most-mature") return scoreValue(b, "maturity") - scoreValue(a, "maturity");
    if (sort === "best-learning") return scoreValue(b, "learning") - scoreValue(a, "learning");
    if (sort === "contribution-ready") return scoreValue(b, "contribution") - scoreValue(a, "contribution");
    if (sort === "alphabetical") return a.item.name.localeCompare(b.item.name);
    const aStatus = rank[a.health?.health.status ?? "unknown"] ?? 99;
    const bStatus = rank[b.health?.health.status ?? "unknown"] ?? 99;
    if (aStatus !== bStatus) return aStatus - bStatus;
    return (b.health?.github?.stars ?? 0) - (a.health?.github?.stars ?? 0);
  });
}

export function paginateRecords<T>(records: T[], page: number, pageSize = PAGE_SIZE): T[] {
  const safePage = Math.max(1, page);
  return records.slice((safePage - 1) * pageSize, safePage * pageSize);
}

export function totalPages(count: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(count / pageSize));
}

export function activeFilterChips(filters: DirectoryFilters): Array<{ key: keyof DirectoryFilters; label: string; value: string }> {
  const chips: Array<{ key: keyof DirectoryFilters; label: string; value: string }> = [];
  if (filters.q) chips.push({ key: "q", label: `search: ${filters.q}`, value: filters.q });
  if (filters.category) chips.push({ key: "category", label: `category: ${filters.category}`, value: filters.category });
  if (filters.tag) chips.push({ key: "tag", label: `tag: ${filters.tag}`, value: filters.tag });
  if (filters.language) chips.push({ key: "language", label: `language: ${filters.language}`, value: filters.language });
  if (filters.license) chips.push({ key: "license", label: `license: ${filters.license}`, value: filters.license });
  if (filters.health && filters.health !== "all") chips.push({ key: "health", label: `health: ${filters.health.replace(/_/g, " ")}`, value: filters.health });
  if (filters.label) chips.push({ key: "label", label: `label: ${filters.label}`, value: filters.label });
  if (filters.lens) chips.push({ key: "lens", label: `lens: ${filters.lens}`, value: filters.lens });
  if (filters.maintained) chips.push({ key: "maintained", label: "maintained only", value: "1" });
  if (filters.hideArchived) chips.push({ key: "hideArchived", label: "hide archived", value: "1" });
  if (filters.hasRecentRelease) chips.push({ key: "hasRecentRelease", label: "recent release", value: "1" });
  return chips;
}

export function scoreTier(value: number | undefined): 0 | 1 | 2 | 3 | 4 {
  if (typeof value !== "number") return 0;
  if (value < 20) return 0;
  if (value < 40) return 1;
  if (value < 60) return 2;
  if (value < 80) return 3;
  return 4;
}

export const SCORE_LABELS: Record<keyof CuratedScores, string> = {
  activity: "Activity",
  maturity: "Maturity",
  learning: "Learning",
  contribution: "Contribution",
  docs: "Docs",
  overall: "Overall",
};

export const SCORE_REASONING: Record<keyof CuratedScores, string> = {
  activity: "Recent commits, releases, and maintenance rhythm.",
  maturity: "Adoption, stability, clear license, and project history.",
  learning: "Readable structure, useful patterns, and educational value.",
  contribution: "Contribution docs, issue signals, and maintainer openness.",
  docs: "README, docs, examples, and onboarding quality.",
  overall: "Composite usefulness for a developer scanning the directory.",
};

export function categoryCounts(records: DirectoryRecord[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const record of records) {
    counts.set(record.item.taxonomy.category, (counts.get(record.item.taxonomy.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function facetValues(records: DirectoryRecord[], key: "tag" | "language" | "license"): string[] {
  const values = new Set<string>();
  for (const record of records) {
    if (key === "tag") record.item.taxonomy.tags.forEach((tag) => values.add(tag));
    if (key === "language") {
      const language = record.item.taxonomy.language ?? record.health?.github?.language;
      if (language) values.add(language);
    }
    if (key === "license" && record.health?.github?.license) values.add(record.health.github.license);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

export function slugForCategory(category: string): string {
  return category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
