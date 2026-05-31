/**
 * Site config exposed to Astro pages.
 *
 * This file is the typed view of `curated.config.ts`. The CLI builds it
 * from the project-root config at `open-curated build-data` time. Astro
 * pages and components import it directly for branding strings.
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
