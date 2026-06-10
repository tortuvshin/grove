/**
 * URL-driven search/filter/sort state for the directory list page.
 *
 * Multi-value fields use repeated keys: `?stack=Flutter&stack=RN`.
 * Single-value fields (q, sort, page, lens) are scalar. Empty
 * / undefined fields mean "no filter on this dimension".
 *
 * The functions here are generic over a record-like shape that
 * carries the index payload (see `toIndexRecord` in
 * `@grove-dev/core`). The list page only needs `name`, `slug`,
 * `description`, `category`, `tags`, `stack`, `stacks`, `platforms`,
 * `repoUrl`, `logoUrl`, `health`, `curation`, and `github.{stars,
 * pushedAt}` — all of which are present in the index projection.
 */

import type {
  HealthStatus,
  ProjectRecord,
} from "@grove-dev/core";
import { labelDisplay, statusDisplay } from "./display";
import { applyLens, lensFromSearchParams, type LensId } from "./lenses";

// ── Types ─────────────────────────────────────────────────────────

/**
 * Subset of `ProjectRecord` the search lib actually reads. Defined
 * inline so the lib works on both full records and the lighter
 * index payload. Use `ProjectRecord` from core when you have it;
 * pass any object that satisfies `Searchable` otherwise.
 */
export interface Searchable {
  slug?: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  stack?: string;
  stacks?: string[];
  platforms?: string[];
  /** Canonical repo URL — used for owner extraction in text search. */
  repoUrl?: string;
  logoUrl?: string;
  /** Curated labels (new, hot, mature, featured). */
  curation?: { labels?: string[] };
  /** Health block — drives status filter + tier fallback. */
  health?: {
    status?: HealthStatus;
    tier?: "curated" | "listed" | "experimental" | "hidden";
    visibility?: "highlight" | "keep" | "needs_review" | "hide" | "remove" | "historical";
    cleanupCandidate?: boolean;
  };
  /** GitHub metadata used for sort + text search. */
  github?: {
    stars?: number;
    forks?: number;
    pushedAt?: string | null;
    license?: string | null;
  };
  /** Score block — used for "best-overall" sort. */
  scores?: {
    activity?: number;
    maturity?: number;
    learning?: number;
    contribution?: number;
    docs?: number;
    overall?: number;
  };
}

export type AppsFilters = {
  q?: string;
  /** Stack slugs, repeated URL key `stack=`. Matches against `stack` AND `stacks[]`. */
  stacks?: string[];
  /** Platform slugs, repeated URL key `platform=`. Matches `platforms[]`. */
  platforms?: string[];
  /** Category names, repeated URL key `category=`. */
  categories?: string[];
  /** Curated label ids (new/hot/mature/featured), repeated URL key `label=`. */
  labels?: string[];
  /** SPDX license ids, repeated URL key `license=`. */
  licenses?: string[];
  /** Health status values, comma-separated repeated URL key `status=`. */
  statuses?: string[];
  /** A curated lens (single-select view). */
  lens?: LensId;
  /** Sort order. Single value, defaults to "recently-updated". */
  sort?: AppsSort;
  /** 1-based page number. */
  page?: number;
};

/** Available sort orders, in UI order. */
export const SORT_OPTIONS = [
  { value: "recently-updated", label: "Recently updated" },
  { value: "most-starred", label: "Most starred" },
  { value: "recently-added", label: "Recently added" },
  { value: "best-overall", label: "Best overall" },
  { value: "alphabetical", label: "Alphabetical" },
] as const;

export type AppsSort = (typeof SORT_OPTIONS)[number]["value"];

const DEFAULT_SORT: AppsSort = "recently-updated";
const DEFAULT_PAGE = 1;

/**
 * How many records per page. Constant for now; future versions may
 * vary per blueprint.
 */
export const PAGE_SIZE = 24;

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
} as const;

// ── Search param round-tripping ──────────────────────────────────

/**
 * Read filters from a URLSearchParams (or anything URLSearchParams-
 * shaped, e.g. the result of `new URL(req.url).searchParams`).
 */
export function filtersFromSearchParams(
  sp: URLSearchParams,
): AppsFilters {
  const rawSort = sp.get(KEYS.sort);
  // Backwards-compat: old "most-mature" sort now maps to "best-overall".
  const normalizedSort = rawSort === "most-mature" ? "best-overall" : rawSort;
  const sort: AppsSort | undefined =
    normalizedSort && SORT_OPTIONS.some((o) => o.value === normalizedSort)
      ? (normalizedSort as AppsSort)
      : undefined;
  const rawPage = Number(sp.get(KEYS.page));
  const page =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : undefined;
  return {
    q: sp.get(KEYS.q) ?? undefined,
    stacks: sp.getAll(KEYS.stacks).filter(Boolean),
    platforms: sp.getAll(KEYS.platforms).filter(Boolean),
    categories: sp.getAll(KEYS.categories).filter(Boolean),
    labels: sp.getAll(KEYS.labels).filter(Boolean),
    licenses: sp.getAll(KEYS.licenses).filter(Boolean),
    statuses: sp
      .getAll(KEYS.statuses)
      .flatMap((s) => s.split(","))
      .filter(Boolean),
    lens: lensFromSearchParams(sp) || undefined,
    sort,
    page,
  };
}

