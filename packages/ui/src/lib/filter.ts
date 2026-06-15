/**
 * @grove-dev/ui — filter primitive (V1, typed against `IndexRecord`).
 *
 * V0 worked on the `DirectoryRecord` (item + health + decision
 * triplet) and operated on `taxonomy.category`, `health.health.status`,
 * `curation.scores`. V1 replaced all of that with a discriminated
 * `IndexRecord` union: `kind: "project" | "resource" | "entity"`,
 * with each kind carrying only the fields it actually has. This
 * module ports the V0 filter semantics — text search, stack/
 * platform/category/label/license/status/lens, maintained toggle,
 * hideArchived — to the V1 shape.
 *
 * The `IndexFilters` shape mirrors `@grove-dev/astro`'s
 * `IndexFilters` (formerly `ItemsFilters` before the V0→V1 rename)
 * so a consumer can build a filter
 * object once and pass it through both layers.
 */
import type { IndexRecord, HealthStatus } from "@grove-dev/core";
import { type SortValue, type LensId } from "./constants.js";

/** Display map for health statuses (used in chip / search strings). */
const STATUS_DISPLAY: Record<string, string> = {
  active: "Active",
  mature: "Mature",
  quiet: "Quiet",
  stale: "Not recently active",
  needs_review: "Needs review",
  archived: "Archived",
  unknown: "Unknown",
  historical: "Historical",
  inactive: "Inactive",
  unavailable: "Unavailable",
};

function statusToText(s: HealthStatus | undefined | null): string {
  if (!s) return STATUS_DISPLAY.unknown ?? "";
  return STATUS_DISPLAY[s] ?? STATUS_DISPLAY.unknown ?? "";
}

/** URL-driven filter state for the directory index. */
export interface IndexFilters {
  q?: string;
  /** Stack names — match against `project.stack` + `project.stacks[]`. */
  stacks?: string[];
  /** Platform names — match against `project.platforms[]`. */
  platforms?: string[];
  /** Category name (single) — matches `record.category`. */
  categories?: string[];
  /** Curation labels (multi) — matches `curation.labels[]`. */
  labels?: string[];
  /** GitHub-derived license (single) — matches `project.github.license`. */
  licenses?: string[];
  /** Health statuses (multi) — matches `project.health.status`. */
  statuses?: string[];
  /** A curated lens id (single) — matches `curation.lenses[]`. */
  lens?: LensId;
  /** Sort order. Single value, defaults to "recently-updated". */
  sort?: SortValue;
  /** 1-based page number. */
  page?: number;
}

/** Filter chip — key/value/label tuple for active-filter rendering. */
export interface FilterChip {
  key: keyof IndexFilters;
  label: string;
  value: string;
}

const HEALTHY_STATUSES: ReadonlySet<HealthStatus> = new Set<HealthStatus>(["active", "mature"]);

function repoOwner(repoUrl: string | undefined | null): string {
  if (!repoUrl) return "";
  const m = /github\.com\/([^/]+)\//.exec(repoUrl);
  return m?.[1]?.toLowerCase() ?? "";
}

function recordTextHaystack(record: IndexRecord): string {
  const owner = repoOwner(record.kind === "project" ? record.repoUrl : record.links.github);
  const projectFields =
    record.kind === "project"
      ? [
          record.stack,
          ...record.stacks,
          ...record.platforms,
          record.projectType,
          record.difficulty ?? "",
          record.codebaseSize ?? "",
          ...record.bestFor,
          ...record.whyListed,
          record.github?.license ?? "",
          statusToText(record.health?.status),
        ]
      : [];
  const resourceFields =
    record.kind === "resource"
      ? [record.type, record.topic, record.author ?? ""]
      : [];
  const entityFields =
    record.kind === "entity"
      ? [record.type, record.location ?? "", record.parent ?? ""]
      : [];
  return [
    record.kind === "resource" ? record.title : record.name,
    owner,
    record.description,
    record.category,
    ...record.tags,
    ...projectFields,
    ...resourceFields,
    ...entityFields,
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * Return the subset of records that match all active filters (AND
 * across dimensions, OR within a dimension). `q` is a case-insensitive
 * substring search across name, owner, description, and category.
 * Other dimensions are exact match.
 */
export function filterRecords(records: IndexRecord[], f: IndexFilters): IndexRecord[] {
  const q = f.q?.trim().toLowerCase();
  const stacks = f.stacks?.length ? new Set(f.stacks) : null;
  const platforms = f.platforms?.length ? new Set(f.platforms) : null;
  const categories = f.categories?.length ? new Set(f.categories) : null;
  const labels = f.labels?.length ? new Set(f.labels) : null;
  const licenses = f.licenses?.length ? new Set(f.licenses) : null;
  const statuses = f.statuses?.length ? new Set(f.statuses) : null;

  return records.filter((record) => {
    if (q) {
      const haystack = recordTextHaystack(record);
      if (!haystack.includes(q)) return false;
    }

    if (stacks) {
      if (record.kind !== "project") return false;
      const allStacks = [record.stack, ...record.stacks].filter(
        (s): s is string => Boolean(s),
      );
      if (!allStacks.some((s) => stacks.has(s))) return false;
    }

    if (platforms) {
      if (record.kind !== "project") return false;
      if (!record.platforms.some((p) => platforms.has(p))) return false;
    }

    if (categories) {
      if (!categories.has(record.category)) return false;
    }

    if (labels) {
      if (!record.curation?.labels?.some((l) => labels.has(l))) return false;
    }

    if (licenses) {
      if (record.kind !== "project") return false;
      const license = record.github?.license;
      if (!license || !licenses.has(license)) return false;
    }

    if (statuses) {
      if (record.kind !== "project") return false;
      const status = record.health?.status;
      if (!status || !statuses.has(status)) return false;
    }

    if (f.lens) {
      if (!record.curation?.lenses?.includes(f.lens)) return false;
    }

    return true;
  });
}

/**
 * `True` if any filter is active (i.e. the result list isn't "all
 * records"). Used by the UI to show a "Clear all" affordance and
 * by the search URL helper to decide whether to add a marker.
 */
export function hasAnyFilter(f: IndexFilters): boolean {
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
 * Build a flat list of "active filter" chips for display + removal.
 * Multi-value keys (stacks, platforms, etc.) emit one chip per
 * value. The `key` is the field in `IndexFilters`; `value` is the
 * specific value to remove; `label` is the user-facing string.
 */
export function activeFilterChips(f: IndexFilters): FilterChip[] {
  const out: FilterChip[] = [];

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
    out.push({ key: "labels", value: v, label: `Label: ${v}` });
  }
  for (const v of f.licenses ?? []) {
    out.push({ key: "licenses", value: v, label: `License: ${v}` });
  }
  if (f.lens) {
    out.push({ key: "lens", value: f.lens, label: `Lens: ${f.lens}` });
  }
  if (f.statuses && f.statuses.length) {
    const joined = f.statuses.join(",");
    if (joined === "stale,quiet") {
      out.push({ key: "statuses", value: "stale,quiet", label: statusToText("stale") });
    } else {
      for (const v of f.statuses) {
        out.push({ key: "statuses", value: v, label: statusToText(v as HealthStatus) });
      }
    }
  }

  return out;
}

/** True if the record is a "maintained" project (active or mature). */
export function isMaintained(record: IndexRecord): boolean {
  if (record.kind !== "project") return false;
  const status = record.health?.status;
  return status ? HEALTHY_STATUSES.has(status) : false;
}
