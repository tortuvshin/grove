---
title: Introduction
description: Grove is a file-first publishing system for structured knowledge. One source of truth — many useful outputs.
---

Grove is a **file-first publishing system for structured knowledge**.

You write the source of truth — YAML records, Markdown bodies, taxonomy files. Grove publishes it into a coordinated set of human- and machine-readable outputs and keeps everything in sync.

> Maintain structured knowledge in files. Grove publishes it into useful human- and machine-readable outputs and keeps everything in sync.

## One piece of content → many useful outputs

A single YAML record in `data/records/<slug>.yml` becomes, all at once:

| Output | Audience |
|---|---|
| A page on your site | Visitors browsing the directory |
| An entry in `sitemap.xml` | Search engines |
| An entry in `llms.txt` | AI assistants and crawlers |
| A JSON-LD `SoftwareSourceCode` block | Google rich results |
| An OG image preview | Slack, LinkedIn, Discord |
| A row in `data/generated/records.json` | Anything consuming your dataset |

The same loop applies to taxonomy, decisions, collections, and content pages. Files stay in your repo; outputs follow.

## Three blueprints

Every Grove space is built around one of three blueprints:

- **[project-directory](/blueprints/project-directory/)** — open-source projects (default).
- **[resource-hub](/blueprints/resource-hub/)** — articles, tutorials, videos, papers.
- **[ecosystem-map](/blueprints/ecosystem-map/)** — organizations, people, working groups.

Each blueprint has its own JSON-LD type, lens semantics, and visible-by-default fields. The same renderer serves all three.

## How it works

```bash
# 1. Scaffold
pnpm dlx @grove-dev/cli@latest init my-directory

# 2. Run the dev server
cd my-directory
pnpm install
pnpm dev

# 3. Edit records
$EDITOR data/records/<slug>.yml

# 4. Deploy
pnpm build && pnpm exec astro deploy
```

The CLI copies the example Astro space (`apps/example/`), wires up `@grove-dev/astro`, and runs `pnpm install`. The dev server starts at `http://localhost:4321`. Every record change shows up after a rebuild.

## What you can build

Grove fits problems where a community needs to curate a long-lived list of things — apps, tools, libraries, guides, organizations — and keep that list useful over months and years:

- **Open-source app directory** — `awesome-foo.com` clone with curation.
- **Developer tools index** — discoverable by humans *and* AI assistants.
- **Learning resources hub** — courses, videos, articles, organized by topic.
- **Ecosystem map** — foundations, companies, working groups in a domain.
- **Internal knowledge hub** — versioned data instead of spreadsheets.

## Mental model

```
  source files          Grove                  outputs
  ───────────          ──────                 ───────
  data/records/   ─►   prepareDirectory  ─►   *.html
  data/taxonomy/  ─►   generate()        ─►   sitemap.xml
  content/*.md    ─►   buildSitemap()    ─►   llms.txt + llms-full.txt
  grove.config.ts ─►   buildLlmsFiles()  ─►   JSON-LD per page
                     ─► buildSiteArtif. ─►   robots.txt
                     ─►                   ─►   og-image.svg
                     ─►                   ─►   data/generated/*.json
```

Each step is a pure function from sources to outputs. To add a new output, drop a function into the pipeline and emit one new file.

## Ready to start?

**[Create a project directory →](/getting-started/create-a-space/)** — scaffold your first Grove space in under 10 minutes.

**[Compare Grove to other tools →](/concepts/philosophy/#how-grove-compares-to-other-tools)** — when to use Grove and when to use Hugo, Astro, Docusaurus, or a CMS.

**[Read the full philosophy →](/concepts/philosophy/)** — why files, why static, why curation.