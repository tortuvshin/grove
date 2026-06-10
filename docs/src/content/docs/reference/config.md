---
title: grove.config.ts
description: Every field in the space's grove.config.ts, with type, default, and a worked example.
---

`grove.config.ts` is the space's single source of truth for identity.
It declares the blueprint, the site's name and tagline, the navigation
overrides, the theme tokens, the path conventions, and which
integrations are enabled.

The config is loaded by the CLI on every command and by the build
pipeline on every build. It is the only file that ties the data,
the theme, and the framework adapter together.

## File location

`grove.config.ts` lives at the **root** of the space, next to
`package.json`. The CLI searches for it by walking up from the
current working directory until it finds a file matching
`grove.config.{ts,js,mjs,cjs}`.

## The shape

The full schema, as Zod:

```ts
import { defineGroveConfig } from '@grove-dev/core';

export default defineGroveConfig({
    blueprint: 'project-directory',
    site: {
        name: 'Open Apps',
        tagline: 'Production-ready open-source applications.',
        description: '...',
        url: 'https://apps.grove.dev',
        repoUrl: 'https://github.com/grove-dev/open-apps',
    },
    nav: [
        { label: 'About', href: '/about/' },
        { label: 'Methodology', href: '/methodology/' },
    ],
    facets: ['category', 'tags'],
    integrations: {
        github: {
            metadata: true,
            contributors: false,
            health: true,
        },
    },
    theme: {
        primaryColor: '#16a34a',
        radius: 'soft',
        density: 'comfortable',
        containerWidth: '72rem',
    },
    components: {
        Header: './src/components/MyHeader.astro',
        Footer: './src/components/MyFooter.astro',
    },
    paths: {
        dataDir: 'data',
        contentDir: 'content',
        recordsDir: 'data/records',
        pagesDir: 'content/pages',
        bodiesDir: 'content/records',
        publicDir: 'public',
        taxonomyDir: 'data/taxonomy',
        generatedDir: 'data/generated',
        health: 'data/health.yml',
        decisions: 'data/decisions.yml',
        overrides: 'data/overrides.yml',
    },
});
```

Every field is optional except `blueprint` and `site.name`. Sensible
defaults are applied for the rest. A bare-minimum config looks like:

```ts
import { defineGroveConfig } from '@grove-dev/core';

export default defineGroveConfig({
    blueprint: 'project-directory',
    site: { name: 'My Space' },
});
```

## Field reference

### `blueprint`

**Type:** `'project-directory' | 'resource-hub' | 'ecosystem-map'`
**Default:** `'project-directory'`

The blueprint binds the space to a single `kind` discriminator and
record schema. The CLI rejects unknown values. To change a space's
blueprint, edit this field and re-run `grove validate` to find the
records that no longer fit.

See [Spaces & blueprints](/guides/spaces/) for the high-level
differences and [Resource schema](/reference/schema/) for the
field-by-field reference.

### `site.name`

**Type:** `string` (required)

The display name of the space. Shown in the header, the page title,
the sitemap, and the `llms.txt` index. Keep it short — it appears in
the corner of every page.

### `site.tagline`

**Type:** `string`
**Default:** `'A growing community knowledge site.'`

A one-sentence positioning line. Shown in the hero, the meta
description, and the OG image. Match the README's hero line if you
have one — they should reinforce, not contradict.

### `site.description`

**Type:** `string` (optional)

A longer (one paragraph) description of the space. Shown on the
`/about/` page and in the meta description. Optional — the CLI falls
back to the tagline.

### `site.url`

**Type:** `string` (URL, optional)

The canonical URL of the deployed site. Used to build absolute URLs
in the sitemap, the RSS feed, and the OG image. If you deploy to a
custom domain, set this; if you deploy to a GitHub Pages URL, set the
full `https://<org>.github.io/<repo>/` form.

### `site.repoUrl`

**Type:** `string` (URL, optional)

The URL of the space's repository. Surfaced as a "View source" link
in the footer and used by the GitHub integration to scope API
requests. Optional but recommended for community spaces.

### `nav`

**Type:** `Array<{ label: string; href: string }>`
**Default:** `[]`

Top-level navigation links shown in the header, after the index
links. Each item is a flat `{ label, href }` pair. The framework
auto-generates the index links (browse, search, the index pages) —
use `nav` to add pages authored in `content/pages/`.

**Example:**

```ts
nav: [
    { label: 'About', href: '/about/' },
    { label: 'Methodology', href: '/methodology/' },
    { label: 'Contribute', href: '/contribute/' },
],
```

### `facets`

**Type:** `string[]`
**Default:** `['category', 'tags']`

