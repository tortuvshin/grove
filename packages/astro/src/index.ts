import type { CuratedItem, Decision, HealthEntry, HealthStatus } from "@open-curated/core";

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
  maintained?: boolean;
  hideArchived?: boolean;
  hasRecentRelease?: boolean;
}

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
    if (filters.maintained && !["active", "mature"].includes(status)) return false;
    if (filters.hideArchived && status === "archived") return false;
    if (filters.hasRecentRelease && !health?.github?.latestReleaseAt) return false;
    return true;
  });
}

export function sortRecords(records: DirectoryRecord[]): DirectoryRecord[] {
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
    const aStatus = rank[a.health?.health.status ?? "unknown"] ?? 99;
    const bStatus = rank[b.health?.health.status ?? "unknown"] ?? 99;
    if (aStatus !== bStatus) return aStatus - bStatus;
    return (b.health?.github?.stars ?? 0) - (a.health?.github?.stars ?? 0);
  });
}

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
