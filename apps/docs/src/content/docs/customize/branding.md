---
title: Branding
description: Change your space's name, tagline, description, logo, and Open Graph image.
---

Branding lives in `grove.config.ts`:

```ts
site: {
  name: "My Directory",
  tagline: "One line about what this is.",
  description: "Longer description for SEO and llms.txt.",
  url: "https://example.com",
  repoUrl: "https://github.com/you/my-directory",
},
```

The logo, Open Graph image, and favicon are static files under `public/`. Replace `public/og-image.svg` with your own — the recommended size is 1200×630.