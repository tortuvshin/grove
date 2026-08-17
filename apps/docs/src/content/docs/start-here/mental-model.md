---
title: Mental model
description: Files are canonical. Grove builds and maintains the useful surfaces around them.
---

# Mental model

```text
YAML + Markdown + configuration
              │
              ▼
            Grove
              │
      ┌───────┼─────────┐
      ▼       ▼         ▼
    Site    Derived    Maintenance
            outputs    workflows
```

There are three kinds of file in a Grove space.

## Author-owned

Files a human edits by hand, in their editor, in a pull request:

- **Records** — `data/records/<slug>.yml`. One typed entity per file.
- **Markdown bodies** — `content/records/<slug>.md`. Optional long-form content for a record.
- **Taxonomy** — `data/taxonomy/*.yml`. Six controlled vocabularies (`categories.yml`, `stacks.yml`, `platforms.yml`, `licenses.yml`, `topics.yml`, `distribution-channels.yml`). Each entry has an `id:` and a display label.
- **Decisions** — `data/decisions.yml`. Curator overrides for visibility, rename-slug, sort priority.
- **Collections** — `data/collections/<slug>.yml`. Either curated (`kind: curated`) or ranked (`kind: ranked`) groupings.
- **Content pages** — `content/pages/<slug>.md`. Standalone pages that aren't a record.
- **Configuration** — `grove.config.ts`. Identity, routes, facets, theme, integrations, audit.

PR review is the change-of-record. Editors don't log in.

## Derived

Files Grove writes on every build. Disposable and reproducible:

- HTML pages — `/`, `/projects/`, `/projects/<slug>/`, `/collections/<slug>/`, `/about/`, `/contributors/`, `/submit/`, `/404`, etc.
- JSON datasets — `data/generated/records.full.json`, `records.index.json`, `records.json`, `site-config.json`.
- `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt`.
- `public/og/<page>.png` — satori-rendered social cards.
- `public/og-image.svg` — sentinel-owned fallback OG image.
- `public/icons/**` — the packaged icon set; per-file ownership when the user edits one in place.
- The README block bounded by `<!-- grove-readme:start/end -->` — text outside the sentinels survives untouched.

Every generated artifact is a pure function of the source files plus `grove.config.ts`. To add an output, you change the pipeline; no downstream code change is needed.

## Refreshed facts

Fields that machines re-write but humans never edit:

- `github.{stars,forks,language,topics,license,contributorsKnown,...}` — refreshed by `grove sync github`.
- `health.{status,maturity,tier,visibility,cleanupCandidate,confidence,reasons}` — derived from GitHub signals plus the freshness rules in `packages/core/src/health.ts`.
- `data/generated/contributors.json` and `data/generated/repo-stats.json` — aggregated by `grove sync contributors`.

These blocks are owned by Grove. Curators should not edit them by hand; re-running the sync overwrites the diff. The merge contract guarantees that curator additions outside the sync surface survive a re-run.

## The central rule

> **Machines refresh facts. Maintainers make editorial decisions.**

`grove sync github` writes `github.*` and `health.*` blocks.
`grove cleanup` writes a triage report.
Neither deletes a record, changes `visibility`, or alters curator prose.

Decisions about which records to keep, hide, demote, or surface live in the record YAML itself or in `data/decisions.yml`.

## Consumer-owned

The scaffold ships with an Astro project at `src/pages/**`. Every consumer of Grove owns the **presentation**:

- Pages and routes.
- Components and layouts.
- Theme tokens via `src/styles/global.css` (auto-injected by `@grove-dev/astro`).
- Product copy.

`@grove-dev/astro` provides reusable components (Header, Footer, Container, RecordHeader, etc.) and adapters, but the consumer chooses what to render and how. See [Customize](/customize/components/).

## What that means in practice

- **Don't** put a record's content in a markdown file under `src/pages/`. Use `data/records/<slug>.yml` + `content/records/<slug>.md`.
- **Don't** edit `data/generated/records.json`. Run `grove check` to regenerate it.
- **Do** edit `data/records/*.yml`, `data/taxonomy/*.yml`, `data/decisions.yml`, and `grove.config.ts`. These are yours.
- **Do** check `data/generated/cleanup-report.json` to see what the maintenance loop flagged.
- **Do** take ownership of `public/robots.txt` by editing it; Grove keeps your edits after the first run.
