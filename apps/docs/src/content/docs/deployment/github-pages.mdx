---
title: GitHub Pages
description: Deploy a Grove space to GitHub Pages with the bundled ci.yml and deploy.yml workflows.
---

Grove spaces deploy to GitHub Pages with zero configuration beyond copying the two bundled workflows into `.github/workflows/`.

## Prerequisites

- A GitHub repository containing your Grove space.
- `astro build` produces a static `dist/` directory (default Astro behavior).
- GitHub Pages enabled in repository settings, source = "GitHub Actions".

## Workflow

The template ships `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec grove check
      - run: pnpm build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: ./dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }
    steps:
      - uses: actions/deploy-pages@v4
```

The `build` job runs `grove check` first (validates and generates `data/generated/*.json`, sitemap, llms files, robots, og-image), then `pnpm build` to produce the Astro static output.

## Custom domain

Add a `CNAME` file at `public/CNAME` containing your domain. Grove's `site.url` in `grove.config.ts` must match.

## Path-based deployment

To deploy under a subpath (e.g., `https://username.github.io/repo-name/`), set `base: '/repo-name'` in `astro.config.mjs` and `site.url` in `grove.config.ts` accordingly.

## Troubleshooting

- **404 on routes other than `/`** — set `trailingSlash: 'always'` in Astro config.
- **Old content after deploy** — verify the workflow ran `grove check` (it regenerates `data/generated/`).
- **Sitemap resolves to localhost** — verify `site.url` in `grove.config.ts`.

## Related

- [Cloudflare deployment](/deployment/cloudflare/)
- [Netlify deployment](/deployment/netlify/)
- [Self-hosted](/deployment/self-hosted/)