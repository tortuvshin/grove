---
title: Deploy your site
description: Push your Grove directory to GitHub and deploy it through GitHub Actions. The easiest path is GitHub Pages.
---

## Recommended: GitHub Pages

The scaffolded `apps/example/.github/workflows/deploy.yml` workflow
builds your site and deploys to GitHub Pages on every push to `main`.

1. **Push the project to GitHub.** Create a new repository and push.

   ```bash
   git remote add origin https://github.com/you/my-directory.git
   git push -u origin main
   ```

2. **Enable GitHub Pages.** Go to **Settings → Pages**. Set the source
   to **GitHub Actions** (not "Deploy from a branch").

3. **Watch the workflow run.** Open the **Actions** tab. The
   `deploy.yml` workflow installs dependencies, runs `pnpm build` (which
   chains `astro check` → `pnpm exec grove check` → `astro build`),
   and deploys.

4. **Set a custom domain (optional).** Add a `CNAME` file at the
   project root or use the Pages settings to wire up your domain.

The site is live at `https://you.github.io/my-directory/` (or your
custom domain).

## Other providers

### Cloudflare Pages

The scaffold ships an `apps/example/astro.config.mjs` configured for
static output; Cloudflare Pages picks it up directly. Wire up your
Cloudflare Pages project to the GitHub repo and Cloudflare runs
`pnpm build` on every push.

### Netlify

Netlify also reads the static output. Wire up the project, set the
build command to `pnpm build` and the publish directory to `dist/`.

### Any static host

If you run your own static host (S3 + CloudFront, Fastly, your own
nginx), wire up your own CI. The build artifact is the `dist/`
directory produced by `pnpm build` — drop it anywhere that serves
static files.

## Continuous deploys

Every provider workflow runs on push to `main`. The
`ci.yml` workflow runs on every pull request and blocks merge on
schema errors. The `sync-github.yml` workflow runs on a schedule and
on demand to refresh stars, licenses, and last-pushed dates.

## Local preview before deploy

```bash
pnpm build
pnpm preview
```

The `preview` script serves the production build locally. Walk through
every page, check every filter, click every link before you push.

## Next steps

- **[Configure your space →](/getting-started/configure/)** — branding, theme,
  taxonomy.
- **[Community submissions →](/automation/submissions/)** — accept
  new entries from contributors.