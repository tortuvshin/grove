# @grove-dev/starlight

A shadcn/ui-inspired Starlight theme for the [Grove](https://github.com/grove-dev/grove) docs
site. This package is a hard fork of
[`lucode-starlight`](https://github.com/lucas-labs/lucode-starlight-theme) with the same
override components and CSS tokens, but the styling is built on **Tailwind CSS v4**.

## Features

- Starlight plugin API integration.
- Custom overrides for header, sidebar, page frame, hero, footer, search, table of contents,
  pagination, and Markdown content.
- Token-based, layered CSS theme with light and dark mode values.
- Styled built-in Starlight components (hero splashes, cards, link cards, asides, badges,
  tabs, steps, file trees, link buttons).
- Tailwind CSS v4 wired up via `@tailwindcss/vite`, so docs authors can keep using utility
  classes alongside the theme tokens.

## Installation

The package is consumed from inside the Grove monorepo. The `docs/` site adds it as a
`workspace:*` dependency and registers the plugin in `astro.config.mjs`.

```js
// docs/astro.config.mjs
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import grove from '@grove-dev/starlight';

export default defineConfig({
    integrations: [
        starlight({
            title: 'Grove Docs',
            plugins: [grove()],
        }),
    ],
});
```

The plugin registers the Grove component overrides, appends the Tailwind theme CSS file, and
configures Expressive Code.

## Schema

```ts
// src/content.config.ts
import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { ExtendDocsSchema } from '@grove-dev/starlight/schema';

export const collections = {
    docs: defineCollection({
        loader: docsLoader(),
        schema: docsSchema({ extend: ExtendDocsSchema }),
    }),
};
```

## Plugin Options

```ts
type GroveStarlightUserConfig = {
    navLinks?: Link[];
    footerText?: string;
    docs?: {
        includeAiUtilities?: boolean;
    };
};
```

## License

MIT
