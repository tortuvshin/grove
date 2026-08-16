---
title: Branding
description: Change your space's name, tagline, description, logo, and Open Graph image.
---

Site identity lives in `grove.config.ts` under `site`:

```ts
site: {
  name: "Open Apps",
  tagline: "Production-ready open-source applications.",
  description: "A curated, health-aware directory of open-source apps.",
  url: "https://openapps.example.com",
  repoUrl: "https://github.com/example/open-apps",
},
```

These fields flow into `<title>`, the home hero, `sitemap.xml`, `llms.txt`, the JSON-LD `WebSite` document, and the OG card.

## Logo and favicon

Drop the files in `public/`, then point at them from `site`:

```ts
site: {
  name: "Open Apps",
  logo: "/logo.svg",        // shown beside the site name in the header
  favicon: "/favicon.svg",  // browser tab icon
},
```

```
public/
├── logo.svg             # header logo (preferred)
├── favicon.svg          # modern browsers
├── favicon.ico          # 32×32 ICO, for legacy browsers
└── apple-touch-icon.png # 180×180 for iOS
```

Both fields are optional and there is no filename convention behind them — Grove renders exactly what you point it at. Leave `logo` unset and the header shows a neutral mark next to the site name; leave `favicon` unset and the tab gets a generated square tinted with your `theme.primaryColor`.

If you only ship one file, ship `logo.svg`.

## OG image

`grove check` generates `public/og-image.svg` (1200×630) from your `site` block and `theme.primaryColor`. To use a hand-designed image, replace the file — the build does not overwrite user-authored files.

For stricter social platforms (Facebook, LinkedIn) that don't reliably cache SVG, ship a PNG version: `public/og-image.png`.

## What NOT to put in `site`

- No HTML — `name` is rendered as text, not parsed.
- No URLs in `name` — URLs belong in `site.url`.
- No marketing copy in `description` — it's quoted verbatim in `llms.txt`.

## Related

- [Theme](/customize/theme/) — colour tokens
- [Images and assets](/customize/assets/) — icons, favicons
- [SEO outputs](/outputs/seo/) — full OG + JSON-LD reference