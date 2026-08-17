---
title: Netlify
description: Deploy a Grove space to Netlify with zero configuration.
---

Grove spaces deploy to Netlify with no adapter required. Astro's static output (`dist/`) is the default Netlify publish directory.

## Configuration

`netlify.toml` at the project root:

```toml
[build]
  command = "pnpm exec grove check && pnpm build"
  publish = "dist"

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

The `grove check` command validates config and emits `data/generated/*.json`, sitemap, llms files, robots, and og-image before the build runs.

## Build settings

- **Build command:** `pnpm exec grove check && pnpm build`
- **Publish directory:** `dist`
- **Node version:** 24 (set via `NODE_VERSION=24` env var or `netlify.toml`)

## Custom domain

Add the domain in the Netlify admin panel. Update `site.url` in `grove.config.ts` to match.

## Headers and redirects

Use `_headers` and `_redirects` in `public/` for static rules, or `netlify.toml` for build-time configuration.

## Edge functions

Optional — Astro's `output: 'hybrid'` mode allows per-route SSR via Netlify Edge Functions. Most Grove spaces don't need this.

## Related

- [GitHub Pages](/deployment/github-pages/)
- [Cloudflare](/deployment/cloudflare/)
- [Self-hosted](/deployment/self-hosted/)