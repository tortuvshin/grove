/**
 * Curated lenses for the list page.
 *
 * Two flavors:
 * - "label-based": maps to a single `labels` value (e.g. hot / mature).
 *   No extra curation needed — every item already has a label.
 * - "curator-assigned": maps to a `lenses` value on the item. The 5 anchor
 *   items get these populated. Other items will simply not match.
 *
 * The lens id is what shows up in the URL as `?lens=...`. For
 * label-based lenses, the lens id is the same as the label.
 *
 * The curated lenses in `PRIMARY_LENSES` are rendered as top-row tabs. The rest
 * remain in the union type for URL deep-linking and future use, but are
 * not shown in the UI by default.
 */

export type LensId =
  // Sort-based (tabbed)
  | "all"
  | "recently-updated"
  | "new"
  // Label-based
  | "hot"
  | "mature"
  // Curator-assigned
  | "good-to-learn"
  | "production-like"
  // Available in URL state, but not tabbed
  | "beginner-friendly"
  | "contribution-ready"
  | "launches"
  // Status-based (available in URL state, not tabbed)
  | "actively-developed"
  | "needs-maintainer";

export interface LensDef {
  id: LensId;
  label: string;
  /** Short blurb shown when the lens is active. */
  description?: string;
  /** What URL state this lens implies. Empty means no filter. */
  toParams: () => Record<string, string | string[]>;
}

export const LENSES: LensDef[] = [
  { id: "all", label: "All items", description: "Every item in the directory", toParams: () => ({}) },
  {
    id: "recently-updated",
    label: "Actively developed",
    description: "Every item ordered by its most recent commit",
    toParams: () => ({ sort: "recently-updated" }),
  },
  {
    id: "new",
    label: "Recently added",
    description: "Every item ordered by when it joined the directory",
    toParams: () => ({ sort: "recently-added" }),
  },
  {
    id: "hot",
    label: "Trending",
    description: "Apps with recent activity and attention",
    toParams: () => ({ label: "hot" }),
  },
  {
    id: "mature",
    label: "Established",
    description: "Long-running projects with stable history",
    toParams: () => ({ label: "mature" }),
  },
  {
    id: "production-like",
    label: "Production-like",
    description: "Real items, not toy projects",
    toParams: () => ({ lens: "production-like" }),
  },
  {
    id: "good-to-learn",
    label: "Good to learn",
    description: "Readable codebases with useful patterns",
    toParams: () => ({ lens: "good-to-learn" }),
  },
  // Secondary (URL-only, not rendered as tabs)
  {
    id: "beginner-friendly",
    label: "Beginner friendly",
    description: "Smaller, readable, easier to understand",
    toParams: () => ({ lens: "beginner-friendly" }),
  },
  {
    id: "contribution-ready",
    label: "Contribution ready",
    description: "Clear issues, active maintainers, license, contribution docs",
    toParams: () => ({ lens: "contribution-ready" }),
  },
  {
    id: "launches",
    label: "Launches",
    description: "Recently launched OSS items seeking feedback",
    toParams: () => ({ lens: "launches" }),
  },
  {
    id: "actively-developed",
    label: "Active",
    description: "Apps with recent commits, releases, and issue activity",
    toParams: () => ({ status: "active" }),
  },
  {
    id: "needs-maintainer",
    label: "Needs maintainer",
    description: "Useful items that need help",
    toParams: () => ({ status: "stale,quiet" }),
  },
];

/**
 * The curated lenses shown as top-row tabs on /items.
 *
 * These three are ordering views over the WHOLE directory, not filters:
 * every item stays reachable from every tab, so a visitor can never land
 * on an empty list. They answer the two questions a directory visitor
 * actually has — "what's alive?" and "what's new?" — and they mirror the
 * homepage's two record sections one-to-one.
 *
 * The label-based (`hot`, `mature`) and curator-assigned
 * (`production-like`, `good-to-learn`) lenses stay in `LENSES` for URL
 * deep-linking, but are no longer tabbed: they filter rather than order,
 * so they can and do render empty on directories that never populate
 * `curation.labels` / `curation.lenses`.
 */
