---
title: grove.config.ts
description: Every field in the space's grove.config.ts, with type, default, and a worked example.
---

`grove.config.ts` is the single source of truth for a Grove space.
It is loaded by the CLI (via `jiti` so you can use TypeScript
without a build step) and consumed by the renderer to know which
blueprint to use, which integrations to enable, and where to find
data files.

This page documents every field, every default, and shows both a
**minimal** and a **full** config.

## Minimal config

The smallest viable config. The CLI scaffolds this for you.

```ts
// grove.config.ts
import { defineConfig } from "@grove-dev/core";

export default defineConfig({
  blueprint: "project-directory",

  site: {
    name: "My Space",
  },

  integrations: { github: false },

  browse: { facets: ["category", "tags"] },
});
```

That is enough to run `grove check`. The default theme and paths
are used.

## Full config

Every optional field, set explicitly.

```ts
// grove.config.ts
import { defineConfig } from "@grove-dev/core";

export default defineConfig({
  // The blueprint: which record kind this space accepts.
  // V1: "project-directory" | "resource-hub" | "ecosystem-map"
  blueprint: "project-directory",

  site: {
    name: "Open Apps",
    tagline: "Production-ready open-source applications.",
    description:
      "A curated, health-aware directory of open-source apps.",
    url: "https://openapps.example.com",
    repoUrl: "https://github.com/example/open-apps",
  },

  analytics: {
    googleAnalyticsId: "G-XXXXXXXXXX",
  },

  nav: [
    { label: "Home", href: "/" },
    { label: "Browse", href: "/projects" },
    { label: "About", href: "/about" },
    { label: "Submit", href: "/submit" },
  ],

  footer: {
    columns: [
      {
        heading: "Discover",
        items: [
          { label: "Browse", href: "/projects" },
          { label: "About", href: "/about" },
        ],
      },
      {
        heading: "Project",
        items: [
          { label: "Source", href: "https://github.com/example/open-apps", external: true },
        ],
      },
    ],
    copyright: "Open Apps contributors",
    license: "Content under CC BY-SA 4.0.",
  },

  submission: {
    eyebrow: "Project submission",
    title: "Suggest an open-source project",
    description: "Generate a record, review it, and open a pull request.",
    good: ["Public source and a clear license"],
    avoid: ["Duplicates and marketing-only pages"],
  },

  routes: {
    directory: "projects",
    item: "project",
  },

  labels: {
    singular: "project",
    plural: "projects",
  },

  browse: {
    facets: ["category", "stack", "platform", "tags"],
  },

  integrations: {
    // Either a boolean (enable/disable GitHub integration)
    // or a partial object (enable specific sub-features).
    github: {
      metadata: true,    // gates `grove sync github`
      contributors: false, // gates `grove sync contributors`
      health: true,      // derive data/health.yml during `sync github`
    },
  },

  theme: {
    radius: "soft",          // "none" | "soft" | "round"
    density: "comfortable",  // "compact" | "comfortable" | "spacious"
    containerWidth: "72rem",
  },

  contributors: {
    showContributionCount: true,
  },

  audit: {
    baseUrl: "http://127.0.0.1:4321",
    pages: [
      { path: "/", type: "home", label: "Home" },
      { path: "/projects/", type: "directory", label: "Projects" },
    ],
  },

  readme: {
    title: "Open Apps",
    showBadge: true,
    showToc: true,
    showBrowseLink: true,
  },

  paths: {
    dataDir: "data",
    contentDir: "content",
    recordsDir: "data/records",
    pagesDir: "content/pages",
    bodiesDir: "content/records",
    publicDir: "public",
    taxonomyDir: "data/taxonomy",
    generatedDir: "data/generated",
    health: "data/health.yml",
    decisions: "data/decisions.yml",
    overrides: "data/overrides.yml",
  },
});
```

## Field reference

### `blueprint`

**Type:** `"project-directory" | "resource-hub" | "ecosystem-map"`
**Default:** `"project-directory"`

