---
title: Deploy
description: How to ship the static site produced by grove build to Vercel, Netlify, Cloudflare Pages, or GitHub Pages.
---

The Astro adapter produces a fully static site. The build output is in `dist/` after `pnpm build`. There is no server runtime — every host that serves static files works.

This guide covers the four hosts the CLI knows about (`vercel`, `netlify`, `cloudflare`, `github-pages`), plus a "none" option for self-hosting. See `DEPLOY_PROVIDERS` in `packages/cli/src/index.ts` for the canonical list.

## The build command

```bash
pnpm build
```

This runs (in order, from `packages/astro/templates/default/package.json`):

1. `grove validate` — schema-check every record
2. `grove generate` — produce `data/generated/records.index.json` and `records.full.json`
3. `grove sitemap` — write `public/sitemap.xml`
4. `grove llms` — write `public/llms.txt` and `public/llms-full.txt`
5. `astro build` — render the static site to `dist/`

The site is now a folder of HTML, CSS, JS, and JSON. Any static host can serve it.

## Environment variables

Two are read at build time:

- **`SITE_URL`** — the canonical URL the build uses for absolute links in `sitemap.xml`, OpenGraph tags, and JSON-LD. Defaults to `https://example.com` if unset. Set this to your production URL in the host's build environment.
- **`GITHUB_TOKEN`** — only needed if you run `grove sync github` as part of the build. Most sites *don't* do this — sync is a separate scheduled workflow. See [Sync GitHub metadata](/guides/sync-github-metadata/).

That's it. The build is fully static and does not need any runtime secrets.

## Vercel

**Project type:** Static (no framework preset needed, but selecting "Astro" works too).

**Build command:** `pnpm build`

**Output directory:** `dist`

**Install command:** `pnpm install` (or leave the default)

**Environment variables:**

- `SITE_URL` → `https://your-site.vercel.app` (or your custom domain)

**Custom domain:** Add it in the Vercel dashboard under Settings → Domains. Set `SITE_URL` to the final `https://` URL after the domain is verified.

**GitHub integration:** Connect the repo. Vercel will deploy every push to `main` as a production deploy, and every PR as a preview. Previews work out of the box because the build is fully static.

## Netlify

**Build command:** `pnpm build`

**Publish directory:** `dist`

**Environment variables:**

- `SITE_URL` → `https://your-site.netlify.app` (or your custom domain)
- `NODE_VERSION` → `20` (matches the template's `engines.node`)

Netlify reads `netlify.toml` if you have one; the Astro template doesn't ship one. Add a minimal config if you want to pin headers or redirects:

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

**Custom domain:** Netlify DNS or external. Update `SITE_URL` once the certificate is issued.

## Cloudflare Pages

**Build command:** `pnpm build`

**Build output directory:** `dist`

**Environment variables:**

- `SITE_URL` → `https://your-site.pages.dev` (or your custom domain)
- `NODE_VERSION` → `20` (set in "Environment variables" or via `.nvmrc`)

**Notes:**

- Cloudflare's edge cache is aggressive. If you push a new deploy and the content looks stale, do a hard refresh (Cmd+Shift+R) or set a cache-busting query string in the URL. The Astro build outputs content-hashed asset filenames, so JS/CSS will update — only the HTML may be cached.
- For a custom domain on Cloudflare, you can either bring a domain you already have on Cloudflare, or transfer one in. The Pages project attaches to the domain automatically.

## GitHub Pages

This is the lowest-friction option for a public, community-maintained directory — the workflow file is generated automatically when you scaffold with `--github public --deploy github-pages`.

**Setup:**

1. In your GitHub repo, go to Settings → Pages.
2. Under "Build and deployment", choose "GitHub Actions".
3. The `build.yml` workflow that ships with the template already publishes to Pages. Confirm the workflow has `pages: write` and `id-token: write` permissions (the generated workflow does).

**Environment variables:**

- The build workflow can read `${{ vars.SITE_URL }}` (repo variable) or `${{ secrets.SITE_URL }}` (repo secret). Set `SITE_URL` to `https://<org>.github.io/<repo>/` for a project page, or `https://<custom-domain>/` if you've added a custom domain in the Pages settings.

**Custom domain:** Add a `CNAME` file at `public/CNAME` containing your domain (e.g., `mydir.dev`). Configure DNS per the GitHub Pages docs. The CNAME file is part of the build output, so it persists across deploys.

**Gotcha:** GitHub Pages serves the site from a subpath on the default domain (`<org>.github.io/<repo>/`). If your build assumes the site lives at the root, the static asset URLs will be wrong. The Astro template's `astro.config.mjs` does not set a `base` — set `SITE_URL` to the *full* subpath URL, and the build will produce correct absolute URLs in `sitemap.xml` and meta tags.

## Self-hosting ("none")

If you already have a server, a CDN, or an S3 bucket, the `none` deploy option means "the CLI will not generate a host-specific config". You run `pnpm build` locally (or in your own CI), then upload `dist/` however you like.

**Common targets:**

- **AWS S3 + CloudFront:** `aws s3 sync dist/ s3://your-bucket --delete`, then invalidate the CloudFront cache.
- **A static NGINX server:** copy `dist/` to `/var/www/html/`.
- **A Docker container:** `FROM nginx:alpine; COPY dist/ /usr/share/nginx/html/`.

No special config in the build — `dist/` is portable.

## Pre-deploy checklist

Before you point your domain at a new deploy, run through this:

1. `pnpm build` succeeds locally.
2. `dist/index.html` exists and contains your site name (search for it).
3. `dist/sitemap.xml` is present and lists the right URLs.
4. `dist/llms.txt` and `dist/llms-full.txt` are present (these are what AI crawlers will read).
5. `dist/projects/<some-slug>/index.html` exists for at least one record.
6. `SITE_URL` is set in the host's environment, *not* hardcoded in `astro.config.mjs`.
7. `pnpm preview` (Astro's preview server) shows the site the way you expect.

If any of those fail, fix it locally before pushing to the host — debugging a deployed site is slower than debugging a local build.

## Continuous deployment

The default workflow, when you scaffold with `--github public --deploy <host>`, is:

- A `build.yml` workflow runs on every push to `main` and on PRs.
- A separate deploy step (host-specific) runs only on `main`.
- A scheduled `sync-github-metadata.yml` workflow runs `grove sync github` weekly and commits the result back.

For a private site (`--github none`), only the `build.yml` workflow is generated. You can add the deploy step manually.

See [Customize the Astro template](/guides/customize-astro-template/) for editing the workflows and `astro.config.mjs` if the defaults don't match your host.
