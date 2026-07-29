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

  facets: ["category", "tags"],
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

  facets: ["category", "stack", "platform", "tags"],

  integrations: {
    // Either a boolean (enable/disable GitHub integration)
    // or a partial object (enable specific sub-features).
    github: {
      metadata: true,    // fetch stars, forks, last commit, etc.
      contributors: false, // (V1.1 — not yet implemented)
      health: true,      // derive health.status from metadata
    },
  },

  theme: {
    primaryColor: "#16a34a",
    radius: "soft",          // "none" | "soft" | "round"
    density: "comfortable",  // "compact" | "comfortable" | "spacious"
    containerWidth: "72rem",
  },

  components: {
    // Override default Astro components with custom ones.
    Header: "./src/components/MyHeader.astro",
    Footer: undefined,
    Hero: undefined,
    ItemCard: undefined,
    DetailHeader: undefined,
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

Which blueprint this space follows. Determines the record kind
(`project` / `resource` / `entity`) and the schema. See
[Blueprints](/concepts/blueprints/).

### `site`

**Type:** `object` (required; `name` is required, others optional)

| Field | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | required | The site's display name. Shown in titles, headers, OG tags. |
| `tagline` | `string` | `"A growing community knowledge site."` | One-sentence tagline. Shown in the hero. |
| `description` | `string` | `undefined` | Longer description. Used for `<meta name="description">` and `llms.txt`. |
| `url` | `string` (URL) | `undefined` | The canonical site URL. Used in `sitemap.xml` and OG tags. |
| `repoUrl` | `string` (URL) | `undefined` | The space's GitHub repo URL. Used in the "view source" link and PR templates. |

### `nav`

**Type:** `Array<{ label: string; href: string }>`
**Default:** `[]`

Top-navigation items, in order. Each item has a `label` (visible
text) and an `href` (link target; can be a relative path or a full
URL).

### `facets`

**Type:** `Array<string>`
**Default:** `["category", "tags"]`

Which record fields the browse and submission pages expose. Supported values
are `category`, `stack`, `platform`, `tags`, and `license`; plural aliases are
accepted for compatibility. Category, stack, and platform values come from
`data/taxonomy/*.yml`. Tags come from each record and stay a separate
many-to-many facet rather than being promoted into the taxonomy.

### `footer`

Configures up to three footer link columns plus the copyright and license copy.
Each item has `label`, `href`, and optional `external: true`. When `columns` is
empty, Grove derives useful repository links.

### `submission`

Customizes the default submit page without forking it. `eyebrow`, `title`, and
`description` control the introduction; `good` and `avoid` control the review
criteria. The form renders only taxonomy fields enabled by `facets`.

### `integrations.github`

**Type:** `boolean | { metadata?: boolean; contributors?: boolean; health?: boolean }`
**Default:** `false`

Enables the GitHub integration. Three modes:

- `false` — disabled. No GitHub API calls.
- `true` — enable all sub-features (equivalent to
  `{ metadata: true, contributors: true, health: true }`).
- `{ metadata, contributors, health }` — pick which sub-features
  to enable.

In v0.4.0, all three sub-features are implemented. `metadata`
powers `grove sync github`; `contributors` powers
`grove sync contributors`; `health` derives `health.status` from
the metadata on every render.

### `theme`

**Type:** `object`

| Field | Type | Default | Description |
|---|---|---|---|
| `primaryColor` | `string` (CSS color) | `"#16a34a"` | Primary brand color. Used for buttons, links, accents. |
| `radius` | `"none" \| "soft" \| "round"` | `"soft"` | Border-radius scale. `none` = sharp, `soft` = subtle, `round` = pill. |
| `density` | `"compact" \| "comfortable" \| "spacious"` | `"comfortable"` | Vertical spacing density. |
| `containerWidth` | `string` (CSS length) | `"72rem"` | Max width of the content container. |

### `components`

**Type:** `object`

Override the default Astro components for the site chrome and
record cards. Each value is a path to a `.astro` file (relative to
the project root).

| Field | Default component | What it renders |
|---|---|---|
| `Header` | `@grove-dev/astro`'s default | Top nav and site name |
| `Footer` | default | Footer with repo link, build info |
| `Hero` | default | The home-page hero (with tagline, CTAs) |
| `ItemCard` | default | A single record card in list views |
| `DetailHeader` | default | The header at the top of a record detail page |

Set a field to `undefined` (or omit it) to use the default.
Setting it to a path replaces the default with your component.

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
- **[Blueprints](/concepts/blueprints/)** — which `blueprint`
  value to pick.
