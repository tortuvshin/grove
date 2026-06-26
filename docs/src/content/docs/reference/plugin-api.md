---
title: Plugin API
description: Type-level reference for the @grove-dev/starlight plugin used by Grove docs.
---

## Import

```ts
import grove from '@grove-dev/starlight';
```

> The plugin's default export is also still importable as `lucode` for
> back-compat with V0 docs that pre-date the Grove rebrand. New code
> should import as `grove`.

Use the default export inside Starlight's `plugins` array:

```js
starlight({
  plugins: [grove()],
});
```

## `GroveStarlightUserConfig`

```ts
type GroveStarlightUserConfig = {
  navLinks?: Link[];
  docs?: { includeAiUtilities?: boolean };
  footerText?: string;
  warnOverrides?: boolean;
};

/** @deprecated Use GroveStarlightUserConfig. */
type LucodeStarlightUserConfig = GroveStarlightUserConfig;
```

### `navLinks`

Header navigation links rendered by the theme.

```ts
type Link = {
  label: string | Record<string, string>;
  link: string;
  badge?: string;
  attrs?: Record<string, string | number | boolean | undefined>;
};
```

```js
grove({
  navLinks: [
    { label: 'Docs', link: '/guides/getting-started/' },
    { label: 'API', link: '/reference/plugin-api/' },
    {
      label: 'GitHub',
      link: 'https://github.com/tortuvshin/grove',
      attrs: { target: '_blank', rel: 'noreferrer' },
    },
  ],
});
```

### `footerText`

Markdown rendered in the footer text slot.

```js
grove({
  footerText: 'Built by [grove](https://github.com/tortuvshin/grove). Released under the MIT License.',
});
```

If omitted, the theme uses its built-in credit line.

### `docs.includeAiUtilities`

Toggles a per-page AI utilities menu (ChatGPT and Claude) in the page header.

```js
grove({
  docs: { includeAiUtilities: true },
});
```

## Frontmatter Extension

Import `ExtendDocsSchema` from `@grove-dev/starlight/schema` and pass it to Starlight's `docsSchema()`.

```ts
import { ExtendDocsSchema } from '@grove-dev/starlight/schema';

schema: docsSchema({ extend: ExtendDocsSchema });
```

The extension adds:

```ts
type GroveDocsFrontmatter = {
  links?: {
    doc?: string;
    api?: string;
  };
  hero?: {
    layout?: 'centered' | 'centered-top' | 'split-left' | 'split-right' | 'banner';
    announcement?: { text: string; link: string };
    shadcn?: { actions: ShadcnAction[] };
  };
};

/** @deprecated Use GroveDocsFrontmatter. */
type LucodeDocsFrontmatter = GroveDocsFrontmatter;

type ShadcnAction = {
  text: string;
  link: string;
  variant?: 'default' | 'link' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  icon?: string;
  attrs?: Record<string, string | number | boolean>;
};
```

`hero.layout` defaults to `centered`.

## Package Exports

```ts
import lucode from '@grove-dev/starlight';
import { ExtendDocsSchema } from '@grove-dev/starlight/schema';
import { ContainerSection, LinkButton } from '@grove-dev/starlight/components';
```

The package also exports the internal Starlight override components and CSS files for advanced
composition:

- `@grove-dev/starlight/styles/layers`
- `@grove-dev/starlight/styles/theme`
- `@grove-dev/starlight/styles/base`
- `@grove-dev/starlight/components/overrides/Header.astro`
- `@grove-dev/starlight/components/overrides/Hero.astro`
- `@grove-dev/starlight/components/overrides/Footer.astro`

Prefer the plugin for normal sites. Reach for direct exports only when you are building a custom
integration or intentionally composing with one of the theme overrides.

## Grove Theme Wiring

`@grove-dev/docs` enables the Grove Starlight plugin with this configuration:

```js
// docs/astro.config.mjs
starlight({
  title: 'Grove',
  customCss: ['./src/styles/global.css'],
  lastUpdated: true,
  editLink: { baseUrl: 'https://github.com/tortuvshin/grove/edit/main/docs' },
  plugins: [
    grove({
      docs: { includeAiUtilities: true },
      navLinks: [
        { label: 'Docs', link: '/guides/getting-started/' },
        { label: 'Showcase', link: '/showcase/starlight-components/' },
        { label: 'GitHub', link: 'https://github.com/tortuvshin/grove' },
      ],
    }),
  ],
  sidebar: [
    /* ... */
  ],
});
```

If you fork the docs site, replace the GitHub links and the repo path on `editLink.baseUrl`.