/**
 * Serialize a filters object back to URLSearchParams. Undefined /
 * empty values are dropped. Defaults (sort, page 1) are also dropped
 * to keep URLs short and canonical.
 */
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
  return sp;
}

// ── Filter application ───────────────────────────────────────────

/**
 * True if any filter is active (i.e. the result list isn't "all
 * records, default sort").
 */
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

/**
 * Return the subset of records that match all active filters (AND
 * across dimensions, OR within a dimension).
 *
 * `q` is a case-insensitive substring search across name, owner,
 * description, category, stack/stacks/platforms, tags, and license.
 * Other dimensions are exact match.
 */
export function filterApps<T extends Searchable>(
  records: T[],
  f: AppsFilters,
): T[] {
  const q = f.q?.trim().toLowerCase();
  const stacks = f.stacks?.length ? new Set(f.stacks) : null;
  const platforms = f.platforms?.length ? new Set(f.platforms) : null;
  const categories = f.categories?.length ? new Set(f.categories) : null;
  const labels = f.labels?.length ? new Set(f.labels) : null;
  const licenses = f.licenses?.length ? new Set(f.licenses) : null;
  const statuses = f.statuses?.length ? new Set(f.statuses) : null;

  return records.filter((r) => {
    if (q) {
      const ownerMatch =
        /github\.com\/([^/]+)\//.exec(r.repoUrl ?? "")?.[1]?.toLowerCase() ??
        "";
      const haystack = [
        r.name,
        ownerMatch,
        r.description ?? "",
        r.category ?? "",
        r.stack ?? "",
        ...(r.stacks ?? []),
        ...(r.platforms ?? []),
        ...(r.tags ?? []),
        r.github?.license ?? "",
        r.health?.status ? statusDisplay(r.health.status) : "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (stacks) {
      const allStacks = [r.stack, ...(r.stacks ?? [])].filter(
        (s): s is string => Boolean(s),
      );
      if (!allStacks.some((s) => stacks.has(s))) return false;
    }

    if (platforms) {
      if (!r.platforms?.some((p) => platforms.has(p))) return false;
    }

    if (categories) {
      if (!r.category || !categories.has(r.category)) return false;
    }

    if (labels) {
      if (!r.curation?.labels?.some((l) => labels.has(l))) return false;
    }

    if (licenses) {
      const license = r.github?.license;
      if (!license || !licenses.has(license)) return false;
    }

    if (statuses) {
      const status = r.health?.status;
      if (!status || !statuses.has(status)) return false;
    }

    return true;
  });
}

// ── Lenses, sort, pagination ─────────────────────────────────────

/**
 * Apply lens → filter → sort pipeline. Lens is applied first because
 * it's a single-select "view" that may be broader or narrower than
 * the regular filter dimensions.
 */
export function pipeline<T extends Searchable>(
  records: T[],
  filters: AppsFilters,
): T[] {
  const afterLens = applyLens(records, filters.lens ?? "");
  const afterFilter = filterApps(afterLens, filters);
  return applySort(afterFilter, effectiveSort(filters));
}

/**
 * Sort records in-place-free: returns a new array. Stable for ties.
 * Records missing the sort key (e.g. no stars) sink to the bottom
 * rather than vanishing.
 */
export function applySort<T extends Searchable>(
  records: T[],
  sort: AppsSort,
): T[] {
  const arr = records.slice();
  const ts = (s?: string | null): number => (s ? new Date(s).valueOf() : 0);
  switch (sort) {
    case "most-starred":
      arr.sort((a, b) => (b.github?.stars ?? 0) - (a.github?.stars ?? 0));
      break;
    case "recently-updated":
      arr.sort((a, b) => ts(b.github?.pushedAt) - ts(a.github?.pushedAt));
      break;
    case "recently-added":
      // Index payload doesn't have a dedicated "addedAt" yet — fall
      // back to `pushedAt` so the sort still works. Once we add an
      // explicit addedAt field, swap the key here.
      arr.sort((a, b) => ts(b.github?.pushedAt) - ts(a.github?.pushedAt));
      break;
    case "best-overall": {
      // Composite: scores.overall → scores.maturity → scores.activity →
      // active status → license present → stars. Avoids ranking by
      // stars alone.
      const score = (
        x: T,
        k: "overall" | "maturity" | "activity",
      ): number => (typeof x.scores?.[k] === "number" ? x.scores![k]! : 0);
      const active = (x: T): number => (x.health?.status === "active" ? 1 : 0);
      const licensed = (x: T): number => (x.github?.license ? 1 : 0);
      arr.sort((a, b) => {
        const sOverall = score(b, "overall") - score(a, "overall");
        if (sOverall !== 0) return sOverall;
        const sMaturity = score(b, "maturity") - score(a, "maturity");
        if (sMaturity !== 0) return sMaturity;
        const sActivity = score(b, "activity") - score(a, "activity");
        if (sActivity !== 0) return sActivity;
        const sActive = active(b) - active(a);
        if (sActive !== 0) return sActive;
        const sLicensed = licensed(b) - licensed(a);
        if (sLicensed !== 0) return sLicensed;
        return (b.github?.stars ?? 0) - (a.github?.stars ?? 0);
      });
      break;
    }
    case "alphabetical":
      arr.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }
  return arr;
}

/** Slice an array for a given page (1-based). */
export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/** Total number of pages given an item count. Always >= 1. */
export function totalPages(itemCount: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(itemCount / pageSize));
}

