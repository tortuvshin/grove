import type { IndexRecord } from "./schema.js";
import { labelDisplay, lensDisplay, statusDisplay } from "./directory-display.js";

/**
 * URL-driven filter state for the /items discovery page.
 *
 * Multi-value fields use repeated keys in the URL: `?stack=Flutter&stack=React+Native`.
 * Empty / undefined fields mean "no filter on this dimension".
 */
export type IndexFilters = {
  q?: string;
  stacks?: string[];
  platforms?: string[];
  categories?: string[];
  tags?: string[];
  labels?: string[];
  licenses?: string[];
  statuses?: string[];
  /** A curated lens (e.g. "good-to-learn", "production-like"). Single value. */
  lens?: string;
  /** Sort order. Single value, defaults to "recently-updated". */
  sort?: IndexSort | undefined;
  /** 1-based page number. */
  page?: number | undefined;
};

/** Available sort orders, in UI order. */
export const SORT_OPTIONS = [
  { value: "recently-updated", label: "Recently updated" },
  { value: "most-starred", label: "Most starred" },
  { value: "recently-added", label: "Recently added" },
  { value: "best-overall", label: "Best overall" },
  { value: "alphabetical", label: "Alphabetical" },
] as const;

export type IndexSort = (typeof SORT_OPTIONS)[number]["value"];

const DEFAULT_SORT: IndexSort = "recently-updated";
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

const KEYS = {
  q: "q",
  stacks: "stack",
  platforms: "platform",
  categories: "category",
  tags: "tag",
  labels: "label",
  licenses: "license",
  statuses: "status",
  lens: "lens",
  sort: "sort",
  page: "page",
} as const;

/**
 * Read filters from a URLSearchParams (or anything URLSearchParams-shaped,
 * e.g. the result of `new URL(req.url).searchParams`).
 */
export function filtersFromSearchParams(sp: URLSearchParams): IndexFilters {
  const rawSort = sp.get(KEYS.sort);
  // Backwards-compat: old "most-mature" sort now maps to "best-overall".
  const normalizedSort = rawSort === "most-mature" ? "best-overall" : rawSort;
  const sort: IndexSort | undefined =
    normalizedSort && (SORT_OPTIONS as readonly { value: string }[]).some((o) => o.value === normalizedSort)
      ? (normalizedSort as IndexSort)
      : undefined;
  const rawPage = Number(sp.get(KEYS.page));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : undefined;
  const q = sp.get(KEYS.q);
  const lens = sp.get(KEYS.lens);
  return {
    ...(q !== null ? { q } : {}),
    stacks: sp.getAll(KEYS.stacks).filter(Boolean),
    platforms: sp.getAll(KEYS.platforms).filter(Boolean),
    categories: sp.getAll(KEYS.categories).filter(Boolean),
    tags: sp.getAll(KEYS.tags).filter(Boolean),
    labels: sp.getAll(KEYS.labels).filter(Boolean),
    licenses: sp.getAll(KEYS.licenses).filter(Boolean),
    statuses: sp.getAll(KEYS.statuses).flatMap((s) => s.split(",")).filter(Boolean),
    ...(lens !== null ? { lens } : {}),
    ...(sort !== undefined ? { sort } : {}),
    ...(page !== undefined ? { page } : {}),
  };
}

/**
 * Serialize a filters object back to URLSearchParams.
 * Undefined / empty values are dropped. Defaults (sort, page 1, comfortable
 * density) are also dropped to keep URLs short and canonical.
 */
