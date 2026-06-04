import type { Score as CuratedScores } from "@grove-dev/core";
import { PAGE_SIZE } from "./constants.js";
import type { DirectoryFilters, DirectoryRecord, DirectorySort, FilterChip } from "./types.js";

/** Compute the directory stats for a list of records. */
export function buildDirectoryStats(records: DirectoryRecord[]): import("./types.js").DirectoryStats {
  const byId = new Map(records.map((r) => [r.item.id, r]));
  const count = (status: import("@grove-dev/core").HealthStatus) =>
    records.filter((r) => byId.get(r.item.id)?.health?.health.status === status).length;
  return {
    total: records.length,
    active: count("active"),
    mature: count("mature"),
    needsReview: count("needs_review"),
    archived: count("archived"),
    stale: count("stale"),
    inactive: count("inactive"),
    unknown: count("unknown"),
  };
}

/** Filter records according to the supplied filters. */
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
  const scores = (record.item.curation.scores ?? {}) as CuratedScores;
  return (scores[key] as number | undefined) ?? 0;
}

/** Sort records according to the supplied sort order. */
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

/** Slice records for a 1-based page. */
export function paginateRecords<T>(records: T[], page: number, pageSize = PAGE_SIZE): T[] {
  const safePage = Math.max(1, page);
  return records.slice((safePage - 1) * pageSize, safePage * pageSize);
}

/** Total pages for a count of records. Always >= 1. */
export function totalPages(count: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(count / pageSize));
}

/** Active filter chips for display + removal. */
export function activeFilterChips(filters: DirectoryFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.q) chips.push({ key: "q", label: `search: ${filters.q}`, value: filters.q });
  if (filters.category) chips.push({ key: "category", label: `category: ${filters.category}`, value: filters.category });
  if (filters.tag) chips.push({ key: "tag", label: `tag: ${filters.tag}`, value: filters.tag });
  if (filters.language) chips.push({ key: "language", label: `language: ${filters.language}`, value: filters.language });
  if (filters.license) chips.push({ key: "license", label: `license: ${filters.license}`, value: filters.license });
  if (filters.health && filters.health !== "all")
    chips.push({ key: "health", label: `health: ${filters.health.replace(/_/g, " ")}`, value: filters.health });
  if (filters.label) chips.push({ key: "label", label: `label: ${filters.label}`, value: filters.label });
  if (filters.lens) chips.push({ key: "lens", label: `lens: ${filters.lens}`, value: filters.lens });
  if (filters.maintained) chips.push({ key: "maintained", label: "maintained only", value: "1" });
  if (filters.hideArchived) chips.push({ key: "hideArchived", label: "hide archived", value: "1" });
  if (filters.hasRecentRelease) chips.push({ key: "hasRecentRelease", label: "recent release", value: "1" });
  return chips;
}
