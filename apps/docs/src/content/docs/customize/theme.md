---
title: Theme
description: Change colors, typography, density, and container width through grove.config.ts theme tokens.
---

Theme tokens are read from `grove.config.ts` and applied as CSS custom properties (`--grove-primary`, `--grove-radius`, etc.).

```ts
theme: {
  primaryColor: "#16a34a",     // brand accent
  radius: "soft",              // "none" | "soft" | "round"
  density: "comfortable",      // "compact" | "comfortable" | "spacious"
  containerWidth: "72rem",     // max width of the content container
},
```

For deeper control, override any CSS variable in `src/styles/global.css`. The Astro template's default styles use `var(--grove-primary)` and friends, so changes flow through.