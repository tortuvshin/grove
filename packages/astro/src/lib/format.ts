/**
 * Shared formatting helpers used across components.
 *
 * Keep these dependency-free so they can be imported by both server-
 * rendered Astro components and any future client-side scripts.
 */

/**
 * Format a number compactly: 1234 → "1.2k", 12345 → "12k", 79 → "79".
 * Used for hero/header star counts and other large-num displays.
 */
export function compact(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return (k >= 10 ? Math.round(k).toString() : k.toFixed(1)) + "k";
  }
  return n.toString();
}

/**
 * Format a star count compactly. Returns null when input is not a
 * finite number, so callers can render "—" without an extra guard.
 */
export function formatStars(n: number | null | undefined): string | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return compact(n);
}

/**
 * Format an ISO date as a human "Xd ago" / "Xmo ago" / "Xy ago" string.
 * Returns "—" for missing or invalid input, and "today" for future
 * dates (which can happen with bad upstream timestamps).
 */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return "—";
  const days = Math.floor((Date.now() - d.valueOf()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1mo ago";
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  if (years === 1) return "1y ago";
  return `${years}y ago`;
}

/**
 * Format an ISO date as a localized short date (e.g. "Jan 5, 2026").
 * Returns the original string for unparseable input, or "—" when
 * no value is provided.
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
