/**
 * Filter / sort / pagination helpers for the apps list page.
 *
 * This file is a thin proxy over `@grove-dev/ui` and `@grove-dev/core`
 * — the actual business logic lives there. The proxy keeps the
 * `OpenSourceApp` shape (defined in `data/types.ts`) compatible
 * with the core `AppRecord` shape.
 */
import type { OpenSourceApp } from "../data/types";

export const PAGE_SIZE = 20;

export const SORT_OPTIONS = [
  { value: "recently-updated", label: "Recently updated" },
  { value: "most-starred", label: "Most starred" },
  { value: "recently-added", label: "Recently added" },
  { value: "most-mature", label: "Most mature" },
  { value: "alphabetical", label: "Alphabetical" },
] as const;

export type AppsSort = (typeof SORT_OPTIONS)[number]["value"];

export type AppsFilters = {
  q?: string;
  stacks?: string[];
  platforms?: string[];
  categories?: string[];
  labels?: string[];
  licenses?: string[];
  statuses?: string[];
  lens?: string;
  sort?: AppsSort;
  page?: number;
  density?: "comfortable" | "compact";
};

const KEYS = {
  q: "q",
  stacks: "stack",
  platforms: "platform",
  categories: "category",
  labels: "label",
  licenses: "license",
  statuses: "status",
  lens: "lens",
  sort: "sort",
  page: "page",
  density: "density",
} as const;

const DEFAULT_SORT: AppsSort = "recently-updated";
const DEFAULT_PAGE = 1;

export function filtersFromSearchParams(sp: URLSearchParams): AppsFilters {
  const rawSort = sp.get(KEYS.sort);
  const sort: AppsSort | undefined =
    rawSort && SORT_OPTIONS.some((o) => o.value === rawSort) ? (rawSort as AppsSort) : undefined;
  const rawPage = Number(sp.get(KEYS.page));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : undefined;
  const rawDensity = sp.get(KEYS.density);
  const density = rawDensity === "compact" || rawDensity === "comfortable" ? rawDensity : undefined;
  return {
    q: sp.get(KEYS.q) ?? undefined,
    stacks: sp.getAll(KEYS.stacks).filter(Boolean),
    platforms: sp.getAll(KEYS.platforms).filter(Boolean),
    categories: sp.getAll(KEYS.categories).filter(Boolean),
    labels: sp.getAll(KEYS.labels).filter(Boolean),
    licenses: sp.getAll(KEYS.licenses).filter(Boolean),
    statuses: sp.getAll(KEYS.statuses).flatMap((s) => s.split(",")).filter(Boolean),
    lens: sp.get(KEYS.lens) ?? undefined,
    sort,
    page,
    density,
  };
}

export function searchParamsFromFilters(f: AppsFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q) sp.set(KEYS.q, f.q);
  for (const v of f.stacks ?? []) sp.append(KEYS.stacks, v);
  for (const v of f.platforms ?? []) sp.append(KEYS.platforms, v);
  for (const v of f.categories ?? []) sp.append(KEYS.categories, v);
  for (const v of f.labels ?? []) sp.append(KEYS.labels, v);
  for (const v of f.licenses ?? []) sp.append(KEYS.licenses, v);
  if (f.statuses?.length) sp.set(KEYS.statuses, f.statuses.join(","));
  if (f.lens) sp.set(KEYS.lens, f.lens);
  if (f.sort && f.sort !== DEFAULT_SORT) sp.set(KEYS.sort, f.sort);
  if (f.page && f.page !== DEFAULT_PAGE) sp.set(KEYS.page, String(f.page));
  if (f.density && f.density !== "comfortable") sp.set(KEYS.density, f.density);
  return sp;
}

export function hasAnyFilter(f: AppsFilters): boolean {
  if (f.q && f.q.trim()) return true;
  if (f.lens) return true;
  return Boolean(
    (f.stacks?.length ?? 0) +
      (f.platforms?.length ?? 0) +
      (f.categories?.length ?? 0) +
      (f.labels?.length ?? 0) +
      (f.licenses?.length ?? 0) +
      (f.statuses?.length ?? 0),
  );
}

export function applySort(apps: OpenSourceApp[], sort: AppsSort): OpenSourceApp[] {
  const arr = apps.slice();
  const ts = (s?: string | null): number => (s ? new Date(s).valueOf() : 0);
  switch (sort) {
    case "most-starred":
      arr.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
      break;
    case "recently-updated":
      arr.sort((a, b) => ts(b.lastCommitAt) - ts(a.lastCommitAt));
      break;
    case "recently-added":
      arr.sort((a, b) => ts(b.addedAt) - ts(a.addedAt));
      break;
    case "most-mature":
      arr.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
      break;
    case "alphabetical":
      arr.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }
  return arr;
}

