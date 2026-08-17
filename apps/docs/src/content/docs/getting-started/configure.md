---
title: Configure your space
description: How to set the name, blueprint, theme, and integrations for your Grove space through grove.config.ts.
---

# Configure your space

`grove.config.ts` is the single source of truth for your space. Edit it to change the site name, blueprint, theme, browse facets, integrations, and navigation. Every field is validated against the Zod schema at build time — a typo fails the build immediately with a clear message.

## The file in one view

The full shape, with sensible defaults:

```ts
import { defineConfig } from "@grove-dev/core";

export default defineConfig({
  blueprint: "project-directory",
  site: {
    name: "My Directory",
    tagline: "One line about what this is.",
    url: "https://mydir.dev",
    repoUrl: "https://github.com/me/mydir",
    description: "A longer description for OG cards and JSON-LD.",
  },
  theme: {
    primaryColor: "#0ea5e9",
    radius: "soft",
    density: "comfortable",
    containerWidth: "80rem",
  },
  browse: {
    facets: ["category", "stack", "platform", "tags", "license"],
  },
  integrations: {
    github: { metadata: true, contributors: true },
  },
  nav: [
    { label: "Home", href: "/" },
    { label: "Browse", href: "/projects" },
    { label: "About", href: "/about" },
  ],
});
```

The full field reference is in **[grove.config.ts reference](/reference/config/)**.

## Blueprint

The blueprint decides what `kind` your records use and which templates render them:

| Blueprint | Record kind | Use case |
|---|---|---|
| `project-directory` | `project` | Curated catalog of open-source projects, libraries, agents, or tools. (Default scaffold.) |
| `resource-hub` | `resource` | Articles, podcasts, videos, courses, comparisons. |
| `ecosystem-map` | `entity` | Companies, agencies, foundations, communities. |

```ts
blueprint: "resource-hub"   // toggle the site to a resource hub
```

The blueprint and the record `kind` must match — a `kind: project` record on an `ecosystem-map` site fails validation. See [Three blueprints](/concepts/blueprints/) for the full comparison.

## Site identity

These four fields flow into `<title>`, OG cards, canonical URLs, and JSON-LD:

```ts
site: {
  name: "My Directory",
  tagline: "A focused list of tools we trust.",
  url: "https://mydir.dev",
  repoUrl: "https://github.com/me/mydir",
}
```

- `site.url` is the canonical base for every record's `<link rel="canonical">` and `og:url`. **If you omit it, OG tags resolve to `https://example.com`** and search engines treat every page as the canonical version.
- `site.repoUrl` is used by the GitHub integration for star/fork enrichment.
- `site.description` is optional but recommended — it populates the site-wide JSON-LD.

## Theme tokens

Tweak the visual feel without writing CSS:

```ts
theme: {
  primaryColor: "#0ea5e9",
  radius: "soft",          // "none" | "sharp" | "soft" | "pill"
  density: "comfortable",  // "compact" | "comfortable" | "spacious"
  containerWidth: "80rem", // any CSS length
}
```

See [Theme tokens](/customize/theme/) for the full list of tokens and what each controls.

## Browse facets

`browse.facets` chooses which dimensions appear as filters on `/browse` and in what order:

```ts
browse: {
  facets: ["category", "stack", "platform", "tags", "license"],
}
```

Only the canonical facet ids are accepted. **A typo fails config parsing immediately with a list of accepted ids.** See [Organize with taxonomy](/content/taxonomy-files/) for the taxonomy file shape each facet reads from.

## Integrations

Toggle which automated behaviors are enabled:

```ts
integrations: {
  github: {
    metadata: true,     // refresh stars, forks, language, topics, license
    contributors: true, // aggregate contributor counts
  },
}
```

`metadata: true` requires a `GITHUB_TOKEN` in `.env`. See [Sync GitHub metadata](/automation/sync-github/) for setup.

## Navigation

Define the header nav. Each entry has a label and an href:

```ts
nav: [
  { label: "Home",   href: "/" },
  { label: "Browse", href: "/projects" },
  { label: "About",  href: "/about" },
]
```

The order of entries is render order. Use `external: true` for off-site links.

## After editing

Config is read at boot, not hot-reloaded. After any change:

1. **Restart `pnpm dev`** — config changes don't apply until the next server boot.
2. **Run `pnpm exec grove check`** — validates the new config against the Zod schema and surfaces typos.
3. **Run `pnpm build`** — confirms the production build accepts it.

If you want config changes picked up without a manual restart, use the Astro `--watch` flag.

## Common mistakes

- **`site.url` not set** → OG tags resolve to `https://example.com`, JSON-LD `url` is wrong.
- **`blueprint` set but record `kind` mismatched** → `grove check` fails every record with a kind error.
- **Custom facet id** (e.g. `"categories"`) → fails with a list of accepted ids (`category`, `stack`, `platform`, `tags`, `license`).
- **`integrations.github.metadata: true` without `GITHUB_TOKEN`** → `grove sync github` fails with a clear auth error; the build itself still succeeds.

## Next steps

- [Deploy your site →](/deployment/overview/) — pick a host and ship it.
- [Full reference →](/reference/config/) — every field, every type, every default.