---
title: Plugin API
description: Type-level reference for the lucode-starlight plugin used by Grove docs.
---

## Import

```ts
import lucode from 'lucode-starlight';
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
            link: 'https://github.com/grove-dev/grove',
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

Import `ExtendDocsSchema` from `lucode-starlight/schema` and pass it to Starlight's `docsSchema()`.

```ts
import { ExtendDocsSchema } from 'lucode-starlight/schema';

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
import lucode from 'lucode-starlight';
import { ExtendDocsSchema } from 'lucode-starlight/schema';
import { ContainerSection, LinkButton } from 'lucode-starlight/components';
```

The package also exports the internal Starlight override components and CSS files for advanced
composition:

- `lucode-starlight/styles/layers`
- `lucode-starlight/styles/theme`
- `lucode-starlight/styles/base`
- `lucode-starlight/components/overrides/Header.astro`
- `lucode-starlight/components/overrides/Hero.astro`
- `lucode-starlight/components/overrides/Footer.astro`

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
    editLink: { baseUrl: 'https://github.com/grove-dev/grove/edit/main/docs' },
    plugins: [
        lucode({
            docs: { includeAiUtilities: true },
            navLinks: [
                { label: 'Docs', link: '/guides/getting-started/' },
                { label: 'Showcase', link: '/showcase/starlight-components/' },
                { label: 'GitHub', link: 'https://github.com/grove-dev/grove' },
            ],
        }),
    ],
    sidebar: [/* ... */],
});
```

If you fork the docs site, replace the GitHub links and the repo path on `editLink.baseUrl`.