export function searchParamsFromFilters(f: IndexFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q) sp.set(KEYS.q, f.q);
  for (const v of f.stacks ?? []) sp.append(KEYS.stacks, v);
  for (const v of f.platforms ?? []) sp.append(KEYS.platforms, v);
  for (const v of f.categories ?? []) sp.append(KEYS.categories, v);
  for (const v of f.tags ?? []) sp.append(KEYS.tags, v);
  for (const v of f.labels ?? []) sp.append(KEYS.labels, v);
  for (const v of f.licenses ?? []) sp.append(KEYS.licenses, v);
  if (f.statuses?.length) sp.set(KEYS.statuses, f.statuses.join(","));
  if (f.lens) sp.set(KEYS.lens, f.lens);
  if (f.sort && f.sort !== DEFAULT_SORT) sp.set(KEYS.sort, f.sort);
  if (f.page && f.page !== DEFAULT_PAGE) sp.set(KEYS.page, String(f.page));
  return sp;
}

/** True if any filter is active (i.e. the result list isn't "all items"). */
export function hasAnyFilter(f: IndexFilters): boolean {
  if (f.q && f.q.trim()) return true;
  if (f.lens) return true;
  return Boolean(
    (f.stacks?.length ?? 0) +
      (f.platforms?.length ?? 0) +
      (f.categories?.length ?? 0) +
      (f.tags?.length ?? 0) +
      (f.labels?.length ?? 0) +
      (f.licenses?.length ?? 0) +
      (f.statuses?.length ?? 0),
  );
}

/** How many items per page. Constant for now; future versions may vary. */
export const PAGE_SIZE = DEFAULT_PAGE_SIZE;

/**
 * Sort items in-place-free: returns a new array. Stable for ties.
 * Apps missing the sort key (e.g. no stars) sink to the bottom rather
 * than vanishing.
 */
function recordName(record: IndexRecord): string {
  return record.kind === "resource" ? record.title : record.name;
}

function projectStars(record: IndexRecord): number {
  return record.kind === "project" ? record.github?.stars ?? 0 : 0;
}

function recordUpdatedAt(record: IndexRecord): string | null {
  if (record.kind === "project") return record.github?.pushedAt ?? null;
  if (record.kind === "resource") return record.publishedAt ?? null;
  return null;
}

function recordAddedAt(record: IndexRecord): string | null {
  return record.curation?.reviewedAt ?? null;
}

