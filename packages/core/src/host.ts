/**
 * Extract a display host from a configured site URL. Used by the
 * static OG SVG (`site-artifacts.ts`) and the per-page OG card
 * pipeline (`og-image.ts`) to print `example.com` rather than the
 * full URL on social cards.
 *
 * Returns the literal string `"example.com"` when the URL is missing
 * so neither card ever shows `undefined`. Falls back to a regex
 * strip when the input lacks a scheme because `site.url` is allowed
 * to be either `https://x.com` or `x.com` in `grove.config.ts`.
 */
export function hostOf(rawUrl?: string): string {
  if (!rawUrl) return "example.com";
  try {
    return new URL(rawUrl).host;
  } catch {
    return rawUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}
