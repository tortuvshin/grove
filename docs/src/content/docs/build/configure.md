---
title: Configure your space
description: How to set the name, blueprint, theme, and integrations for your Grove space through grove.config.ts.
---

`grove.config.ts` is the single source of truth for your space. Edit it to change the site name, blueprint, theme, and which integrations are enabled.

```ts
import { defineConfig } from "@grove-dev/core";

export default defineConfig({
  blueprint: "project-directory",
  site: {
    name: "My Directory",
    tagline: "One line about what this is.",
  },
  theme: {
    primaryColor: "#16a34a",
    radius: "soft",
    density: "comfortable",
  },
  integrations: {
    github: { metadata: true },
  },
});
```

The full field reference is in **[grove.config.ts reference](/reference/config/)**.