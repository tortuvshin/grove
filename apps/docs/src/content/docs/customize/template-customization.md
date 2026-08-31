---
title: Template customization
description: How to change look, structure, or data layout of the installed scaffold.
---

Most customizations fall into three buckets, in increasing order of effort:

1. **Config** — change `grove.config.ts` (theme, facets, integrations).
2. **Content** — add a page, add a body to a record, edit copy.
3. **Components** — override a header, footer, hero, or card with your own.

Start with config. Only move to components if config can't do it.

## 1. Configuration

The single file at the repo root. Schema is `groveConfigSchema` in `packages/core/src/schema.ts`. Fields you change most:

```ts
import { defineConfig } from "@grove-dev/core";

export default defineConfig({
  blueprint: "project-directory",
  site: {
    name: "My Directory",
    tagline: "A focused list of tools we trust.",
    url: "https://mydir.dev",
    repoUrl: "https://github.com/me/mydir",
  },
  nav: [
    { label: "Home", href: "/" },
    { label: "Browse", href: "/projects" },
    { label: "About", href: "/about" },
  ],
  browse: { facets: ["category", "stack", "platform", "tags"] },
  theme: {
    primaryColor: "#0ea5e9",
    radius: "soft",
    density: "comfortable",
    containerWidth: "80rem",
  },
  integrations: { github: true },
});
```

After editing `grove.config.ts`, restart `pnpm dev` (config is read at boot, not hot-reloaded). `astro build` reads it at build time.

See the [config reference](/reference/config/) for the full field list.

## 2. Content

### Adding a page

Create `src/pages/<page>.astro`. Astro file-based routing applies:

```astro
---
// src/pages/changelog.astro
import BaseLayout from "../layouts/base-layout.astro";
import siteConfig from "@grove/generated/site-config.json";
---
<BaseLayout title="Changelog" description="Recent updates" site={siteConfig}>
  <h1>Changelog</h1>
  <p>This directory was last updated on 2025-10-12.</p>
</BaseLayout>
```

`BaseLayout` lives at `src/layouts/base-layout.astro` in your repo — `grove init` installed it there from the `@grove/shell` registry item — so import it by relative path, not from a package. `title`, `description`, and `site` are all required props — `site` is `data/generated/site-config.json`, which the `@grove/generated` alias resolves for you.

Add a nav link in `grove.config.ts`. See [Custom pages](/customize/pages/) for Markdown-page patterns and structured data.

### Adding a body to a record

Add a `content` path to the record's YAML:

```yaml
# data/records/astro.yml
content: ./content/records/astro.md
```

`content` is a literal relative path resolved against your project root at build time (`resolveContentPath` in `packages/core/src/content-body.ts`) — it isn't joined with a config directory, so write the path exactly as it should resolve. The scaffold convention is `content/records/<slug>.md`. Write the body in Markdown; the detail page renders it below the curated fields.

### Editing copy

Page-specific copy (the home page's section headings, the about page, the submission form) lives in `src/pages/` and your own `src/components/` — edit them directly, they're your files, not generated. Shared chrome (`Header`, `Footer`, `BaseLayout`) lives at `src/layouts/`, installed by `grove init` from the `@grove/default` registry scaffold, and `site.name`/`site.tagline` flow into it automatically from `grove.config.ts`.

## 3. Components

Components live in your `src/components/{ui,grove,site}/` directory — installed by `grove init` from the `@grove` registry. The registry ships 35 domain components (`grove/`), 6 primitives (`ui/`), and 1 site chrome (`site/`), grouped into feature items (`shell`, `project-card`, `browse`, `record`, …). See [Components](/customize/components/) for the item list and the data contract. Override by editing the file directly:

```astro
---
// src/pages/index.astro — uses the registry-installed ProjectCard
import ProjectCard from "../components/grove/project-card.astro";
---
```

Edit `src/components/grove/project-card.astro` to override. `grove update` will see your edit and never overwrite it.

The override is a direct edit — open the file in `src/components/grove/`, change what you want, save. The next `grove update` will see your edit and never overwrite it. To throw the edit away and go back to upstream, `npx shadcn@latest add @grove/project-card --overwrite` reinstalls that item's files. See [Components](/customize/components/) for the data contract.

## 4. Styling

Three layers, increasing effort:

1. **`grove.config.ts` `theme` block** — primary color, radius, density, container width. See [Theme](/customize/theme/).
2. **`src/styles/global.css`** — override `--grove-*` design tokens or add custom rules. The Astro integration auto-loads this file if it exists (`packages/astro/src/index.ts`) — no manual `<style>` import needed, and `grove update` never touches it.

   Do **not** put `@import "tailwindcss";` in it. `src/styles/system.css` already imports Tailwind, and Tailwind v4's Vite plugin treats every file that imports it as a separate entry point — so a second import emits a second complete Tailwind build (~35 KB on the reference site) that every page downloads on top of the first. Add the import only if this file needs `@apply` or `theme()`, and accept the duplicate build if so.
3. **Tailwind** — already installed and wired in the scaffold (`@tailwindcss/vite` in `astro.config.mjs`, `@import "tailwindcss";` in `src/styles/system.css`), not an opt-in step. Use its utilities directly in your own components.

## What NOT to customize

- **`health` entries in `data/health.yml`** (or a record's inline `health:` block) — `classifyHealth()` is the single source of truth for the rules, but no shipped command runs it: `grove sync github` writes only `github.*` and never touches health. Entries are hand-authored or produced by your own script that imports `classifyHealth` from `@grove-dev/core`. See [Health classification](/content/health-classification/).
- **`github` block in record YAMLs** — derived from the GitHub API by `grove sync github`.
- **`data/generated/*.json`** — regenerated by `grove check`; hand edits are overwritten.
- **Anything in `node_modules/`** — replaced on the next install.

If a customization requires editing these, open an issue — the schema might be missing a field you actually need.

## Verifying changes

After any non-trivial change:

1. `pnpm exec grove check` — schema check, generation, sitemap, llms, og-image, `astro check`.
2. `pnpm dev` — manual smoke test. Browse home, index, a few detail pages.
3. `pnpm build` — full build.
4. `npx serve dist` — check the production output.

If any step fails, the error is usually in the same place you last edited.

## Related

- [Branding](/customize/branding/) — site identity
- [Theme](/customize/theme/) — colour tokens
- [Components](/customize/components/) — override pattern
- [Custom pages](/customize/pages/) — adding new pages