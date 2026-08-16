# `@grove-dev/starlight`

A theme plugin for [Astro Starlight](https://starlight.astro.build) that
recreates the [shadcn/ui](https://ui.shadcn.com/) documentation design —
component overrides, a layered token-based CSS theme, styled Expressive Code,
and a few extra content components.

It powers <https://withgrove.dev>, but it is **not** part of Grove's
publishing pipeline.

## Relationship to Grove

This package is optional and independent. It shares the Grove name and visual
language, nothing else:

- It does **not** require `@grove-dev/core`, `@grove-dev/astro`, or
  `@grove-dev/cli`, and does not depend on any of them.
- It knows nothing about records, blueprints, taxonomy, or `grove.config.ts`.
- You can use it on any Starlight site, and you can build a Grove space
  without it.

If you are here for Grove's file-first publishing system, you want
[`@grove-dev/core`](https://www.npmjs.com/package/@grove-dev/core) and
[`@grove-dev/astro`](https://www.npmjs.com/package/@grove-dev/astro) instead.

## Compatibility

| Requirement | Supported |
| --- | --- |
| Node.js | ≥ 22.12 |
| Astro | ≥ 5.0 |
| `@astrojs/starlight` | ≥ 0.38.3 |

Verified against Astro 7 and Starlight 0.41.

## Install

```bash
npm  install @grove-dev/starlight
pnpm add     @grove-dev/starlight
yarn add     @grove-dev/starlight
bun  add     @grove-dev/starlight
```

## Setup

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import grove from '@grove-dev/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'My Docs',
      plugins: [grove()],
    }),
  ],
});
```

The plugin registers the component overrides, appends the theme CSS, and
configures Expressive Code with matching code-block styling.

## Options

Every option is optional.

```ts
grove({
  // Extra links in the site header.
  navLinks: [
    { label: 'Docs', link: '/introduction/' },
    { label: 'GitHub', link: 'https://github.com/…',
      attrs: { target: '_blank', rel: 'noopener noreferrer' } },
  ],

  docs: {
    // Adds an "AI tools" menu beside each page title. Default: false.
    includeAiUtilities: true,
  },

  // Markdown; replaces the default attribution line in the footer.
  footerText: 'Built with care.',
});
```

| Option | Type | Default |
| --- | --- | --- |
| `navLinks` | `{ label, link, attrs?, badge? }[]` | — |
| `docs.includeAiUtilities` | `boolean` | `false` |
| `footerText` | `string` (Markdown) | The upstream attribution line |

### What `includeAiUtilities` does

It renders a dropdown next to the page title with links to ChatGPT and Claude.
Each link is a URL-encoded query containing **the page's URL and a short
prompt** — for example, `I'm looking at: https://example.com/page. Help me
understand how to use it.`

Page content is **not** transmitted. Nothing is sent anywhere until a reader
clicks; there is no telemetry, no request on page load, and the assistant
fetches the page itself if it can. Off by default.

## Content schema

Extend the docs collection to unlock the hero options:

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

This adds `hero.layout` and an optional `hero.announcement`:

```yaml
---
title: My Project
template: splash
hero:
  layout: split-left
  announcement:
    text: v2.0 is out
    link: /blog/v2/
---
```

## Splash layouts

`hero.layout` accepts five values:

| Value | Arrangement |
| --- | --- |
| `centered` *(default)* | Text above, image below |
| `centered-top` | Image above, text below |
| `split-left` | Text left, image right |
| `split-right` | Text right, image left |
| `banner` | Full-width banner |

## Components

```astro
---
import { Card, ContainerSection, Dropdown, LinkButton } from '@grove-dev/starlight/components';
---

<ContainerSection width="lg">
  <h2>Build better docs</h2>
  <LinkButton href="/introduction/">Get started</LinkButton>