export function applySort(items: IndexRecord[], sort: IndexSort): IndexRecord[] {
  const arr = items.slice();
  const ts = (s?: string | null): number => (s ? new Date(s).valueOf() : 0);
  switch (sort) {
    case "most-starred":
      arr.sort((a, b) => projectStars(b) - projectStars(a));
      break;
    case "recently-updated":
      arr.sort((a, b) => ts(recordUpdatedAt(b)) - ts(recordUpdatedAt(a)));
      break;
    case "recently-added":
      arr.sort((a, b) => ts(recordAddedAt(b)) - ts(recordAddedAt(a)));
      break;
    case "best-overall": {
      const reviewed = (a: IndexRecord) => (a.curation?.reviewed ? 1 : 0);
      const visible = (a: IndexRecord) => (a.visibility === "keep" ? 1 : 0);
      arr.sort((a, b) => {
        const reviewedDelta = reviewed(b) - reviewed(a);
        if (reviewedDelta !== 0) return reviewedDelta;
        const visibleDelta = visible(b) - visible(a);
        if (visibleDelta !== 0) return visibleDelta;
        return projectStars(b) - projectStars(a);
      });
      break;
    }
    case "alphabetical":
      arr.sort((a, b) => recordName(a).localeCompare(recordName(b)));
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

/**
 * Windowed page list for pagination controls: all pages when 7 or
 * fewer, otherwise `1 … active−1 active active+1 … count` with
 * "ellipsis" markers. Shared by the server-rendered `Pagination`
 * component and the client-side rebuild in `DirectoryIndexClient`
 * so the two never drift.
 */
export function paginationPageList(
  active: number,
  count: number,
): Array<number | "ellipsis"> {
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1);
  const pages = new Set([1, count, active - 1, active, active + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= count).sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  for (const page of sorted) {
    const previous = result.at(-1);
    if (typeof previous === "number" && page - previous > 1) result.push("ellipsis");
    result.push(page);
  }
  return result;
}

/** Resolve the effective sort from a filters object, applying default. */
export function effectiveSort(f: IndexFilters): IndexSort {
  return f.sort ?? DEFAULT_SORT;
}

/** Resolve the effective page from a filters object, applying default. */
export function effectivePage(f: IndexFilters): number {
  return f.page ?? DEFAULT_PAGE;
}

/**
 * Return the subset of items that match all active filters (AND across
 * dimensions, OR within a dimension).
 *
 * `q` is a case-insensitive substring search across name, owner,
 * description, and category. Other dimensions are exact match.
 */
export function filterRecords(items: IndexRecord[], f: IndexFilters): IndexRecord[] {
  const q = f.q?.trim().toLowerCase();
  const stacks = f.stacks?.length ? new Set(f.stacks) : null;
  const platforms = f.platforms?.length ? new Set(f.platforms) : null;
  const categories = f.categories?.length ? new Set(f.categories) : null;
  const tags = f.tags?.length ? new Set(f.tags) : null;
  const labels = f.labels?.length ? new Set(f.labels) : null;
  // License ids are case-insensitive (GitHub emits `MIT`, curated ids
  // are lowercase). Normalize the filter side too so `?license=MIT`
  // and `?license=mit` are equivalent.
  const licenses = f.licenses?.length
    ? new Set(f.licenses.map((l) => l.toLowerCase()))
    : null;
  const statuses = f.statuses?.length ? new Set(f.statuses) : null;

  return items.filter((a) => {
    // Text search — match name, owner, description, category, stack,
    // stacks, platforms, tags, backend, architecture, stateManagement,
    // bestFor, whyListed, license, status.
    if (q) {
      const repoUrl = a.kind === "project" ? a.repoUrl : a.links.github ?? "";
      const ownerMatch =
        /github\.com\/([^/]+)\//.exec(repoUrl ?? "")?.[1]?.toLowerCase() ?? "";
      const projectFields =
        a.kind === "project"
          ? [
              a.stack,
              ...a.stacks,
              ...a.platforms,
              a.projectType,
              a.difficulty ?? "",
              a.codebaseSize ?? "",
              ...a.bestFor,
              ...a.whyListed,
              a.github?.license ?? "",
              a.health?.status ? statusDisplay(a.health.status) : "",
            ]
          : [];
      const resourceFields =
        a.kind === "resource"
          ? [a.type, a.topic, a.author ?? ""]
          : [];
      const entityFields =
        a.kind === "entity"
          ? [a.type, a.location ?? "", a.parent ?? ""]
          : [];
      const haystack = [
        recordName(a),
        ownerMatch,
        a.description,
        a.category,
        ...a.tags,
        ...projectFields,
        ...resourceFields,
        ...entityFields,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (stacks) {
      if (a.kind !== "project") return false;
      const allStacks = [a.stack, ...a.stacks].filter(
        (stack): stack is string => Boolean(stack),
      );
      if (!allStacks.some((s) => stacks.has(s))) return false;
    }

    if (platforms) {
      if (a.kind !== "project") return false;
      if (!a.platforms.some((p) => platforms.has(p))) return false;
    }

    if (categories) {
      if (!categories.has(a.category)) return false;
    }

    if (tags && !a.tags.some((tag) => tags.has(tag))) return false;

    if (labels) {
      if (!a.curation?.labels?.some((l) => labels.has(l))) return false;
    }

    if (licenses) {
      if (a.kind !== "project") return false;
      // Curated `licenses` array takes precedence; fall back to the
      // GitHub sync's `github.license.spdx_id` (recorded as the
      // raw spdx_id string by `directory-repo.ts`).
      //
      // SPDX normalization: GitHub emits `MIT`, curated ids are
      // lowercase (`mit`). Both sides are folded to lowercase before
      // comparison so the filter matches regardless of casing.
      //
      // Curated-empty vs curated-undefined: an explicit `licenses: []`
      // is treated as a curator opt-out (no GitHub fallback), while
      // a missing field falls back to GitHub. This matches the
      // `[]`-suppresses-fallback semantic tested below.
      const curated = (a.licenses ?? []) as string[];
      const hasCurated = Array.isArray(a.licenses);
      const synced = (a.github?.license ?? "").toLowerCase();
      const candidates = new Set<string>();
      if (hasCurated) {
        for (const l of curated) candidates.add(l.toLowerCase());
      } else if (synced) {
        candidates.add(synced);
      }
      if (candidates.size === 0) return false;
      if (![...candidates].some((l) => licenses.has(l))) return false;
    }

    if (statuses) {
      if (a.kind !== "project") return false;
      const status = a.health?.status;
      if (!status || !statuses.has(status)) return false;
    }

    if (f.lens) {
      if (!a.curation?.lenses?.includes(f.lens)) return false;
    }

    return true;
  });
}

/** Build a flat list of "active filter" chips for display + removal. */
export function activeFilterChips(
  f: IndexFilters,
): { key: keyof IndexFilters; value: string; label: string }[] {
  const out: { key: keyof IndexFilters; value: string; label: string }[] = [];

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
  for (const v of f.tags ?? []) {
    out.push({ key: "tags", value: v, label: `Tag: ${v}` });
  }
  for (const v of f.labels ?? []) {
    out.push({ key: "labels", value: v, label: labelDisplay(v) ?? v });
  }
  for (const v of f.licenses ?? []) {
    out.push({ key: "licenses", value: v, label: `License: ${v}` });
  }
  if (f.lens) {
    out.push({ key: "lens", value: f.lens, label: lensDisplay(f.lens) });
  }
  // Status: collapse the "stale,quiet" composite into a single chip.
  if (f.statuses && f.statuses.length) {
    const joined = f.statuses.join(",");
    if (joined === "stale,quiet") {
      out.push({ key: "statuses", value: "stale,quiet", label: statusDisplay("needs-maintainer") });
    } else {
      for (const v of f.statuses) {
        out.push({ key: "statuses", value: v, label: statusDisplay(v) });
      }
    }
  }

  return out;
}

/**
 * Return a new filters object with one (key, value) removed.
 * - scalar keys (`q`, `lens`) → clears the value
 * - multi-value keys → removes the single matching value
 * Used by the "x" button on each active filter chip.
 * Also resets page to 1 so the user doesn't get stranded on a high page
 * that no longer has results.
 */
export function removeFilter(
  f: IndexFilters,
  key: keyof IndexFilters,
  value: string,
): IndexFilters {
  let next: IndexFilters;
  if (key === "q" || key === "lens") {
    // Scalar filters are removed entirely rather than treated like arrays.
    const { [key]: _drop, ...rest } = f;
    next = rest;
  } else {
    const current = f[key] as string[] | undefined;
    if (!current) return f;
    // `needs-maintainer` is represented internally by the composite
    // statuses `stale,quiet`, but is displayed as one removable chip.
    const filtered =
      key === "statuses" && value === "stale,quiet"
        ? []
        : current.filter((v) => v !== value);
    if (filtered.length === 0) {
      const { [key]: _drop, ...rest } = f;
      next = rest;
    } else {
      next = { ...f, [key]: filtered };
    }
  }
  next.page = 1;
  return next;
}

/**
 * Build the full list of facet values from the items array, preserving
 * a sensible order (frequency desc, then alphabetical for ties).
 */
export function buildFacets(
  items: IndexRecord[],
  options?: {
    curatedTagIds?: string[];
    /**
     * When set, facet counts reflect records that satisfy all
     * current filters *except* the facet being computed. This is the
     * "intersection count" UX — Platform after Flutter should show
     * Flutter+Platform counts, not the global Platform count.
     *
     * Set to `null` (or omit) to keep the legacy global-count
     * behavior. The browse page opts in by passing the current
     * `IndexFilters` minus each facet's filter.
     */
    filters?: IndexFilters | null;
  },
) {
  const curatedTagIds = options?.curatedTagIds;
  const filters = options?.filters;
  const allowTag = (tag: string) =>
    !curatedTagIds || curatedTagIds.length === 0 || curatedTagIds.includes(tag);

  // For each facet, build a sub-filter that excludes that facet's
  // current value. So when computing stack counts, we still apply
  // platform / category / license filters, but we ignore the
  // currently selected stacks. This is the "intersection count"
  // UX the audit asked for.
  const subFiltersFor = (facet: "stacks" | "platforms" | "categories" | "tags" | "licenses") => {
    if (!filters) return null;
    const next = { ...filters };
    if (facet === "stacks") delete next.stacks;
    if (facet === "platforms") delete next.platforms;
    if (facet === "categories") delete next.categories;
    if (facet === "tags") delete next.tags;
    if (facet === "licenses") delete next.licenses;
    return next;
  };
  const itemsForFacet = (facet: "stacks" | "platforms" | "categories" | "tags" | "licenses") => {
    const sub = subFiltersFor(facet);
    return sub ? filterRecords(items, sub) : items;
  };

  const counts = {
    stack: new Map<string, number>(),
    platform: new Map<string, number>(),
    category: new Map<string, number>(),
    tag: new Map<string, number>(),
    label: new Map<string, number>(),
    license: new Map<string, number>(),
  };
  const stackScoped = itemsForFacet("stacks");
  const platformScoped = itemsForFacet("platforms");
  const categoryScoped = itemsForFacet("categories");
  const tagScoped = itemsForFacet("tags");
  const licenseScoped = itemsForFacet("licenses");

  for (const a of stackScoped) {
    if (a.kind === "project") {
      const allStacks = new Set(
        [a.stack, ...a.stacks].filter((stack): stack is string => Boolean(stack)),
      );
      for (const s of allStacks) counts.stack.set(s, (counts.stack.get(s) ?? 0) + 1);
    }
  }
  for (const a of platformScoped) {
    if (a.kind === "project") {
      for (const p of a.platforms) counts.platform.set(p, (counts.platform.get(p) ?? 0) + 1);
    }
  }
  for (const a of categoryScoped) {
    counts.category.set(a.category, (counts.category.get(a.category) ?? 0) + 1);
  }
  for (const a of tagScoped) {
    for (const tag of a.tags) {
      if (allowTag(tag)) counts.tag.set(tag, (counts.tag.get(tag) ?? 0) + 1);
    }
  }
  for (const a of licenseScoped) {
    if (a.kind === "project") {
      // Consult the curated `licenses` array first (lowercased for
      // facet-key consistency), then fall back to the GitHub-synced
      // SPDX id. Mirrors the filterRecords branch so facet counts
      // and filter results can never disagree.
      const curated = ((a.licenses ?? []) as string[])
        .map((l) => l.toLowerCase())
        .filter(Boolean);
      const synced = (a.github?.license ?? "").toLowerCase();
      const ids = curated.length ? curated : synced ? [synced] : [];
      for (const id of ids) {
        counts.license.set(id, (counts.license.get(id) ?? 0) + 1);
      }
    }
  }
  // Labels don't have a UI facet yet; keep global counts so the
  // existing badge logic doesn't drift.
  for (const a of items) {
    for (const l of a.curation?.labels ?? []) counts.label.set(l, (counts.label.get(l) ?? 0) + 1);
  }
  const sortByCountThenName = (m: Map<string, number>) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count }));
  return {
    stacks: sortByCountThenName(counts.stack),
    platforms: sortByCountThenName(counts.platform),
    categories: sortByCountThenName(counts.category),
    tags: sortByCountThenName(counts.tag),
    labels: sortByCountThenName(counts.label),
    licenses: sortByCountThenName(counts.license),
  };
}

// ── V1-published API ─────────────────────────────────────────────────
// `IndexFilters` / `IndexSort` are the canonical V1 names for the
// filter-state type. The internal functions (filterRecords, applySort,
// paginate, buildFacets, etc.) operate on the generic `IndexRecord`
// shape and are intentionally framework-agnostic.
