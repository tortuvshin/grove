---
title: Customize the Astro template
description: How to add pages, swap design tokens, change the data layout, and override components — without forking the template.
---

The Astro template shipped by `grove new` is a starting point. This guide is for site operators who need to change the look, the structure, or the data layout of their directory.

Most customizations fall into three buckets:

1. **Configuration** — change `grove.config.ts` to swap themes, facets, or integration modes.
2. **Content** — add a new page, add a body to a record, or change a copy block.
3. **Components** — override a header, footer, hero, or item card with your own.

Each is a different kind of edit, with a different blast radius. Start with config; only move to components if config can't do it.

## 1. Configuration: `grove.config.ts`

The single file at the repo root. The schema is `groveConfigSchema` in `packages/core/src/schema.ts`. The fields you will change most often:

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
    { label: "Submit", href: "/submit" },
  ],
  facets: ["category", "stacks", "platforms", "tags"],
  theme: {
    primaryColor: "#0ea5e9",   // any CSS color
    radius: "soft",            // "none" | "soft" | "round"
    density: "comfortable",    // "compact" | "comfortable" | "spacious"
    containerWidth: "80rem",
  },
  integrations: {
    github: true,              // enables sync + cleanup workflows
  },
  paths: {
    recordsDir: "data/records",
    // ...defaults shown in reference/config
  },
});
```

`theme.primaryColor` is consumed by the Tailwind config and rendered as the accent on links, chips, and CTAs. `theme.radius` is a small, medium, or large border-radius scale. `theme.density` is the vertical rhythm — `compact` packs more rows into the index, `spacious` gives cards more breathing room.

After editing `grove.config.ts`, restart `pnpm dev` (the config is read at boot, not hot-reloaded). For a production build, no restart — `astro build` reads it at build time.

See the [grove.config.ts reference](/reference/config/) for the full field list and defaults.

## 2. Content: pages, bodies, copy

The template ships with four pages: `index.astro` (home), `projects/index.astro` (the list), `projects/[slug].astro` (the detail), `about.astro`, `submit.astro`. The default `astro.config.mjs` has the build configured with `format: 'directory'`, so `pnpm build` produces a static `dist/` with one HTML file per route.

### Adding a new page

Create a new file under `src/pages/`. Astro file-based routing applies. A "Changelog" page, for example:

```astro
---
// src/pages/changelog.astro
import BaseLayout from "../components/layout/BaseLayout.astro";
---
<BaseLayout title="Changelog">
  <h1>Changelog</h1>
  <p>This directory was last updated on 2025-10-12.</p>
</BaseLayout>
```

Then add a nav link:

```ts
// grove.config.ts
nav: [
  // ...
  { label: "Changelog", href: "/changelog" },
],
```

That's it. The page will be built and linked from the header.

### Adding a body to a record

Records can have a long-form markdown body. Add a `content` path to the record's YAML:

```yaml
# data/records/astro.yml
content: ./bodies/astro.md
```

The path is relative to the template's `contentDir` (default `content/records/`). Write the body in markdown — the detail page renders it below the curated fields.

If you want a body for *every* record, see `paths.bodiesDir` in the config. The default is `content/records/`, but you can point it anywhere.

### Editing copy

Static copy in the template lives in two places:

- **`BaseLayout.astro` and `Header.astro` / `Footer.astro`** — the chrome. Edit these directly. They are template files, not generated.
- **Page-level strings** — `index.astro`, `about.astro`, etc. Same — edit directly.

The `site.name` and `site.tagline` flow into the header and home page automatically, so most operators don't need to touch the chrome files.

## 3. Components: overriding the defaults

The template exposes five override points. They are template files you can replace with your own:

- `Header` — the top bar
- `Footer` — the bottom
- `Hero` — the home page hero
- `ItemCard` — the card used in the project / resource / entity list
- `DetailHeader` — the header on the detail page

Two ways to override:

### Option A: edit the template file in place

The components live at `packages/astro/src/components/`. Editing them in your scaffolded project requires either editing the installed files (which the package manager will overwrite on the next install) or forking the package.

This is the wrong approach for almost all sites. It works for forks; it does not survive upgrades.

### Option B: register an override in `grove.config.ts`

```ts
// grove.config.ts
import MyHeader from "./src/components/MyHeader.astro";

export default defineConfig({
  // ...
  components: {
    Header: "./src/components/MyHeader.astro",
  },
});
```

The Astro adapter resolves the path at build time. The override is local to your repo, so it survives `pnpm install`.

The override component must accept the same props as the original. Check the original component for the prop list — the contract is not formally versioned in V1.

## 4. Data layout: changing where records live

If you want to split records across multiple directories (e.g., `data/records/featured/` and `data/records/community/`), edit `paths.recordsDir` — but note that the V1 reader expects a single flat directory. Multi-dir records are a V2 feature; for now, if you split the data, you'll need a custom `grove generate` step to merge them.

For most sites, the default `data/records/` is fine. Leave it alone unless you have a strong reason.

## 5. Styling: changing the look

Three layers, in increasing order of effort:

1. **`grove.config.ts` `theme` block** — primary color, radius scale, density, container width. No code changes.
2. **`tailwind.config.mjs`** — color palette, font stack, keyframes, max-widths. Requires a `pnpm dev` restart.
3. **`src/styles/global.css`** — global CSS that Tailwind doesn't cover (custom utilities, third-party CSS resets). Edit directly.

The Tailwind config is a working file, not a generated one — your edits persist. The `darkMode: 'class'` setting means the dark/light toggle is a `class` on `<html>`, so adding a theme switcher is just a `document.documentElement.classList.toggle('dark')`.

## What you should *not* customize

- **The `health` block in record YAMLs.** It's auto-derived. See [Sync GitHub metadata](/guides/sync-github-metadata/).
- **The `github` block in record YAMLs.** Same — derived from the GitHub API.
- **`data/generated/records.index.json` and `data/generated/records.full.json`.** These are regenerated on every `grove generate` run. Hand edits will be overwritten.
- **Anything in `node_modules/`.** It will be replaced on the next install.

If a customization feels like it requires editing these, write a [decision](/guides/manage-decisions/) or open an issue — the schema might be missing a field you actually need.

## When to fork the template

If you need to change something *structural* — a new page type, a different list layout, an integration with a third-party service — the right move is to copy the Astro template files into your project and edit them. The `grove new` flow gives you a fresh copy; once you've shipped your changes, treat the template as yours.

The `packages/astro` package is the *upstream* template. Most sites should not edit it. If you find yourself wanting to, the right next step is to copy the relevant files into your project and `import` from the local path.

## Verifying your customizations

After any non-trivial change, run through this checklist:

1. `pnpm validate` — schema check. Catches typos in your edits to `grove.config.ts` or record YAMLs.
2. `pnpm generate` — refreshes the index payload from the records dir.
3. `pnpm dev` — manual smoke test. Browse the home page, the index, a few detail pages.
4. `pnpm build` — full build, including sitemap and llms.txt.
5. Open `dist/` in a static server (`npx serve dist`) and check the production output.

If any of those fail, the error is usually in the same place you last edited. The build doesn't mask issues; it surfaces them.