The field names exposed as filter facets on the browse and detail
pages. The framework ships facet renderers for `category`, `tags`,
`topic` (on `resource` records), `stack`, `platforms`,
`projectType`, `bestFor`. Custom facets are supported but require a
custom renderer — see [Custom facets](#custom-facets) below.

### `integrations.github`

**Type:** `boolean | { metadata: boolean; contributors: boolean; health: boolean }`
**Default:** `false`

Whether the space uses the optional GitHub integration. The
integration has three sub-flags:

- `metadata` — enable `grove sync github` and store GitHub
  repository metadata in each record's `github: { repository: ... }`
  block.
- `contributors` — enable contributor enrichment. V1 does not
  implement this; the flag is reserved for Wave 2.
- `health` — write the derived `data/health.yml` to a git-tracked
  file. Without this flag, `data/health.yml` is gitignored and
  regenerated on every build.

**Examples:**

```ts
// Disable GitHub integration entirely (private spaces, no token)
integrations: { github: false }

// Public community space with metadata + health
integrations: { github: { metadata: true, health: true } }

// Full public mode (Wave 2+)
integrations: { github: { metadata: true, contributors: true, health: true } }
```

### `theme`

**Type:** `Theme`
**Default:** see below

The space's visual identity. Five fields, all optional:

- `primaryColor` — accent color, default `#16a34a` (Grove green).
- `radius` — corner radius for cards and buttons. One of `none`,
  `soft`, `round`. Default `soft`.
- `density` — vertical padding. One of `compact`, `comfortable`,
  `spacious`. Default `comfortable`.
- `containerWidth` — max width of the main content column. Default
  `72rem`.

**Example:**

```ts
theme: {
    primaryColor: '#2563eb', // blue accent
    radius: 'round',
    density: 'spacious',
    containerWidth: '80rem',
},
```

### `components`

**Type:** `{ Header?, Footer?, Hero?, ItemCard?, DetailHeader? }`
**Default:** `{}`

Per-space component overrides. Each value is a path to an Astro
component that the framework will use in place of the default
implementation. Useful for spaces that want to ship a different
header, footer, hero, list card, or detail header without forking the
whole template.

**Example:**

```ts
components: {
    Header: './src/components/Header.astro',
    Footer: './src/components/Footer.astro',
},
```

### `paths`

**Type:** `Paths`
**Default:** see below

Override the file-system layout. Every field has a sensible default
and most spaces leave this section empty. Use it to:

- Nest data under a subdirectory (e.g. `paths.dataDir: 'src/data'`).
- Move the records directory (e.g. `paths.recordsDir:
  'content/resources'`).
- Reuse an existing taxonomy file from another project.

**Default paths:**

```ts
paths: {
    dataDir: 'data',
    contentDir: 'content',
    recordsDir: 'data/records',
    pagesDir: 'content/pages',
    bodiesDir: 'content/records',
    publicDir: 'public',
    taxonomyDir: 'data/taxonomy',
    generatedDir: 'data/generated',
    health: 'data/health.yml',
    decisions: 'data/decisions.yml',
    overrides: 'data/overrides.yml',
}
```

The `paths.generatedDir` and `paths.health` paths are always
gitignored by default. To pin a specific health snapshot, set
`integrations.github.health: true` and `paths.health` becomes a
regular tracked file.

## Defining the config

The `defineGroveConfig` helper from `@grove-dev/core` is the
recommended way to write the config. It applies the defaults and
gives the IDE the full TypeScript type:

```ts
import { defineGroveConfig } from '@grove-dev/core';

export default defineGroveConfig({
    // ...
});
```

If you prefer, you can export a plain object:

```ts
export default {
    blueprint: 'project-directory',
    site: { name: 'My Space' },
};
```

The CLI accepts both shapes. The `defineGroveConfig` helper is just
a typed pass-through that returns the same object.

## Custom facets

The default facet renderers handle `category`, `tags`, `topic`,
`stack`, `platforms`, `projectType`, and `bestFor`. To expose a
field that does not have a built-in renderer — say, a `language`
field on a project record — write a custom Astro component that
filters the records index, and use a route like `/<facet>/` to
expose it.

Custom facets are not configured in `grove.config.ts`; they are
implemented as Astro routes that consume the generated index file.
See the framework adapter documentation for the route conventions.

## Validation

The config is validated by the same Zod schema the CLI uses. If a
field has the wrong type or an unknown enum value, the CLI prints
the issue with a path to the offending field:

```txt
✖ config.integrations.github.metadata: Expected boolean, received string.
```

A misconfigured `grove.config.ts` is a hard error — the CLI exits
non-zero and the build does not start.

## What to read next

- **[The data model](/guides/data-model/)** — what the data files
  the config points at actually look like.
- **[Resource schema](/reference/schema/)** — the field-by-field
  reference for the discriminated `Resource` union.
- **[CLI reference](/reference/cli/)** — every command that consumes
  this config.
