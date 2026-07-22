import { defineConfig } from "@grove-dev/core";

/** The demo is an AI directory only because this config and its data say so. */
export default defineConfig({
  blueprint: "project-directory",

  site: {
    name: "Grove AI Directory",
    tagline: "Open-source AI tools worth running, studying, and extending.",
    description:
      "A curated directory of open-source AI tools, agents, and infrastructure powered by Grove.",
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
