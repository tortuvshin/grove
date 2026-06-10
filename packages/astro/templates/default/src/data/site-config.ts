/**
 * Site config exposed to Astro pages.
 *
 * Source of truth: `data/generated/site-config.json`, which the
 * CLI writes from the project-root `grove.config.ts` at
 * `grove generate` time. Astro pages and components import this
 * module for branding strings, blueprint routing, and theme
 * tokens. Do not edit by hand — re-run `grove generate` after
 * changing `grove.config.ts`.
 *
 * If the JSON is missing (e.g. before `grove generate` runs, or
 * in a fresh scaffold with no records) this module falls back to
 * generic placeholder values so the Astro build still succeeds.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
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

const FALLBACK: SiteConfig = {
  blueprint: "project-directory",
  name: "Grove Directory",
  tagline: "A curated, health-aware developer directory.",
  description: "A curated, health-aware developer directory powered by Grove.",
  siteUrl: "https://example.com",
  repoUrl: "",
  nav: [],
  theme: {},
  integrations: {},
};

function loadSiteConfig(): SiteConfig {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      resolve(here, "..", "..", "data", "generated", "site-config.json"),
      resolve(here, "..", "..", "..", "data", "generated", "site-config.json"),
      resolve(process.cwd(), "data", "generated", "site-config.json"),
    ];
    const path = candidates.find((p) => existsSync(p));
    if (!path) return FALLBACK;
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as SiteConfig;
  } catch {
    return FALLBACK;
  }
}

export const siteConfig: SiteConfig = loadSiteConfig();

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
