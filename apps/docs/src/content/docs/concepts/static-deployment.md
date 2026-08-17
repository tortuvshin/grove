---
title: Static deployment
description: Grove output is fully static — no runtime, no database.
---

# Static deployment

Every output Grove produces is fully static. No runtime, no server, no database. Deployment is `pnpm build` + upload to a CDN.

## What gets deployed

Everything under `dist/` after `pnpm build`:

- **HTML pages** — every route's static output (`/`, `/projects/`, `/projects/<slug>/`, `/collections/<slug>/`, etc.).
- **JSON datasets** — `records.json` and others under `data/generated/`, copied into the build.
- **`sitemap.xml`**, **`robots.txt`**, **`llms.txt`**, **`llms-full.txt`** — emitted to `public/` then copied into the build.
- **`public/og/<page>.png`** — satori-rendered OG cards.
- **`public/icons/**`** — the packaged icon set, with per-file ownership preserved.
- **`manifest.json`** — referenced by the Starlight docs site via `<link rel="manifest">`. Consumers provide their own; the default scaffold does not.

The build is deterministic: the same source files plus the same `grove.config.ts` produce the same output. There is no clock-dependent content unless the curator puts time strings in their data.

## Where the build runs

The build pipeline runs on three events:

1. **Local dev** — `pnpm dev` (which runs `astro dev`). The Astro integration invokes `prepareDirectory()` from `@grove-dev/core` on every `astro:config:setup`, so a save in `data/records/*.yml` produces an updated dataset within a few hundred milliseconds.
2. **CI on push** — `.github/workflows/ci.yml` runs `grove check` and Astro build.
3. **Scheduled maintenance** — `sync-github.yml`, `sync-contributors.yml`, `cleanup.yml`, `readme.yml` re-run periodically and commit. The next push triggers another CI run that rebuilds.

There is no separate "refresh" step required. The framework regenerates everything from sources on every build.

## Static-host expectations

A Grove site deploys to any static host. The scaffold has first-class workflows for Cloudflare and GitHub Pages, and recipe-style notes for Vercel, Netlify, and self-hosted setups — see [Deployment](/deployment/overview/).

For any host:

- `dist/` is the upload root.
- 404s use `404.html` (Astro emits this automatically).
- `trailingSlash: 'ignore'` is the Astro default — both `/about/` and `/about` work.
- Cache headers are the host's responsibility. Set `Cache-Control: public, max-age=300, s-maxage=600` for HTML and one year for assets the framework generates (sitemap, OG cards, JSON datasets).

## What the host needs to know

The site URL is configured in `site.url` in `grove.config.ts`. The framework writes it into:

- Every `<link rel="canonical">` and JSON-LD `url`.
- Every `og:url` and Twitter `url` meta tag.
- `og-image.svg` host references.
- The OG card manifest (`og-manifest.json`).
- The `llms.txt` link block.

If you change `site.url`, rebuild — there's no other source of truth for the URL.

## Why static-first is durable

- **No runtime patching.** A new feature ships as a new file in `dist/`. There's no daemon to redeploy.
- **No database migrations.** Schema changes are evident in `git log`; old builds keep working until you deploy the new one.
- **No surprise breakage at scale.** Static sites can be cached aggressively at the CDN edge; the framework is fine with that.
- **Cheap to host.** Static bytes are cheaper than compute by orders of magnitude.

The tradeoff is the same as every static site: changes go through a build. Curators accepting this constraint are the users Grove is built for.

## See also

- [Deployment overview](/deployment/overview/) — provider recipes.
- [Outputs overview](/outputs/overview/) — every generated artifact.
- [GitHub workflows](/outputs/workflows/) — the scheduled maintenance surface.