export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function totalPages(itemCount: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(itemCount / pageSize));
}

export function effectiveSort(f: AppsFilters): AppsSort {
  return f.sort ?? DEFAULT_SORT;
}
export function effectivePage(f: AppsFilters): number {
  return f.page ?? DEFAULT_PAGE;
}
export function effectiveDensity(f: AppsFilters): "comfortable" | "compact" {
  return f.density ?? "comfortable";
}

export function filterApps(apps: OpenSourceApp[], f: AppsFilters): OpenSourceApp[] {
  const q = f.q?.trim().toLowerCase();
  const stacks = f.stacks?.length ? new Set(f.stacks) : null;
  const platforms = f.platforms?.length ? new Set(f.platforms) : null;
  const categories = f.categories?.length ? new Set(f.categories) : null;
  const labels = f.labels?.length ? new Set(f.labels) : null;
  const licenses = f.licenses?.length ? new Set(f.licenses) : null;
  const statuses = f.statuses?.length ? new Set(f.statuses) : null;

  return apps.filter((a) => {
    if (q) {
      const ownerMatch = /github\.com\/([^/]+)\//.exec(a.repoUrl)?.[1]?.toLowerCase() ?? "";
      const haystack = [a.name, ownerMatch, a.description, a.category].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (stacks) {
      const allStacks = [a.stack, ...(a.stacks ?? [])];
      if (!allStacks.some((s) => stacks.has(s))) return false;
    }
    if (platforms) {
      if (!a.platforms.some((p) => platforms.has(p))) return false;
    }
    if (categories) {
      if (!categories.has(a.category)) return false;
    }
    if (labels) {
      if (!a.labels?.some((l) => labels.has(l))) return false;
    }
    if (licenses) {
      if (!a.license || !licenses.has(a.license)) return false;
    }
    if (statuses) {
      if (!a.status || !statuses.has(a.status)) return false;
    }
    if (f.lens) {
      if (!a.lenses?.includes(f.lens)) return false;
    }
    return true;
  });
}

export function activeFilterChips(
  f: AppsFilters,
): { key: keyof AppsFilters; value: string; label: string }[] {
  const out: { key: keyof AppsFilters; value: string; label: string }[] = [];
  if (f.q && f.q.trim()) out.push({ key: "q", value: "", label: `“${f.q}”` });
  for (const v of f.stacks ?? []) out.push({ key: "stacks", value: v, label: `stack: ${v}` });
  for (const v of f.platforms ?? []) out.push({ key: "platforms", value: v, label: `platform: ${v}` });
  for (const v of f.categories ?? []) out.push({ key: "categories", value: v, label: `category: ${v}` });
  for (const v of f.labels ?? []) out.push({ key: "labels", value: v, label: v });
  for (const v of f.licenses ?? []) out.push({ key: "licenses", value: v, label: `license: ${v}` });
  if (f.lens) out.push({ key: "lens", value: f.lens, label: `lens: ${f.lens}` });
  return out;
}

export function buildFacets(apps: OpenSourceApp[]) {
  const counts = {
    stack: new Map<string, number>(),
    platform: new Map<string, number>(),
    category: new Map<string, number>(),
    label: new Map<string, number>(),
    license: new Map<string, number>(),
  };
  for (const a of apps) {
    const allStacks = new Set([a.stack, ...(a.stacks ?? [])]);
    for (const s of allStacks) counts.stack.set(s, (counts.stack.get(s) ?? 0) + 1);
    for (const p of a.platforms) counts.platform.set(p, (counts.platform.get(p) ?? 0) + 1);
    counts.category.set(a.category, (counts.category.get(a.category) ?? 0) + 1);
    for (const l of a.labels ?? []) counts.label.set(l, (counts.label.get(l) ?? 0) + 1);
    if (a.license) counts.license.set(a.license, (counts.license.get(a.license) ?? 0) + 1);
  }
  const sortByCountThenName = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value, count]) => ({ value, count }));
  return {
    stacks: sortByCountThenName(counts.stack),
    platforms: sortByCountThenName(counts.platform),
    categories: sortByCountThenName(counts.category),
    labels: sortByCountThenName(counts.label),
    licenses: sortByCountThenName(counts.license),
  };
}
