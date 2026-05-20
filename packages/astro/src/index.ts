import type { CuratedItem, HealthEntry } from "@open-curated/core";

export interface DirectoryStats {
  total: number;
  active: number;
  mature: number;
  needsReview: number;
  archived: number;
}

export function buildDirectoryStats(items: CuratedItem[], health: HealthEntry[] = []): DirectoryStats {
  const byId = new Map(health.map((entry) => [entry.id, entry]));
  return {
    total: items.length,
    active: items.filter((item) => byId.get(item.id)?.health.status === "active").length,
    mature: items.filter((item) => byId.get(item.id)?.health.status === "mature").length,
    needsReview: items.filter((item) => byId.get(item.id)?.health.status === "needs_review").length,
    archived: items.filter((item) => byId.get(item.id)?.health.status === "archived").length,
  };
}

export function healthForItem(item: CuratedItem, health: HealthEntry[] = []): HealthEntry | undefined {
  return health.find((entry) => entry.id === item.id);
}
