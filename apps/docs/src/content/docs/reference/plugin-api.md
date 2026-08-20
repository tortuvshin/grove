---
title: Plugin API
description: Type-level reference for the @grove-dev/starlight plugin used by Grove docs.
---

## Import

```ts
import grove from '@grove-dev/starlight';
```

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
  warnOverrides?: boolean;
  footerText?: string | Record<string, string>;
};
```

### `navLinks`

Header navigation links rendered by the theme.

```ts
type Link = {
  badge?: string;
  label: string | Record<string, string>;
  translations?: Record<string, string>;
  link: string;
  attrs?: Record<string, string | number | boolean | undefined>;
};
```

```js
grove({
  navLinks: [
    { label: 'Docs', link: '/introduction/' },
    { label: 'Roadmap', link: '/project/roadmap/' },
    { label: 'FAQ', link: '/project/faq/' },
    {
      label: 'GitHub',
      link: 'https://github.com/tortuvshin/grove',
      attrs: { target: '_blank', rel: 'noopener noreferrer' },
    },
  ],
});
```

### `footerText`

Markdown rendered in the footer text slot. Accepts a single string or, for multilingual sites, an
object keyed by locale.

```js
grove({
  footerText: 'Built by [grove](https://github.com/tortuvshin/grove). Released under the MIT License.',
});
```

If omitted, the theme falls back to its own built-in credit line crediting the themes it's built on.

### `docs.includeAiUtilities`

Toggles an "AI tools" dropdown (Open in ChatGPT / Open in Claude) next to the page title. Defaults
to `false`.

```js
grove({
  docs: { includeAiUtilities: true },
});
```

### `warnOverrides`

When `true` (the default), the plugin logs a warning if your own Starlight `components` config
already defines a component the theme would otherwise override, so you know why the theme override
didn't take effect. Set to `false` to silence those warnings.

## Frontmatter Extension

Import `ExtendDocsSchema` from `@grove-dev/starlight/schema` and pass it to Starlight's `docsSchema()`.

```ts
import { ExtendDocsSchema } from '@grove-dev/starlight/schema';

schema: docsSchema({ extend: ExtendDocsSchema });
```

The extension adds a `hero` block to frontmatter:

```ts
type GroveDocsFrontmatter = {
  hero?: {
    layout?: 'centered' | 'centered-top' | 'split-left' | 'split-right' | 'banner';
    announcement?: { text: string; link: string };
    actions?: Array<{
      text: string;
      link: string;
      variant?:
        | 'default'
        | 'link'
        | 'secondary'
        | 'outline'
        | 'ghost'
        | 'destructive'
        | 'primary'
        | 'minimal';
      icon?: string;
      attrs?: Record<string, string | number | boolean>;
    }>;
  };
};
```

`hero.layout` defaults to `centered`. `text`, `link`, `icon`, and `attrs` on each action come from
Starlight's own hero schema; the Grove extension only widens the `variant` enum. Starlight's own
`primary` and `minimal` values are accepted as aliases of `default` and `ghost`, so hero frontmatter
written against Starlight's stock theme keeps working unchanged.

Requires `@astrojs/starlight >= 0.41.4`, the first version whose `docsSchema({ extend })`
deep-merges instead of intersecting — an intersection can't widen an enum Starlight already
declares.

If a page sets `hero` frontmatter but the site's `docsSchema()` was never extended with
`ExtendDocsSchema`, Starlight silently strips the extra fields and the build logs a warning
pointing back at this page.

## Package Exports

```ts
import grove from '@grove-dev/starlight';
import { ExtendDocsSchema } from '@grove-dev/starlight/schema';
import { ContainerSection, LinkButton, Dropdown } from '@grove-dev/starlight/components';
```

The package also exports its Starlight override components and CSS files for advanced composition:

- `@grove-dev/starlight/styles/layers`
- `@grove-dev/starlight/styles/theme`
- `@grove-dev/starlight/styles/base`
- `@grove-dev/starlight/components/overrides/Header.astro`
- `@grove-dev/starlight/components/overrides/Hero.astro`
- `@grove-dev/starlight/components/overrides/Footer.astro`
- and the other Starlight overrides listed in [Theme Components](/reference/components/#starlight-overrides)

Prefer the plugin for normal sites. Reach for direct exports only when you are building a custom
integration or intentionally composing with one of the theme overrides.

## Grove Theme Wiring

`@grove-dev/docs` enables the Grove Starlight plugin with this configuration:

```js
// apps/docs/astro.config.mjs
starlight({
  title: 'Grove',
  customCss: ['./src/styles/global.css'],
  editLink: {
    baseUrl: 'https://github.com/tortuvshin/grove/edit/main/apps/docs/src/content/docs',
  },
  plugins: [
    grove({
      docs: { includeAiUtilities: true },
      navLinks: [
        { label: 'Docs', link: '/introduction/' },
        { label: 'Roadmap', link: '/project/roadmap/' },
        { label: 'FAQ', link: '/project/faq/' },
        {
          label: 'GitHub',
          link: 'https://github.com/tortuvshin/grove',
          attrs: { target: '_blank', rel: 'noopener noreferrer' },
        },
      ],
    }),
  ],
  sidebar: [
    /* ... */
  ],
});
```

If you fork the docs site, replace the GitHub links and the repo path on `editLink.baseUrl`.
