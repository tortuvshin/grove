/**
 * Site config exposed to Astro pages.
 *
 * This file is the typed view of `grove.config.ts`. The CLI builds it
 * from the project-root config at `grove generate` time. Astro pages
 * and components import it directly for branding strings, blueprint
 * routing, and theme tokens.
 *
 * Do not edit by hand. Re-run `grove generate` after changing
 * `grove.config.ts`.
 */
import type { GroveConfig } from "@grove-dev/core";

export type SiteConfig = {
  blueprint: GroveConfig["blueprint"];
  name: string;
  tagline: string;
  description: string;
  siteUrl: string;
  repoUrl: string;
  nav: GroveConfig["nav"];
  theme: GroveConfig["theme"];
  integrations: GroveConfig["integrations"];
};

export const siteConfig: SiteConfig = {
  blueprint: "project-directory",
  name: "Grove",
  tagline: "A growing community knowledge site.",
  description: "A curated, searchable directory of community knowledge — projects, resources, and ecosystem actors in one place.",
  siteUrl: "https://example.com",
  repoUrl: "",
  nav: [],
  theme: {
    primaryColor: "#16a34a",
    radius: "soft",
    density: "comfortable",
    containerWidth: "72rem",
  },
  integrations: { github: false },
};

/** Convenience: slug for the directory index page based on blueprint. */
export function indexSlug(): string {
  switch (siteConfig.blueprint) {
    case "resource-hub":
      return "resources";
    case "ecosystem-map":
      return "entities";
    case "project-directory":
    default:
      return "projects";
  }
}

/** Convenience: human label for items in the UI. */
export function itemLabel(): string {
  switch (siteConfig.blueprint) {
    case "resource-hub":
      return "resource";
    case "ecosystem-map":
      return "entity";
    case "project-directory":
    default:
      return "project";
  }
}
