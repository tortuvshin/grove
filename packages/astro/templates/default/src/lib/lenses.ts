/**
 * Curated lenses. The proxy lives here so the page can stay clean.
 * For a generic, headless version, see `@grove-dev/ui`.
 */

export type LensId =
  | "all"
  | "new"
  | "hot"
  | "mature"
  | "good-to-learn"
  | "production-like"
  | "beginner-friendly"
  | "contribution-ready"
  | "launches"
  | "actively-developed"
  | "needs-maintainer";

export interface LensDef {
  id: LensId;
  label: string;
  description?: string;
  toParams: () => Record<string, string | string[]>;
}

export const LENSES: LensDef[] = [
  { id: "all", label: "All apps", description: "Every app in the directory", toParams: () => ({}) },
  { id: "new", label: "Newly added", description: "Recently added to the directory", toParams: () => ({ label: "new" }) },
  { id: "hot", label: "Hot right now", description: "Apps gaining attention or recent activity", toParams: () => ({ label: "hot" }) },
  { id: "mature", label: "Mature", description: "Established long-running projects", toParams: () => ({ label: "mature" }) },
  { id: "production-like", label: "Production-grade", description: "Real apps, not toy projects", toParams: () => ({ lens: "production-like" }) },
  { id: "good-to-learn", label: "Good to learn", description: "Readable codebases with useful patterns", toParams: () => ({ lens: "good-to-learn" }) },
  { id: "beginner-friendly", label: "Beginner friendly", description: "Smaller, readable, easier to understand", toParams: () => ({ lens: "beginner-friendly" }) },
  { id: "contribution-ready", label: "Contribution ready", description: "Clear issues, active maintainers, license, contribution docs", toParams: () => ({ lens: "contribution-ready" }) },
  { id: "launches", label: "Launches", description: "Recently launched OSS apps seeking feedback", toParams: () => ({ lens: "launches" }) },
  { id: "actively-developed", label: "Actively developed", description: "Recent commits, releases, issue activity", toParams: () => ({ status: "active" }) },
  { id: "needs-maintainer", label: "Needs maintainer", description: "Useful apps that need help", toParams: () => ({ status: "stale,quiet" }) },
];

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

export function isLensActive(lensId: LensId, sp: URLSearchParams): boolean {
  if (lensId === "all") {
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

export function lensFromSearchParams(sp: URLSearchParams): LensId | null {
  const v = sp.get("lens");
  if (!v) return null;
  if (LENSES.some((l) => l.id === v)) return v as LensId;
  return null;
}
