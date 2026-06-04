import type { DirectoryRecord } from "./types.js";

/** Per-category counts, sorted by frequency desc, then alphabetical. */
export function categoryCounts(records: DirectoryRecord[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const record of records) {
    counts.set(record.item.taxonomy.category, (counts.get(record.item.taxonomy.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Distinct facet values for tag / language / license, alphabetical. */
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
