---
title: Deploy
description: How to ship the static site produced by `astro build` to any static host — Vercel, Netlify, Cloudflare Pages, or GitHub Pages.
---

The Astro adapter produces a fully static site. The build output is in `dist/` after `pnpm build`. There is no server runtime — every host that serves static files works.

This guide covers the four most common static hosts, plus notes for self-hosting. Grove does **not** bundle provider-specific config files — the scaffold ships only a `deploy.yml` GitHub Actions workflow, and you wire up your host of choice in its own dashboard.

## The build command

```bash
pnpm build
```

This runs (in order, from `apps/example/package.json`):

1. `pnpm exec grove check` — validate every record, run generation,
   sitemap, `llms.txt`, `robots.txt`, and `og-image.svg`, and run
   `astro check`.
2. `astro build` — render the static site to `dist/`.

The site is now a folder of HTML, CSS, JS, and JSON. Any static host can serve it.

## Environment variables

Two are read at build time:

- **`SITE_URL`** — the canonical URL the build uses for absolute
  links in `sitemap.xml`, OpenGraph tags, and JSON-LD. Defaults to
  `https://example.com` if unset. Set this to your production URL
  in the host's build environment.
- **`GITHUB_TOKEN`** — only needed if you run `grove sync github`
  as part of the build. Most sites *don't* do this — sync is a
  separate scheduled workflow. See
  [Sync GitHub metadata](/guides/sync-github-metadata/).

That's it. The build is fully static and does not need any runtime
secrets.

## Vercel

**Project type:** Static (no framework preset needed, but selecting
"Astro" works too).

**Build command:** `pnpm build`

**Output directory:** `dist`

**Install command:** `pnpm install` (or leave the default)

**Environment variables:**

- `SITE_URL` → `https://your-site.vercel.app` (or your custom domain)

**Custom domain:** Add it in the Vercel dashboard under
Settings → Domains. Set `SITE_URL` to the final `https://` URL
after the domain is verified.

**GitHub integration:** Connect the repo. Vercel will deploy every
push to `main` as a production deploy, and every PR as a preview.

## Netlify

**Build command:** `pnpm build`

**Publish directory:** `dist`

**Environment variables:**

- `SITE_URL` → `https://your-site.netlify.app` (or your custom domain)
- `NODE_VERSION` → `22` (matches the template's `engines.node`)

If you want to pin headers or redirects, add a `netlify.toml`:

```toml
# netlify.toml
[build]
  command = "pnpm build"
  publish = "dist"

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

## Cloudflare Pages

**Build command:** `pnpm build`

**Build output directory:** `dist`

**Environment variables:**

- `SITE_URL` → `https://your-site.pages.dev` (or your custom domain)
- `NODE_VERSION` → `22` (set in "Environment variables" or via `.nvmrc`)

**Notes:**

- Cloudflare's edge cache is aggressive. If you push a new deploy
  and the content looks stale, do a hard refresh (Cmd+Shift+R) or
  set a cache-busting query string in the URL.
- For a custom domain on Cloudflare, bring a domain you already
  have on Cloudflare or transfer one in. The Pages project attaches
  to the domain automatically.

## GitHub Pages

The `deploy.yml` workflow the scaffold ships targets GitHub Pages.

**Setup:**

1. In your GitHub repo, go to Settings → Pages.
2. Under "Build and deployment", choose "GitHub Actions".
3. The `deploy.yml` workflow already publishes to Pages. Confirm the
   workflow has `pages: write` and `id-token: write` permissions (the
   generated workflow does).

**Environment variables:**

- The build workflow can read `${{ vars.SITE_URL }}` (repo variable)
  or `${{ secrets.SITE_URL }}` (repo secret). Set `SITE_URL` to
  `https://<org>.github.io/<repo>/` for a project page.

**Custom domain:** Add a `CNAME` file at `public/CNAME` containing
your domain (e.g., `mydir.dev`). The CNAME file is part of the build
output, so it persists across deploys.

**Gotcha:** GitHub Pages serves the site from a subpath on the
default domain. If your build assumes the site lives at the root,
the static asset URLs will be wrong. The Astro template's
`astro.config.mjs` does not set a `base` — set `SITE_URL` to the
*full* subpath URL.

## Self-hosting

If you already have a server, a CDN, or an S3 bucket, you run
`pnpm build` locally (or in your own CI), then upload `dist/`
however you like.

**Common targets:**

- **AWS S3 + CloudFront:** `aws s3 sync dist/ s3://your-bucket --delete`, then invalidate the CloudFront cache.
- **A static NGINX server:** copy `dist/` to `/var/www/html/`.
- **A Docker container:** `FROM nginx:alpine; COPY dist/ /usr/share/nginx/html/`.

No special config in the build — `dist/` is portable.

## Pre-deploy checklist

Before you point your domain at a new deploy, run through this:

1. `pnpm build` succeeds locally.
2. `dist/index.html` exists and contains your site name.
3. `dist/sitemap.xml` is present and lists the right URLs.
4. `dist/llms.txt` and `dist/llms-full.txt` are present.
5. `dist/projects/<some-slug>/index.html` exists for at least one
   record.
6. `SITE_URL` is set in the host's environment, *not* hardcoded in
   `astro.config.mjs`.
7. `pnpm preview` (Astro's preview server) shows the site the way
   you expect.

## Continuous deployment

The scaffold ships a `deploy.yml` GitHub Actions workflow that
builds and deploys on every push to `main`. The other workflows in
the scaffold:

- `ci.yml` runs `grove check` + `astro build` on every pull request.
- `sync-github.yml` runs `grove sync github` weekly on a cron.
- `sync-contributors.yml` runs `grove sync contributors` weekly.
- `cleanup.yml` runs `grove cleanup` monthly.
- `readme.yml` regenerates the README block weekly.

See [Scheduled maintenance](/automation/scheduled/) for the cadence
and trigger configuration.