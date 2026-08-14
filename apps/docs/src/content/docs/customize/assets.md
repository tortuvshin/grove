---
title: Images and assets
description: Drop static assets under public/. Logos, OG images, and stack icons all live there.
---

Static assets go under `public/`. Reference them as absolute paths from the site root.

```
public/
├── logo.svg              # site logo (optional override)
├── og-image.svg          # Open Graph card
├── robots.txt
├── icons/
│   └── stacks/           # SVG stack icons, one per stack name
└── llms.txt              # generated at build time
```

The default Astro template ships with a curated set of stack icons under `public/icons/stacks/`. Add a new SVG with the same filename as a stack name (e.g. `Python.svg`) and it appears automatically on cards that reference that stack.