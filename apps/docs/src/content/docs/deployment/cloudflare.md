---
title: Cloudflare
description: Deploy a Grove space to Cloudflare Pages or Workers-with-Assets.
---

Two deployment targets on Cloudflare work with Grove:

1. **Cloudflare Pages** — the conventional static-site target.
2. **Workers-with-Assets** — used by the canonical Grove docs site (`apps/docs/`) to bypass a `prismjs` resolution issue with `@astrojs/cloudflare`.

This page covers both, with emphasis on the second since it's the path the maintainers use.

## Cloudflare Pages

Standard `wrangler pages deploy dist` flow. `apps/docs` was originally configured this way; the configuration was migrated to Workers-with-Assets because the `@astrojs/cloudflare` adapter pulled in `prismjs` for SSR-only code paths even when the site is fully static, which caused build-time resolution failures on certain `pnpm` versions.

```toml
# wrangler.toml
name = "grove"
pages_build_output_dir = "./dist"
compatibility_date = "2024-09-01"
```

## Workers-with-Assets (canonical pattern)

```toml
# wrangler.toml
name = "grove-docs"
compatibility_date = "2024-09-01"
main = "./dist/_worker.js/index.js"
assets = { directory = "./dist", binding = "ASSETS" }
[build]
command = "pnpm build"
```

Astro's `output: 'static'` build emits `dist/_worker.js/` (the Workers entry) and `dist/` (the static asset directory). Wrangler uploads both.

## Caveats

- **`prismjs` resolution** — when using `@astrojs/cloudflare`, even fully static builds resolve `prismjs`. The Workers-with-Assets pattern bypasses this because the build doesn't pull in `@astrojs/cloudflare` at all.
- **Custom domain** — Cloudflare Pages handles CNAME setup automatically; Workers-with-Assets require manual route configuration.
- **Headers** — set custom headers (cache-control, security) in `public/_headers` for Cloudflare Pages or in the Worker fetch handler for Workers-with-Assets.

## Why the docs site uses Workers-with-Assets

`apps/docs/astro.config.mjs` was migrated to Workers-with-Assets after a series of intermittent `prismjs` resolution failures on `pnpm install`. The pattern is more verbose but eliminates the class of bug entirely. The trade-off is that it bypasses Astro's Cloudflare adapter, which means no SSR route helpers — acceptable because the docs site is fully static.

## Related

- [GitHub Pages](/deployment/github-pages/)
- [Netlify deployment](/deployment/netlify/)
- [Self-hosted](/deployment/self-hosted/)