import { defineConfig } from "@grove-dev/core";

/**
 * Default template config — the smallest viable project-directory
 * showcase. Consumers (created via `grove new`) override this
 * with their own branding, taxonomy, and integrations.
 */
export default defineConfig({
  blueprint: "project-directory",

  site: {
    name: "Grove Directory",
    tagline: "A curated, health-aware developer directory.",
    description:
      "A curated, health-aware developer directory powered by Grove.",
    url: "https://example.com",
    repoUrl: "https://github.com/tortuvshin/grove",
  },

  nav: [
    { label: "Home", href: "/" },
    { label: "Browse", href: "/projects" },
    { label: "About", href: "/about" },
  ],

  facets: ["category", "stacks", "platforms", "tags"],

  integrations: { github: false },

  theme: {
    primaryColor: "#1f6feb",
    radius: "soft",
    density: "comfortable",
    containerWidth: "72rem",
  },
});
