---
title: Quickstart
description: Get a Grove site running in under ten minutes.
---

# Quickstart

The fastest path to a working Grove site. The full tutorial lives in [Getting Started](/getting-started/scaffold/).

## Prerequisites

- Node `>=22.12.0`
- pnpm `10.12.1` (or any compatible Node package manager)

## 1. Scaffold a space

```bash
pnpm dlx @grove-dev/cli@latest init my-space
cd my-space
```

The CLI copies the canonical Astro template (`apps/example/`), rewrites `package.json` and `grove.config.ts` so `site.name` and the `name:` field match your directory, and runs `pnpm install`.

## 2. Start the dev server

```bash
pnpm dev
```

The site runs at `http://localhost:4321`. The Astro integration runs `prepareDirectory()` on every dev/build cycle, so record edits show up after a rebuild.

## 3. Replace the sample record

The scaffold ships with six sample records under `data/records/`. Delete or rewrite them.

```bash
rm data/records/ollama.yml
rm content/records/ollama.md
$EDITOR data/records/my-record.yml
$EDITOR content/records/my-record.md
```

A minimal record looks like:

```yaml
kind: project
name: my-project
description: One-line summary of what my-project does.
repoUrl: https://github.com/me/my-project
stacks: [typescript]
licenses: [mit]
```

`name` and the field set come from the **kind** (here, `project` — the default blueprint is `project-directory`). See [Author a record](/content/author-a-record/) for the full schema and many more examples.

## 4. Validate and build

```bash
pnpm exec grove check
pnpm build
```

`grove check` validates records, regenerates every artifact under `data/generated/` and `public/`, and runs `astro check`. `pnpm build` is the production build (Astro with your static adapter).

The deployable site is in `dist/`. Any static host serves it.

## 5. Deploy

The default scaffold ships with a GitHub Pages workflow (`.github/workflows/deploy.yml`). Before you push, preview the production build locally:

```bash
pnpm build && pnpm preview
```

When you're ready to ship, follow the [Deploy your site →](/deployment/overview/) guide — it covers GitHub Pages, Cloudflare, Netlify, and self-hosted setups.

## What just happened

- **`my-space/grove.config.ts`** — the configuration you edit to add navigation, branding, audit pages, integrations.
- **`my-space/data/records/`** — your records. One YAML file per record.
- **`my-space/data/taxonomy/`** — your vocabularies for filters and labels.
- **`my-space/src/pages/`** — your routes. Consumer-owned.
- **`my-space/public/`** — generated HTML, JSON, sitemap, OG images. Sentinel-owned files are marked.

## Common follow-ups

- Add a [taxonomy entry](/content/taxonomy-files/) and use it as a `category` on a record.
- Create a [collection](/content/collections/) by adding a `data/collections/<slug>.yml` or by running `grove collection promote`.
- Enable [GitHub sync](/automation/sync-github/) so each record grows a `github.*` block automatically.
- Replace the OG card with your own artwork in `public/og-image.svg` (edit it; the sentinel keeps your version).

The full tutorial continues at [Scaffold a space](/getting-started/scaffold/).
