---
title: Theme
description: Change colours, radius, density, and container width through grove.config.ts theme tokens.
---

Theme tokens are read from `grove.config.ts` and applied as CSS custom properties on `<html>` (`--grove-theme-primary`, `--grove-radius`, and friends), which the package stylesheet resolves into the runtime design tokens.

## Tokens

```ts
theme: {
  // primaryColor: "#4f46e5", // optional brand accent — see below
  radius: "soft",            // "none" | "soft" | "round"
  density: "comfortable",    // "compact" | "comfortable" | "spacious"
  containerWidth: "72rem",   // max width of the content container
},
```

That's it. The default template reads these tokens everywhere; changes flow through.

## Primary color is optional

When `primaryColor` is **unset** (the default), primary actions use the neutral ink treatment: near-black buttons on the light theme, near-white on dark. No arbitrary hue is injected into your site.

When you do set a brand hex, Grove computes the button text color (and a dark-theme variant) with real WCAG contrast math at build time — if neither white nor near-black text reaches AA on your hex, the solid shade is adjusted until it does. You never ship an unreadable button.

## CSS custom properties

The runtime tokens live in the package stylesheet, keyed to the resolved theme:

```css
:root {
  --grove-background: …;
  --grove-foreground: …;
  --grove-primary: var(--grove-theme-primary, var(--grove-foreground));
  --grove-surface-raised: …;   /* cards */
  --grove-selected: …;         /* active filters, current page */
  --grove-success: …;          /* status roles: success/warning/danger/info */
  --grove-border: …;
}
:root.dark {
  /* every token redefined for the dark theme */
}
```

Override any runtime token in `src/styles/global.css` to extend the design system without forking the template:

```css
:root {
  --grove-theme-primary: #5b21b6; /* switch to violet */
}
```

## Light and dark mode

The theme toggle in the header cycles **light → dark → system**; the choice persists in `localStorage` and is applied as a `dark` class on `<html>` before first paint (no flash). "System" follows `prefers-color-scheme`. Override per-theme in `global.css` with `:root` / `:root.dark` selectors.

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
