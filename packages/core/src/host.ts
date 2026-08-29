// Shared by the static OG SVG (`site-artifacts.ts`) and the per-page
// OG card pipeline (`og-image.ts`). Returns `"example.com"` when no
// URL is configured and falls back to a regex strip when the input
// lacks a scheme, since `site.url` accepts either form.
export function hostOf(rawUrl?: string): string {
  if (!rawUrl) return 'example.com';
  try {
    return new URL(rawUrl).host;
  } catch {
    return rawUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}
