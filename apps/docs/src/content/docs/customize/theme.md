---
title: Theme
description: Change colours, typography, density, and container width through grove.config.ts theme tokens.
---

Theme tokens are read from `grove.config.ts` and applied as CSS custom properties (`--grove-primary`, `--grove-radius`, and friends).

## Tokens

```ts
theme: {
  primaryColor: "#16a34a",   // brand accent — buttons, links, focus rings
  radius: "soft",            // "none" | "soft" | "round"
  density: "comfortable",    // "compact" | "comfortable" | "spacious"
  containerWidth: "72rem",   // max width of the content container
},
```

That's it. The default template reads these tokens everywhere; changes flow through.

## CSS custom properties

Every token is exposed as a CSS variable on `:root`:

```css
:root {
  --grove-primary: #16a34a;
  --grove-primary-50: #f0fdf4;
  --grove-primary-700: #15803d;
  --grove-radius: 4px;          /* resolved from "soft" */
  --grove-radius-full: 9999px;
  --grove-density: 1;           /* resolved from "comfortable" */
  --grove-container-width: 72rem;
  --grove-font-sans: ui-sans-serif, system-ui, sans-serif;
  --grove-font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}
```

Override any of these in `src/styles/global.css` to extend the design system without forking the template:

```css
:root {
  --grove-primary: #5b21b6;     /* switch to indigo */
  --grove-radius: 12px;
}
```

## Light and dark mode

The default template follows `prefers-color-scheme`. Override per-scheme in `global.css`:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --grove-primary: #22c55e;
    --grove-bg: #0f172a;
    --grove-fg: #e2e8f0;
  }
}
```

## Component-level override

Set CSS variables on a component scope rather than `:root`:

```astro
<div class="card card--featured" style="--grove-primary: #f59e0b;">
  Featured card
</div>
```

Components inherit the cascade — plain CSS, no JS-driven theme.

## What lives outside `theme`

- Logo, favicon, OG image → `public/`. See [Branding](/customize/branding/).
- Stack icons → `public/icons/stacks/`. See [Images and assets](/customize/assets/).
- Layout structures → fork `src/components/*.astro`. See [Components](/customize/components/).

## Related

- [Branding](/customize/branding/) — site identity
- [Components](/customize/components/) — when to override markup