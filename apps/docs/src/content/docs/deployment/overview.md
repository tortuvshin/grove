---
title: Deploy
description: How to ship the static site produced by `astro build` to any static host.
---

The Astro build produces a fully static site. The build output is in `dist/` after `pnpm build`. There is no server runtime — every host that serves static files works.

## Build command

```bash
pnpm build
```

Runs `pnpm exec grove check` (validate, generate, sitemap, llms, robots, og-image, astro check), then `astro build`. The site is now a folder of HTML, CSS, JS, and JSON.

## Environment variables

- **`SITE_URL`** — canonical URL the build uses for absolute links in `sitemap.xml`, OG tags, and JSON-LD. Defaults to `https://example.com`. Set this to your production URL in the host's build environment.
- **`GITHUB_TOKEN`** — only needed if `grove sync github` runs as part of the build. Most sites keep sync as a separate scheduled workflow.

The build is fully static; no runtime secrets required.

## Provider comparison

| Provider | Difficulty | Adapter | Best for |
|---|---|---|---|
| [GitHub Pages](/deployment/github-pages/) | Easiest | None | Open-source repos, project pages |
| [Cloudflare Pages](/deployment/cloudflare/) | Easy | None | Fast edge cache, custom domains |
| [Cloudflare Workers-with-Assets](/deployment/cloudflare/#workers-with-assets-canonical-pattern) | Medium | None | Bypasses `@astrojs/cloudflare` `prismjs` issue |
| [Netlify](/deployment/netlify/) | Easy | None | PR previews, edge functions |
| [Self-hosted](/deployment/self-hosted/) | Medium | None | Own infrastructure (nginx, Caddy, S3) |

All providers run `pnpm build` and serve `dist/`. Differences are in CI setup, headers, and edge features.

## Pre-deploy checklist

Before you point your domain at a new deploy:

1. `pnpm build` succeeds locally.
2. `dist/index.html` exists and contains your site name.
3. `dist/sitemap.xml` is present and lists the right URLs.
4. `dist/llms.txt` and `dist/llms-full.txt` are present.
5. `dist/projects/<some-slug>/index.html` exists for at least one record.
6. `SITE_URL` is set in the host's environment, not hardcoded.
7. `pnpm preview` shows the site the way you expect.

## Continuous deployment

The scaffold ships a `deploy.yml` GitHub Actions workflow that builds and deploys on every push to `main`. The other workflows:

- `ci.yml` — runs `grove check` + `astro build` on every PR.
- `sync-github.yml` — weekly cron, refreshes stars/languages/last-pushed.
- `sync-contributors.yml` — weekly cron, aggregates contributor data.
- `cleanup.yml` — monthly cron, produces the triage report.
- `readme.yml` — weekly cron, regenerates the README block.

See [Scheduled maintenance](/automation/scheduled/) for cadence and triggers.

## Local preview

Before pushing to a host, preview the production build locally:

```bash
pnpm build
pnpm preview
```

The `preview` script serves `dist/` on a local port. Walk through every page, check every filter, click every link before you push.

## Related

- [GitHub Pages](/deployment/github-pages/)
- [Cloudflare](/deployment/cloudflare/)
- [Netlify](/deployment/netlify/)
- [Self-hosted](/deployment/self-hosted/)