export const PRIMARY_LENSES: LensId[] = ["all", "recently-updated", "new"];

export function lensById(id: string | null | undefined): LensDef | undefined {
  if (!id) return undefined;
  return LENSES.find((l) => l.id === id);
}

/**
 * Check whether the current URL search params match a given lens's
 * implied filter state. Used to highlight the active tab when a
 * deep-link uses the underlying filter key (e.g. ?label=hot) rather
 * than the abstract lens id (?lens=hot).
 */
export function isLensActive(lensId: LensId, sp: URLSearchParams): boolean {
  if (lensId === "all") {
    // "All" is the fallback view: active only when no lens-shaped filter
    // is present AND no other lens claims the current params. Without the
    // second check a sort-based lens (e.g. ?sort=recently-updated) would
    // light up its own tab and "All" at the same time, since sorting
    // touches none of the lens/label/status keys.
    if (lensFromSearchParams(sp) || sp.get("label") || sp.get("status")) return false;
    return !LENSES.some((l) => l.id !== "all" && matchesLensParams(l, sp));
  }
  const def = lensById(lensId);
  if (!def) return false;
  return matchesLensParams(def, sp);
}

/** Whether every param a lens implies is present in `sp` with the same value. */
function matchesLensParams(def: LensDef, sp: URLSearchParams): boolean {
  for (const [k, v] of Object.entries(def.toParams())) {
    if (Array.isArray(v)) {
      if (sp.getAll(k).length !== v.length) return false;
      for (const item of v) if (!sp.getAll(k).includes(item)) return false;
    } else {
      if (sp.get(k) !== v) return false;
    }
  }
  return true;
}

export function isPrimaryLens(id: string | null | undefined): boolean {
  if (!id) return false;
  return PRIMARY_LENSES.includes(id as LensId);
}

/**
 * Turn a lens's `toParams()` output into a URLSearchParams string
 * (with the existing query preserved, then lens params merged on top).
 */
export function lensToQuery(id: LensId | null | undefined, current: URLSearchParams): string {
  if (!id || id === "all") return "";
  const def = lensById(id);
  if (!def) return "";
  const next = new URLSearchParams(current);
  for (const [k, v] of Object.entries(def.toParams())) {
    if (Array.isArray(v)) {
      next.delete(k);
      for (const item of v) next.append(k, item);
    } else {
      next.set(k, v);
    }
  }
  return next.toString();
}

/**
 * Read a `?lens=...` value from URL search params.
 */
export function lensFromSearchParams(sp: URLSearchParams): LensId | null {
  const v = sp.get("lens");
  if (!v) return null;
  if (LENSES.some((l) => l.id === v)) return v as LensId;
  return null;
}

/**
 * Build a `href` for a lens tab. Per the single-select-view rule,
 * clicking a lens resets the "view" params (lens, label, status, sort,
 * page) and applies only the chosen lens's params. The refinement
 * filters — q/stack/platform/category/license/tag — are preserved, so
 * switching view keeps whatever the visitor narrowed down to.
 *
 * `sort` is reset because lenses own the ordering: a stale
 * `?sort=recently-added` left over from another tab would otherwise
 * keep that tab active alongside the one just clicked.
 */
export function hrefForLens(
  lensId: LensId | null | undefined,
  current: URLSearchParams,
  pathPrefix = "/items",
): string {
  const sp = new URLSearchParams(current);
  sp.delete("lens");
  sp.delete("label");
  sp.delete("status");
  sp.delete("sort");
  sp.delete("page");
  if (lensId && lensId !== "all") {
    const def = lensById(lensId);
    if (def) {
      for (const [k, v] of Object.entries(def.toParams())) {
        if (Array.isArray(v)) {
          sp.delete(k);
          for (const item of v) sp.append(k, item);
        } else {
          sp.set(k, v);
        }
      }
    }
  }
  const qs = sp.toString();
  const base = pathPrefix.replace(/\/$/, "") || "/";
  return qs ? `${base}?${qs}` : base;
}
