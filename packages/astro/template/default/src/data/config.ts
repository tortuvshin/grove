/**
 * Site config exposed to Astro pages.
 *
 * This is generated at build time by `open-curated build-data`, which
 * reads `curated.config.ts` from the project root and emits this file.
 * The build pipeline makes it the single source of truth for branding
 * strings so every component can import the same values.
 *
 * Do not edit by hand. Re-run `open-curated build-data` after changing
 * `curated.config.ts`.
 */

export type SiteConfig = {
  name: string;
  tagline: string;
  description: string;
  siteUrl: string;
  repoUrl: string;
  itemLabel: string;
};

export const siteConfig: SiteConfig = {
  name: "Open Curated",
  tagline: "A living, health-aware developer directory.",
  description: "A searchable directory of open-source projects — organized by stack, category, platform, license, activity, and maturity.",
  siteUrl: "https://example.com",
  repoUrl: "https://github.com/tortuvshin/open-curated",
  itemLabel: "project",
};
