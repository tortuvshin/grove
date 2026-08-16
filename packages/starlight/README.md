# `@grove-dev/starlight`

The Starlight theme and documentation integration used by Grove.
It powers the Grove documentation site (`apps/docs/`) and is
available as a Starlight plugin for any documentation project that
wants the same visual language as Grove-powered sites.

The plugin registers component overrides for the header, sidebar,
page frame, hero, footer, search, table of contents, pagination,
and Markdown content. It appends a layered CSS theme with light and
dark mode values and configures Expressive Code so code blocks
match the rest of the site.

## Install

```bash
pnpm add @grove-dev/starlight
```

Requires Node.js `>=22.12.0`, Astro `>=5.0.0`, and
`@astrojs/starlight >=0.38.3`.

## Use the plugin

Add the plugin inside the Starlight integration:

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import grove from "@grove-dev/starlight";

export default defineConfig({
  integrations: [
    starlight({
      title: "My Docs",
      plugins: [grove()],
    }),
  ],
});
```

The plugin registers Grove's component overrides, appends the
theme CSS files, and configures Expressive Code.

## Plugin options

```ts
type GroveStarlightUserConfig = {
  navLinks?: Link[];
  footerText?: string;
};

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
    { label: "Docs", link: "/introduction/" },
    { label: "GitHub", link: "https://github.com/tortuvshin/grove" },
  ],
  footerText:
    "Built with [Grove Starlight](https://github.com/tortuvshin/grove/tree/main/packages/starlight).",
});
```

## Extend the docs schema

To use Grove's splash-page frontmatter fields with type checking,
extend the Starlight docs schema:

```ts
// src/content.config.ts
import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { ExtendDocsSchema } from "@grove-dev/starlight/schema";

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({ extend: ExtendDocsSchema }),
  }),
};
```

## Splash pages

Use Starlight's `template: splash` and set `hero.layout`:

```md
---
title: Developer Portal
description: API docs, examples, and integration guides.
template: splash
hero:
  layout: split-left
  announcement:
    text: Version 2.0 is ready
    link: /guides/getting-started/
  actions:
    - text: Get started
      link: /guides/getting-started/
      icon: right-arrow
---
```

Available layouts:

- `centered`
- `centered-top`
- `split-left`
- `split-right`
- `banner`

## Components

Import user-facing components from `@grove-dev/starlight/components`:

```astro
---
import { ContainerSection, Dropdown, LinkButton } from "@grove-dev/starlight/components";
---

<ContainerSection width="lg">
  <h2>Build better docs</h2>
  <p>Use Grove sections on splash pages and custom MDX content.</p>
  <LinkButton href="/introduction/">Get started</LinkButton>
</ContainerSection>

<Dropdown.Root>
  <Dropdown.Trigger variant="secondary">Theme actions</Dropdown.Trigger>
  <Dropdown.Content align="start">
    <Dropdown.Label>Documentation</Dropdown.Label>
    <Dropdown.Item as="a" href="/guides/getting-started/">
      Getting Started
    </Dropdown.Item>
    <Dropdown.Item as="a" href="/guides/theming/">
      Customize Theme
      <Dropdown.Shortcut>CSS</Dropdown.Shortcut>
    </Dropdown.Item>
  </Dropdown.Content>
</Dropdown.Root>
```

### `LinkButton`

- `href` — anchor destination.
- `variant` — `primary`, `secondary`, or `minimal`.
- `size` — `2xs`, `xs`, `sm`, `md`, or `lg`.
- Other anchor attributes are forwarded.

### `ContainerSection`

- `width` — `sm`, `md`, `lg`, or `xl`.

### `Dropdown`

Compound menu component exported as `Dropdown.Root`,
`Dropdown.Trigger`, `Dropdown.Content`, `Dropdown.Item`,
`Dropdown.Label`, `Dropdown.Separator`, and `Dropdown.Shortcut`.

Useful props:

- `Dropdown.Root` — `openOnHover`, `closeDelay`.
- `Dropdown.Trigger` — `asChild`, `variant`, `size`.
- `Dropdown.Content` — `side`, `align`, `sideOffset`,
  `animationDuration`.
- `Dropdown.Item` — `as`, `inset`, `disabled`.
- `Dropdown.Label` — `inset`.

## Styling

Override theme tokens from your app CSS:

```css
:root {
  --radius: 0.5rem;
  --sidebar-width: 17rem;
  --container-max-width: 1440px;
}
```

## Attribution

This theme recreates the design of the documentation site for
[shadcn/ui](https://ui.shadcn.com/).

It uses
[adrian-ub/starlight-theme-black](https://github.com/adrian-ub/starlight-theme-black)
as a base, which brought an earlier shadcn/ui-inspired design to
Astro Starlight.

## Develop Starlight

```bash
pnpm --filter @grove-dev/starlight test
```

## License

[MIT](../../LICENSE) © Grove contributors.