</ContainerSection>
```

- **`LinkButton`** — `href`, `variant` (`primary` | `secondary` | `minimal`),
  `size` (`2xs` | `xs` | `sm` | `md` | `lg`); other anchor attributes are
  forwarded.
- **`ContainerSection`** — `width` (`sm` | `md` | `lg` | `xl`).
- **`Card`** — a styled content card.
- **`Dropdown`** — a compound menu: `Dropdown.Root`, `.Trigger`, `.Content`,
  `.Item`, `.Label`, `.Separator`, `.Shortcut`.

```astro
<Dropdown.Root>
  <Dropdown.Trigger variant="secondary">Theme actions</Dropdown.Trigger>
  <Dropdown.Content align="start">
    <Dropdown.Item as="a" href="/guides/theming/">
      Customize theme
      <Dropdown.Shortcut>CSS</Dropdown.Shortcut>
    </Dropdown.Item>
  </Dropdown.Content>
</Dropdown.Root>
```

Useful props: `Dropdown.Root` — `openOnHover`, `closeDelay`;
`.Trigger` — `asChild`, `variant`, `size`; `.Content` — `side`, `align`,
`sideOffset`, `animationDuration`; `.Item` — `as`, `inset`, `disabled`.

## Theming

Override tokens from your own CSS, loaded after the plugin's:

```css
:root {
  --radius: 0.5rem;
  --sidebar-width: 17rem;
  --container-max-width: 1440px;
}
```

The theme ships light and dark values for every token and follows Starlight's
theme selector, so both modes work without extra configuration. Overrides
respect `prefers-reduced-motion`, and the component overrides preserve
Starlight's landmarks, heading order, and focus behaviour.

## Overrides and upgrade risk

The plugin claims **16** Starlight component overrides:

`ThemeSelect`, `PageFrame`, `Header`, `SiteTitle`, `Sidebar`,
`TwoColumnContent`, `ContentPanel`, `PageTitle`, `MarkdownContent`, `Hero`,
`Footer`, `SocialIcons`, `Pagination`, `Search`, `TableOfContents`,
`PageSidebar`.

Two consequences worth knowing before you adopt it:

1. **If you already override one of these**, the plugin skips it and logs a
   warning naming the file to render manually — your override wins, but the
   theme may look inconsistent at that seam.
2. **Starlight internals are not a stable API.** A Starlight minor that
   restructures any overridden component can break this theme before it breaks
   an unthemed site. Pin Starlight and upgrade it deliberately.

Each override is importable directly, e.g.
`@grove-dev/starlight/components/overrides/Header.astro`.

## Exports

| Specifier | Contents |
| --- | --- |
| `@grove-dev/starlight` | The plugin (default export) |
| `@grove-dev/starlight/schema` | `ExtendDocsSchema`, `heroLayoutSchema` |
| `@grove-dev/starlight/components` | `Card`, `ContainerSection`, `Dropdown`, `LinkButton` |
| `@grove-dev/starlight/components/overrides/*.astro` | The 16 overrides |
| `@grove-dev/starlight/styles/base` · `/layers` · `/theme` | Theme CSS layers |

## Attribution and licensing

This package is distributed under the MIT License and derives from:

- **[adrian-ub/starlight-theme-black](https://github.com/adrian-ub/starlight-theme-black)**
  — the earlier shadcn/ui-inspired Starlight theme this work is based on.
- **[lucas-labs](https://github.com/lucas-labs)** — the port of that design to
  Astro Starlight, which this package adapts.
- **[shadcn/ui](https://ui.shadcn.com/)** (MIT) — the original design language.

> **⚠️ Licensing verification is outstanding.** The upstream repository URL
> recorded in
> [`THIRD_PARTY_LICENSES.md`](./THIRD_PARTY_LICENSES.md) is malformed and the
> upstream license text has not been reproduced. Until that is resolved, treat
> this package's third-party attribution as **incomplete**: the credits above
> are accurate as far as they go, but the compatibility check that would let
> Grove assert clean redistribution has not been performed. See
> `THIRD_PARTY_LICENSES.md` for the open items.

## Links

[Documentation](https://withgrove.dev/starlight/) ·
[Issues](https://github.com/tortuvshin/grove/issues) ·
[Changelog](https://github.com/tortuvshin/grove/blob/main/CHANGELOG.md)

## License

MIT
