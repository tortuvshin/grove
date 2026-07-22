---
title: Components
description: Override any default Astro component by pointing grove.config.ts at your own .astro file. The data engine stays untouched.
---

Any default component can be replaced with your own version while keeping the data engine and automation intact.

```ts
// grove.config.ts
components: {
  ItemCard: "./src/components/MyItemCard.astro",
  Hero: undefined,
  DetailHeader: undefined,
},
```

The full component reference is in **[Astro components](/reference/components/)**. The default template customization walk-through is in **[Customize the Astro template](/guides/customize-astro-template/)**.

The convention is: start with the complete default theme, replace only what you need.