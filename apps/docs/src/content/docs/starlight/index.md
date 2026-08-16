---
title: Starlight theme
description: '@grove-dev/starlight — a shadcn/ui-inspired theme plugin for Astro Starlight. Optional, and independent of Grove publishing.'
---

`@grove-dev/starlight` is a theme plugin for
[Astro Starlight](https://starlight.astro.build) that recreates the
[shadcn/ui](https://ui.shadcn.com/) documentation design. It powers this
site.

## It is not part of Grove publishing

This package shares the Grove name and visual language, and nothing else:

- It does **not** require `@grove-dev/core`, `@grove-dev/astro`, or
  `@grove-dev/cli`, and depends on none of them.
- It knows nothing about records, blueprints, taxonomy, or
  `grove.config.ts`.
- You can use it on any Starlight site, and you can build a Grove space
  without it.

If you came here for Grove's file-first publishing system, start at
[Introduction](/introduction/) instead. This section is for people
theming a documentation site.

## Install

```bash
pnpm add @grove-dev/starlight
```

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

## In this section

| Page | What it covers |
| --- | --- |
| [Plugin API](/starlight/plugin-api/) | Every option the plugin accepts |
| [Plugin author guide](/starlight/plugin-author-guide/) | Writing a plugin against this theme |
| [Components](/starlight/components/) | The components the theme styles and exports |
| [Typography](/starlight/typography/) | Type scale and prose styling |
| [Splash pages](/starlight/splash-pages/) | The five hero layouts |

## Compatibility

| Requirement | Supported |
| --- | --- |
| Node.js | ≥ 22.12 |
| Astro | ≥ 5.0 |
| `@astrojs/starlight` | ≥ 0.38.3 |

The plugin overrides sixteen Starlight components. Starlight internals
are not a stable API, so a Starlight minor that restructures one of them
can break this theme — pin Starlight and upgrade deliberately. See the
[package README](https://github.com/tortuvshin/grove/blob/main/packages/starlight/README.md)
for the full list and the attribution status.