/** Resolve the effective sort from a filters object, applying default. */
export function effectiveSort(f: AppsFilters): AppsSort {
  return f.sort ?? DEFAULT_SORT;
}

/** Resolve the effective page from a filters object, applying default. */
export function effectivePage(f: AppsFilters): number {
  return f.page ?? DEFAULT_PAGE;
}

// ── Facets ───────────────────────────────────────────────────────

/**
 * Return a flat list of active-filter chips for display + removal.
 * Used by the "x" button on each chip in the UI.
 */
export function activeFilterChips(
  f: AppsFilters,
): { key: keyof AppsFilters; value: string; label: string }[] {
  const out: { key: keyof AppsFilters; value: string; label: string }[] = [];

  if (f.q && f.q.trim()) {
    out.push({ key: "q", value: "", label: `“${f.q}”` });
  }
  for (const v of f.stacks ?? []) {
    out.push({ key: "stacks", value: v, label: `Stack: ${v}` });
  }
  for (const v of f.platforms ?? []) {
    out.push({ key: "platforms", value: v, label: `Platform: ${v}` });
  }
  for (const v of f.categories ?? []) {
    out.push({ key: "categories", value: v, label: `Category: ${v}` });
  }
  for (const v of f.labels ?? []) {
    out.push({ key: "labels", value: v, label: labelDisplay(v) ?? v });
  }
  for (const v of f.licenses ?? []) {
    out.push({ key: "licenses", value: v, label: `License: ${v}` });
  }
  if (f.lens) {
    // Inline map keeps this function dependency-free for unit tests
    // (no need to import from `lenses.ts` to render a chip label).
    const LENS_CHIP_LABELS: Record<LensId, string> = {
      all: "All",
      hot: "Trending",
      new: "Recently added",
      mature: "Established",
      featured: "Featured",
      "needs-review": "Needs review",
    };
    out.push({ key: "lens", value: f.lens, label: LENS_CHIP_LABELS[f.lens] ?? f.lens });
  }
  if (f.statuses && f.statuses.length) {
    for (const v of f.statuses) {
      out.push({ key: "statuses", value: v, label: statusDisplay(v) });
    }
  }

  return out;
}

/**
 * Build the full list of facet values from the record array,
 * preserving a sensible order (frequency desc, then alphabetical
 * for ties).
 */
export function buildFacets<T extends Searchable>(records: T[]) {
  const counts = {
    stack: new Map<string, number>(),
    platform: new Map<string, number>(),
    category: new Map<string, number>(),
    label: new Map<string, number>(),
    license: new Map<string, number>(),
  };
  for (const r of records) {
    const allStacks = new Set(
      [r.stack, ...(r.stacks ?? [])].filter(
        (s): s is string => Boolean(s),
      ),
    );
    for (const s of allStacks) {
      counts.stack.set(s, (counts.stack.get(s) ?? 0) + 1);
    }
    for (const p of r.platforms ?? []) {
      counts.platform.set(p, (counts.platform.get(p) ?? 0) + 1);
    }
    if (r.category) {
      counts.category.set(
        r.category,
        (counts.category.get(r.category) ?? 0) + 1,
      );
    }
    for (const l of r.curation?.labels ?? []) {
      counts.label.set(l, (counts.label.get(l) ?? 0) + 1);
    }
    const license = r.github?.license;
    if (license) {
      counts.license.set(license, (counts.license.get(license) ?? 0) + 1);
    }
  }
  const sortByCountThenName = (m: Map<string, number>) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count }));
  return {
    stacks: sortByCountThenName(counts.stack),
    platforms: sortByCountThenName(counts.platform),
    categories: sortByCountThenName(counts.category),
    labels: sortByCountThenName(counts.label),
    licenses: sortByCountThenName(counts.license),
  };
}

/**
 * Re-export the `ProjectRecord` type so consumers of the search lib
 * can write `import type { ProjectRecord } from "@grove-dev/astro/lib"`
 * without a second import.
 */
export type { ProjectRecord };
