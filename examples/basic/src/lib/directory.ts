import {
  decisionsFileSchema,
  healthFileSchema,
  itemsFileSchema,
  unwrapDecisions,
  unwrapHealth,
  unwrapItems,
  type HealthStatus,
} from "@open-curated/core";
import {
  buildDirectoryRecords,
  categoryCounts,
  facetValues,
  filterRecords,
  slugForCategory,
  sortRecords,
  paginateRecords,
  totalPages,
  visibleRecords,
  type DirectoryFilters,
} from "@open-curated/astro";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

export function readDirectory() {
  const items = unwrapItems(itemsFileSchema.parse(parse(readFileSync("data/items.yml", "utf8"))));
  const health = unwrapHealth(healthFileSchema.parse(parse(readFileSync("data/health.yml", "utf8"))));
  const decisions = unwrapDecisions(decisionsFileSchema.parse(parse(readFileSync("data/decisions.yml", "utf8"))));
  const records = visibleRecords(buildDirectoryRecords(items, health, decisions));
  return {
    items,
    health,
    decisions,
    records,
    categories: categoryCounts(records),
    tags: facetValues(records, "tag"),
    languages: facetValues(records, "language"),
    licenses: facetValues(records, "license"),
  };
}

export function filtersFromUrl(url: URL): DirectoryFilters {
  const params = url.searchParams;
  const health = params.get("health") || "all";
  const page = Number(params.get("page"));
  const sort = params.get("sort") || undefined;
  const density = params.get("density") === "compact" ? "compact" : "comfortable";
  return {
    q: params.get("q") || undefined,
    category: params.get("category") || undefined,
    tag: params.get("tag") || undefined,
    language: params.get("language") || undefined,
    license: params.get("license") || undefined,
    health: health as HealthStatus | "all",
    label: params.get("label") || undefined,
    lens: params.get("lens") || undefined,
    sort: sort as DirectoryFilters["sort"],
    density,
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    maintained: params.get("maintained") === "1",
    hideArchived: params.get("hideArchived") === "1",
    hasRecentRelease: params.get("hasRecentRelease") === "1",
  };
}

export function filteredRecords(url: URL) {
  const directory = readDirectory();
  const filters = filtersFromUrl(url);
  const sorted = sortRecords(filterRecords(directory.records, filters), filters.sort ?? "recently-updated");
  const pages = totalPages(sorted.length);
  const page = Math.min(filters.page ?? 1, pages);
  return {
    ...directory,
    filters: { ...filters, page },
    results: sorted,
    pageResults: paginateRecords(sorted, page),
    pages,
  };
}

export function categoryBySlug(slug: string) {
  const directory = readDirectory();
  const category = directory.categories.find((entry) => slugForCategory(entry.name) === slug);
  if (!category) return undefined;
  return {
    ...directory,
    category,
    results: sortRecords(directory.records.filter((record) => record.item.taxonomy.category === category.name)),
  };
}
