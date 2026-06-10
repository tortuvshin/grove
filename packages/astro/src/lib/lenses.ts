/**
 * Curated lenses for the list / discovery page.
 *
 * A lens is a single-select view that translates into a (possibly
 * empty) URL search-param filter. The 6 lenses below cover the
 * "what should I look at next?" mental shortcut:
 *
 *   - "all"          — no filter
 *   - "hot"          — recent attention: stars ≥ 1000 OR pushed within 30d
 *   - "new"          — fresh entries: pushed within 7d OR curated "new" label
 *   - "mature"       — long-running projects: curated tier AND pushed > 365d ago
 *   - "featured"     — curated "featured" label
 *   - "needs-review" — cleanup candidate (stale / archived / etc.)
 *
 * The lens id is what shows up in the URL as `?lens=...`. Filter
 * resolution happens in `lib/search.ts` (`filterApps`).
 *
 * Keep this list in sync with `lib/search.ts` and any UI tabs.
 */

import type {
  HealthBlock,
  HealthStatus,
  ProjectRecord,
} from "@grove-dev/core";

export type LensId =
  | "all"
  | "hot"
  | "new"
  | "mature"
  | "featured"
  | "needs-review";

export interface LensDef {
  id: LensId;
  label: string;
  description: string;
  /**
   * Returns true when the record matches this lens. Designed to
   * operate on the index payload (`toIndexRecord`) shape — the
   * same record the list page already holds — so consumers don't
   * need to do a second fetch.
   */
  match: (record: AppLike) => boolean;
}

const DAY_MS = 86_400_000;

/**
 * The shape that lens matching actually reads. Decoupled from
 * `ProjectRecord` so the search lib can also pass the index payload
 * (which omits a few heavy fields) and tests can pass minimal
 * fixtures.
 */
export interface AppLike {
  curation?: { labels?: string[] };
  health?: Pick<HealthBlock, "status" | "tier" | "cleanupCandidate">;
  github?: {
    stars?: number;
    pushedAt?: string | null;
  };
}

function daysSince(iso: string | null | undefined): number {
  if (!iso) return Infinity;
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return Infinity;
  return (Date.now() - d.valueOf()) / DAY_MS;
}

function hasLabel(record: AppLike, label: string): boolean {
  return record.curation?.labels?.includes(label) ?? false;
}

const CLEANUP_STATUSES: HealthStatus[] = [
  "stale",
  "inactive",
  "archived",
  "unavailable",
  "needs_review",
];

function isCleanupCandidate(record: AppLike): boolean {
  if (record.health?.cleanupCandidate) return true;
  const status = record.health?.status;
  if (!status) return false;
  return CLEANUP_STATUSES.includes(status);
}

export const LENSES: LensDef[] = [
  {
    id: "all",
    label: "All",
    description: "Every record in the directory.",
    match: () => true,
  },
  {
    id: "hot",
    label: "Trending",
    description:
      "Records with recent attention — stars ≥ 1000 or pushed within 30 days.",
    match: (r) => {
      const stars = r.github?.stars ?? 0;
      const pushed = daysSince(r.github?.pushedAt);
      return stars >= 1000 || pushed <= 30;
    },
  },
  {
    id: "new",
    label: "Recently added",
    description:
      "Fresh entries — pushed within 7 days or curated with the “new” label.",
    match: (r) => {
      const pushed = daysSince(r.github?.pushedAt);
      return pushed <= 7 || hasLabel(r, "new");
    },
  },
  {
    id: "mature",
    label: "Established",
    description:
      "Long-running projects — curated tier and last push > 365 days ago.",
    match: (r) => {
      const tier = r.health?.tier;
      const pushed = daysSince(r.github?.pushedAt);
      return tier === "curated" && pushed > 365;
    },
  },
  {
    id: "featured",
    label: "Featured",
    description: "Records curated with the “featured” label.",
    match: (r) => hasLabel(r, "featured"),
  },
  {
    id: "needs-review",
    label: "Needs review",
    description: "Cleanup candidates — stale, archived, or unmaintained.",
    match: (r) => isCleanupCandidate(r),
  },
];

/**
 * The lenses rendered as top-row tabs on the list page. Order
 * matters — left to right. Keep this in sync with what the design
 * calls for; URL deep-linking accepts any `LensId` even if it's not
 * in the primary row.
 */
export const PRIMARY_LENSES: LensId[] = [
  "all",
  "hot",
  "new",
  "mature",
  "featured",
  "needs-review",
];

export function lensById(id: string | null | undefined): LensDef | undefined {
  if (!id) return undefined;
  return LENSES.find((l) => l.id === id);
}

export function isPrimaryLens(id: string | null | undefined): id is LensId {
  if (!id) return false;
  return PRIMARY_LENSES.includes(id as LensId);
}

/**
 * Resolve the active lens from URL search params. Returns the empty
 * string when no `lens=...` is set, so callers can treat both
 * "absent" and "unknown" identically.
 */
export function lensFromSearchParams(
  params: URLSearchParams,
): LensId | "" {
  const v = params.get("lens");
  if (!v) return "";
  if (LENSES.some((l) => l.id === v)) return v as LensId;
  return "";
}

/**
 * `true` when the URL search params currently reflect this lens's
 * filter shape. The "all" lens is the implicit "no filter" state —
 * it's active only when no other lens-shaped params are present.
 */
export function isLensActive(lensId: LensId, params: URLSearchParams): boolean {
  if (lensId === "all") {
    return lensFromSearchParams(params) === "" && !params.get("label");
  }
  return lensFromSearchParams(params) === lensId;
}

/**
 * Build a `href` for a lens tab. Selecting a lens resets the other
 * "view" params (label, page) and applies only the chosen lens's
 * filter. Other filters (q, stack, platform, category, sort) are
 * preserved.
 *
 * `pathPrefix` is the URL root for the list page — typically
 * `/projects` for the project-directory blueprint, `/resources` for
 * resource-hub, `/entities` for ecosystem-map. Defaults to `/`.
 */
export function hrefForLens(
  lensId: LensId,
  params: URLSearchParams,
  pathPrefix: string = "/",
): string {
  const sp = new URLSearchParams(params);
  sp.delete("lens");
  sp.delete("label");
  sp.delete("page");
  if (lensId && lensId !== "all") {
    sp.set("lens", lensId);
  }
  const qs = sp.toString();
  const base = pathPrefix.replace(/\/$/, "");
  return qs ? `${base}?${qs}` : base || "/";
}

/**
 * Apply the lens filter to a record array. When `lensId` is
 * `""` (no lens) or `"all"`, returns the input unchanged.
 *
 * Type-parameterized so the same helper works on `ProjectRecord[]`
 * and on the lighter index payload that list pages ship.
 */
export function applyLens<T extends AppLike>(records: T[], lensId: LensId | ""): T[] {
  if (!lensId || lensId === "all") return records;
  const def = lensById(lensId);
  if (!def) return records;
  return records.filter((r) => def.match(r));
}

// Re-export the type so consumers can write `import type { AppLike }`
// without depending on `@grove-dev/core` directly.
export type { ProjectRecord };
