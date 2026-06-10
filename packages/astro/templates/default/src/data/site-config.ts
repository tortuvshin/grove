/**
 * Site config exposed to Astro pages.
 *
 * This file is a typed re-export of `data/generated/site-config.json`,
 * which the CLI builds from the project-root `grove.config.ts` at
 * `grove generate` time. Astro pages and components import this
 * module for branding strings, blueprint routing, and theme tokens.
 *
 * Do not edit by hand. Re-run `grove generate` after changing
 * `grove.config.ts`.
 */
import type { GroveConfig } from "@grove-dev/core";
import generated from "../../data/generated/site-config.json";

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

export const siteConfig: SiteConfig = generated as SiteConfig;

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