The schema accepts all three values, but only `"project-directory"`
is supported today. Determines the record kind (`project` /
`resource` / `entity`) and the schema. See
[Record schema](/reference/record-schema/).

### `site`

**Type:** `object` (required; `name` is required, others optional)

| Field | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | required | The site's display name. Shown in titles, headers, OG tags. |
| `tagline` | `string` | `"A growing community knowledge site."` | One-sentence tagline. Shown in the hero. |
| `description` | `string` | `undefined` | Longer description. Used for `<meta name="description">` and `llms.txt`. |
| `url` | `string` (URL) | `undefined` | The canonical site URL. Used in `sitemap.xml` and OG tags. |
| `repoUrl` | `string` (URL) | `undefined` | The space's GitHub repo URL. Used in the "view source" link and PR templates. |
| `locale` | `string` (BCP-47) | `"en"` | Site language. Drives `<html lang>`, `og:locale`, and JSON-LD `inLanguage`. |
| `twitter` | `string` | `undefined` | Twitter/X handle (e.g. `@myproject`). Emitted as `twitter:site` on every page. |

### `analytics`

**Type:** `object` (optional)
**Default:** `{}`

| Field | Type | Default | Description |
|---|---|---|---|
| `googleAnalyticsId` | `string`, must match `/^G-[A-Z0-9]+$/` | `undefined` | GA4 measurement ID (e.g. `G-XXXXXX`). Wired into `BaseLayout` as `site.analytics.googleAnalyticsId`; a per-page `gaId` prop can override it. Omit both to ship without Google Analytics. |

### `nav`

**Type:** `Array<{ label: string; href: string }>`
**Default:** `[]`

Top-navigation items, in order. Each item has a `label` (visible
text) and an `href` (link target; can be a relative path or a full
URL).

### `browse.facets`

**Type:** `Array<string>`
**Default:** `["category", "tags"]`

Which browse dimensions the site exposes, and in what order. The array order
is the filter-group render order on the browse page. Supported ids are exactly
`category`, `stack`, `platform`, `tags`, and `license` — canonical spellings
only. Unknown ids, plural spellings, and duplicates fail config validation
instead of being silently dropped.

Option values, display names, and option order come from
`data/taxonomy/*.yml` (see [Taxonomy files](/content/taxonomy-files/)). Tags
come from each record and stay a separate many-to-many facet; add
`data/taxonomy/topics.yml` to curate which tags the Tag filter offers.

> **Migration:** the former top-level `facets` key was replaced by
> `browse.facets` in a clean break. A leftover top-level `facets` key fails
> validation with a pointed error.

### `footer`

Configures up to three footer link columns plus the copyright and license copy.
Each item has `label`, `href`, and optional `external: true`. When `columns` is
empty, Grove derives useful repository links.

`poweredBy` (default `true`) renders a "Powered by Grove" link under the footer
brand block. Set it to `false` to drop the attribution. The same mark is
available as a component — `@grove-dev/astro/components/PoweredBy.astro` — for
placing it anywhere else on the page, including `Hero`'s `eyebrow` slot.

### `submission`

Customizes the default submit page without forking it. `eyebrow`, `title`, and
`description` control the introduction; `good` and `avoid` control the review
criteria. The form renders only taxonomy fields enabled by `browse.facets`.

### `routes`

**Type:** `object` (optional)
**Default:** `{}`

| Field | Type | Default | Description |
|---|---|---|---|
| `directory` | `string` | derived from `blueprint` (`project-directory` → `"projects"`) | URL slug for the listing route, e.g. `/projects/`. Overriding it doesn't change behavior for other blueprints today since only `project-directory` is supported. |
| `item` | `string` | derived from the record kind (`"project"` for `project-directory`) | Slug fragment used for single-record routes/labels (e.g. "Submit a project"). |

Both fields fall back to the blueprint's built-in slug when unset,
and to `"items"` / `"item"` if the blueprint isn't recognized.

### `labels`

