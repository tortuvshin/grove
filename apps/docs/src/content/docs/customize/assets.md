---
title: Images and assets
description: Drop static assets under public/. Logos, OG images, and stack icons all live there.
---

Static assets go under `public/`. Anything in `public/` is served as-is from the site root without going through the Astro build.

## Default layout

```
public/
├── favicon.ico                 # 32×32 ICO (legacy browsers)
├── favicon.svg                 # SVG favicon (modern browsers)
├── apple-touch-icon.png        # 180×180 for iOS home screen
├── logo.svg                    # header logo (default)
├── og-image.svg                # generated brand card
├── robots.txt                  # generated; do not edit
├── llms.txt                    # generated; do not edit
└── icons/
    └── stacks/                 # SVG stack icons
        ├── Python.svg
        ├── TypeScript.svg
        └── Next.js.svg
```

`robots.txt`, `llms.txt`, `llms-full.txt`, `og-image.svg` are **generated** — `grove check` overwrites them. Override by editing the config inputs, not the files.

## Stack icons

The icon filename matches the stack name as it appears in `data/taxonomy/stacks.yml` and each record's `stacks[]`:

```yaml
# data/taxonomy/stacks.yml
- slug: typescript
  name: TypeScript
  color: "#3178C6"
```

```bash
public/icons/stacks/TypeScript.svg   # matches "TypeScript"
```

The `StackIcon` component looks up icons in this order:

1. `${stackName}.svg` (exact match)
2. Lowercase / dash-cased variants (e.g. `next-js.svg` for `Next.js`)
3. First-letter initial fallback

The default set comes from [Simple Icons](https://simpleicons.org/) (CC0) — ~100 common stacks. For a custom stack, drop a 24×24 SVG with matching stroke width.

## Adding custom directories

`public/` is yours. Add subdirectories for project-specific assets:

```
public/
├── fonts/                      # self-hosted webfonts (rare)
├── images/                     # hero images, illustrations
└── downloads/                  # PDFs, release artifacts
```

Reference them as absolute paths:

```astro
<img src="/images/hero.png" alt="...">
```

## `src/assets/` vs `public/`

| Source | Build-time optimized | Served as-is |
|---|---|---|
| `src/assets/` | ✓ (via `astro:assets`) | — |
| `public/` | — | ✓ |

Use `src/assets/` for hero images and inline graphics processed by Astro's `<Image>`. Use `public/` for brand files, downloadable artifacts, and stack icons (which are looked up by filename at render time).

## What NOT to put in `public/`

- Records — they're YAML under `data/records/`.
- Markdown content — long-form prose goes under `content/pages/`.
- Generated files — `llms.txt`, `robots.txt`, `og-image.svg` are overwritten by `grove check`.

## Related

- [Branding](/customize/branding/) — logo, favicon, OG image
- [Theme](/customize/theme/) — colour tokens
- [Astro assets reference](https://docs.astro.build/en/guides/assets/) — `<Image>`, `getImage()`