---
title: Plugin API
description: Type-level reference for the @grove-dev/starlight plugin used by Grove docs.
---

## Import

```ts
import lucode from '@grove-dev/starlight';
```

Use the default export inside Starlight's `plugins` array:

```js
starlight({
  plugins: [lucode()],
});
```

## `LucodeStarlightUserConfig`

```ts
type LucodeStarlightUserConfig = {
  navLinks?: Link[];
  docs?: { includeAiUtilities?: boolean };
  footerText?: string;
  warnOverrides?: boolean;
};
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
lucode({
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
lucode({
  footerText: 'Built by [grove](https://github.com/grove-dev). Released under the MIT License.',
});
```

If omitted, the theme uses its built-in credit line.

### `docs.includeAiUtilities`

Toggles a per-page AI utilities menu (ChatGPT and Claude) in the page header.

```js
lucode({
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
type LucodeDocsFrontmatter = {
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

`@grove-dev/docs` enables the Lucode plugin with this configuration:

```js
// docs/astro.config.mjs
starlight({
  title: 'Grove',
  customCss: ['./src/styles/global.css'],
  lastUpdated: true,
  editLink: { baseUrl: 'https://github.com/tortuvshin/grove/edit/main/docs' },
  plugins: [
    lucode({
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
