/**
 * Curated lenses for the list page.
 *
 * Two flavors:
 * - "label-based": maps to a single `labels` value (e.g. new / hot / mature).
 *   No extra curation needed — every app already has a label.
 * - "curator-assigned": maps to a `lenses` value on the app. The 5 anchor
 *   apps get these populated. Other apps will simply not match.
 *
 * The lens id is what shows up in the URL as `?lens=...`. For
 * label-based lenses, the lens id is the same as the label.
 *
 * The 6 lenses in `PRIMARY_LENSES` are rendered as top-row tabs. The rest
 * remain in the union type for URL deep-linking and future use, but are
 * not shown in the UI by default.
 */

export type LensId =
  // Label-based (tabbed)
  | "all"
  | "new"
  | "hot"
  | "mature"
  // Curator-assigned (tabbed)
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
  { id: "all", label: "All apps", description: "Every app in the directory", toParams: () => ({}) },
  {
    id: "new",
    label: "Newly added",
    description: "Recently added to the directory",
    toParams: () => ({ label: "new" }),
  },
  {
    id: "hot",
    label: "Hot right now",
    description: "Apps gaining attention or recent activity",
    toParams: () => ({ label: "hot" }),
  },
  {
    id: "mature",
    label: "Mature",
    description: "Established long-running projects",
    toParams: () => ({ label: "mature" }),
  },
  {
    id: "production-like",
    label: "Production-grade",
    description: "Real apps, not toy projects",
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
    description: "Recently launched OSS apps seeking feedback",
    toParams: () => ({ lens: "launches" }),
  },
  {
    id: "actively-developed",
    label: "Actively developed",
    description: "Recent commits, releases, issue activity",
    toParams: () => ({ status: "active" }),
  },
  {
    id: "needs-maintainer",
    label: "Needs maintainer",
    description: "Useful apps that need help",
    toParams: () => ({ status: "stale,quiet" }),
  },
];

/**
 * The 6 lenses shown as top-row tabs on /apps. Order matters — left to right.
 * Keep this list aligned with what the design calls for: All, signal lenses,
 * and the two curator-assigned lenses that have any matches.
 */
export const PRIMARY_LENSES: LensId[] = [
  "all",
  "new",
  "hot",
  "mature",
  "production-like",
  "good-to-learn",
];

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
    // "All" is active when no lens-shaped filter is present.
    return !lensFromSearchParams(sp) && !sp.get("label") && !sp.get("status");
  }
  const def = lensById(lensId);
  if (!def) return false;
  const target = def.toParams();
  for (const [k, v] of Object.entries(target)) {
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
