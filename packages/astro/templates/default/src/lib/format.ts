/** Number/date formatting helpers used across the templates. */
export function compact(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return (k >= 10 ? Math.round(k).toString() : k.toFixed(1)) + "k";
  }
  return n.toString();
}

export function formatStars(n: number | null | undefined): string | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return compact(n);
}

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

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