**Type:** `object` (optional)
**Default:** `{}`

| Field | Type | Default | Description |
|---|---|---|---|
| `singular` | `string` | derived from `blueprint` (`"project"` for `project-directory`) | Singular display noun, used in copy like "Submit a project". |
| `plural` | `string` | derived from `blueprint` (`"projects"` for `project-directory`) | Plural display noun, used in copy like "Browse projects", the OG image caption, and `llms.txt`. |

Set either field to rename the noun the templates use throughout the
site (e.g. `singular: "guide"`, `plural: "guides"`) without forking
any component.

### `integrations.github`

**Type:** `boolean | { metadata?: boolean; contributors?: boolean; health?: boolean }`
**Default:** `false`

Enables the GitHub integration. Three modes:

- `false` — disabled. No GitHub API calls.
- `true` — enable all sub-features (equivalent to
  `{ metadata: true, contributors: true, health: true }`).
- `{ metadata, contributors, health }` — pick which sub-features
  to enable.

`metadata` and `contributors` are real gates: with either set to `false`,
the matching `grove sync` target prints `disabled by
integrations.github.<flag> — skipping` and exits without making a request.

`health` gates whether `grove sync github` also derives a health entry per
record — via `classifyHealth` — and writes them all to `data/health.yml` at
the end of the run. Leave it off and that file stays yours to author. See
[Maintain health signals](/content/health-classification/).

### `theme`

**Type:** `object`

| Field | Type | Default | Description |
|---|---|---|---|
| `primaryColor` | `string` (hex color) | *unset* | Optional brand color for buttons and accents. When unset, primary actions use the neutral ink treatment (near-black on light, near-white on dark). Text on the brand color is computed for WCAG AA automatically. |
| `radius` | `"none" \| "soft" \| "round"` | `"soft"` | Border-radius scale. `none` = sharp, `soft` = subtle, `round` = pill. |
| `density` | `"compact" \| "comfortable" \| "spacious"` | `"comfortable"` | Vertical spacing density. |
| `containerWidth` | `string` (CSS length) | `"72rem"` | Max width of the content container. |

### `contributors`

**Type:** `object` (optional)
**Default:** `{ showContributionCount: true }`

| Field | Type | Default | Description |
|---|---|---|---|
| `showContributionCount` | `boolean` | `true` | Whether each contributor tile on the contributors page shows its per-user commit/PR count (e.g. "12 contributions"). Set `false` for a quieter card on sites that don't want to surface contributor activity. |

This only affects display; it doesn't gate the sync itself — that's
`integrations.github.contributors`, which controls whether
`grove sync contributors` runs at all. See
[Sync contributors](/automation/sync-contributors/).

### `audit`

**Type:** `object` (optional — omit it and `grove audit` has nothing to run)

| Field | Type | Default | Description |
|---|---|---|---|
| `baseUrl` | `string` (URL) | `undefined` | Base URL the audit runs against. Overridable per-run with `grove audit --base-url <url>`; falls back to `http://127.0.0.1:4321` if neither is set. |
| `pages` | `Array<PageManifestEntry>`, at least 1 entry required if `audit` is set | — | The manifest of pages `grove audit` scores. |

Each entry in `pages[]`:

| Field | Type | Default | Description |
|---|---|---|---|
| `path` | `string`, non-empty | required | The page path to audit, e.g. `/projects/`. |
| `type` | `"home" \| "directory" \| "collection" \| "record" \| "content" \| "empty" \| "404"` | required | The page kind, used to pick budget/reporting behavior (404 pages are scored but excluded from the pass/fail budget). |
| `label` | `string`, non-empty | required | Human-readable label shown in audit output. |
| `sample` | `Record<string, string>` | `undefined` | Optional sample route params, for pages whose path is a template. |

```ts
audit: {
  baseUrl: "http://127.0.0.1:4321",
  pages: [
    { path: "/", type: "home", label: "Home" },
    { path: "/projects/", type: "directory", label: "Projects" },
    { path: "/404", type: "404", label: "Not found" },
  ],
},
```

See [Reference: audit automation](/automation/audit/) for how the
budget itself (scores, LCP, CLS, TBT thresholds) is evaluated — the
default budget lives in `packages/core/src/audit.ts`, not in this
schema.

### `readme`

**Type:** `object` (optional)

Overrides the awesome-list preamble `grove readme generate` renders.
Every field is optional; an unset field falls back to the matching
`site.*` field, or to a schema default.

| Field | Type | Default | Description |
|---|---|---|---|
| `title` | `string`, non-empty | falls back to `site.name` | README H1. |
| `tagline` | `string` | falls back to `site.tagline` | Line under the title. |
| `description` | `string` | falls back to `site.description` | Longer preamble text. |
| `url` | `string` (URL) | falls back to `site.url` | Canonical link rendered in the preamble. |
| `browseLabel` | `string`, non-empty | `undefined` | Label for the "browse the catalog" link. |
| `intro` | `string` | `undefined` | Raw markdown rendered between the H1 and the `## Contents` TOC — sub-headings, paragraphs, lists all work. |
| `showBadge` | `boolean` | `true` | Show the sindresorhus-style "awesome" badge. |
| `showToc` | `boolean` | `true` | Show the `## Contents` section. |
| `showBrowseLink` | `boolean` | `true` | Show the "browse the catalog" link. |

```ts
readme: {
  title: "Awesome Open-Source AI Tools",
  tagline: "Hand-picked tools worth running, studying, and extending.",
  intro: "## Why this list\n\nEach entry is curated by the maintainers.",
  showBadge: true,
  showToc: true,
  showBrowseLink: true,
},
```

See [README generation](/automation/readme/) for the full rendered
output and the sentinel-block mechanics.

### `paths`

**Type:** `object`

Filesystem layout. Every field has a default; override only what
you need.

| Field | Default | Description |
|---|---|---|
| `dataDir` | `"data"` | Root for all data files |
| `contentDir` | `"content"` | Root for Markdown content |
| `recordsDir` | `"data/records"` | Where record YAML files live |
| `pagesDir` | `"content/pages"` | The scaffold ships `about.astro`, `contributors.astro`, `submit.astro`, and `404.astro` as Astro components under `src/pages/`. The `content/pages/` directory is reserved for consumer-authored Markdown content pages. |
| `bodiesDir` | `"content/records"` | Optional Markdown body per record (referenced by `content:`) |
| `publicDir` | `"public"` | Static assets served as-is |
| `taxonomyDir` | `"data/taxonomy"` | Controlled category, stack, platform, and distribution-channel values |
| `generatedDir` | `"data/generated"` | Auto-generated JSON; gitignored |
| `health` | `"data/health.yml"` | Legacy health file (gitignored by default) |
| `decisions` | `"data/decisions.yml"` | Human curation decisions |
| `overrides` | `"data/overrides.yml"` | Manual patches for imported records |

The `health` path is legacy; in V1 the canonical health signal
lives on each record (the `health:` block) and is derived from
`grove sync github` + `data/decisions.yml`. The `health.yml` file
is still read for backward compatibility but is not written by
any V1 command.

## Type-safe config

Use `defineConfig` from `@grove-dev/core`. It provides TypeScript
types and Zod validation, so misspelled fields or wrong types fail
at config-load time, not at the first `grove check` run.

```ts
import { defineConfig } from "@grove-dev/core";

export default defineConfig({
  // TypeScript will autocomplete fields and reject unknown ones.
});
```

If you write the config as a plain object literal without
`defineConfig`, the renderer will still load it, but you lose
type safety.

## Related docs

- **[CLI reference](/reference/cli/)** — every command reads from
  and writes to the paths declared here.
- **[Record schema](/reference/record-schema/)** — what the
  records in `recordsDir` look like.
- **[Record schema](/reference/record-schema/)** — which `blueprint`
  value to pick.
