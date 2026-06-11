---
title: Add your first record
description: Write a YAML record, validate it, generate the data, and see it render in the site. The smallest possible end-to-end Grove loop.
---

After [creating a space](/getting-started/create-a-space/), your
`data/records/` directory is empty (just a `.gitkeep` file). This
page walks you through writing your first record, validating it,
and watching it appear in the running site.

The whole loop takes about five minutes.

## When to use this

Use this page when you already have a Grove space and want to add a
single record by hand. If you are migrating an existing awesome list
or GitHub topic into Grove, see the
[migrate from an awesome list](/guides/migrate-from-awesome-list/)
guide (Phase 2) — that path uses `grove import` and skips the
hand-written YAML.

## Before you start

- You have a Grove space scaffolded (see [create a space](/getting-started/create-a-space/))
- The dev server is running (`pnpm dev`) at `http://localhost:4321`
- You have a project in mind — a real open-source tool, library, or
  app that fits the `project-directory` blueprint

## Step 1 — Pick a slug

Every record file is named `<slug>.yml`. The slug becomes the URL,
the cross-reference key, and the in-page anchor.

**Convention:** kebab-case, ASCII, no spaces, no dots. Examples:
`cal-com.yml`, `foyle.yml`, `zod.yml`.

The slug must be unique across the space. If you write
`data/records/cal-com.yml` and there is already a
`data/records/cal-com-2.yml`, that's fine — the second one needs a
different `slug:` field inside, but the filename is what matters.

## Step 2 — Write the YAML

Create `data/records/cal-com.yml`:

```yaml
kind: project
slug: cal-com
name: Cal.com
description: Open-source scheduling infrastructure for teams and platforms.
category: productivity
tags:
  - scheduling
  - calendar
  - saas
links:
  github: https://github.com/calcom/cal.com
  website: https://cal.com
repoUrl: https://github.com/calcom/cal.com
stack: Next.js
stacks:
  - Next.js
  - TypeScript
  - Prisma
  - tRPC
platforms:
  - Web
  - Self-hosted
projectType: production
bestFor:
  - Adding scheduling to SaaS products
  - Replacing Calendly with a self-hostable alternative
whyListed:
  - Active, well-maintained open-source project
  - Strong API and embeddable UI
  - Production-ready with paying customers
```

**Field-by-field:**

| Field | Required? | What it is |
|---|---|---|
| `kind` | yes | Must match your space's blueprint: `project` for `project-directory` |
| `slug` | yes | The record's unique id. Convention: matches the filename |
| `name` | yes | Human-readable name, shown in cards and headings |
| `description` | yes | One-sentence summary, shown in lists and search snippets |
| `category` | yes | One of your taxonomy categories. Defaults to `uncategorized` |
| `tags` | no | Free-form labels, normalized by convention |
| `links` | no | URLs to the project's website, GitHub, docs, etc. |
| `repoUrl` | no | Canonical GitHub repo URL. Used by `grove sync github` |
| `stack` | no | A single short stack name, e.g. `Next.js` |
| `stacks` | no | Array of detailed stack pieces |
| `platforms` | no | e.g. `Web`, `Self-hosted`, `CLI`, `iOS` |
| `projectType` | no | One of `real-app`, `production`, `reference`, `library`, `tool`, `demo`, `template`, `historical` |
| `bestFor` | no | Short bullets on what the project is good for |
| `whyListed` | no | Curator note: why this record is included |
| `caveats` | no | Curator note: things to be aware of |

The full schema lives in [Record schema](/reference/record-schema/).

## Step 3 — Validate

```bash
grove validate
```

If the YAML is well-formed and the fields satisfy the
`project-directory` schema, you should see:

```
Validation passed.
```

If you see errors, they look like:

```
✖ invalid_field: data/records/cal-com.yml: projectType must be one of real-app, production, reference, library, tool, demo, template, historical
```

Fix the field the error names and re-run.

## Step 4 — Generate the data

```bash
grove generate
```

This writes three files under `data/generated/`:

- `records.full.json` — every record, every field. Source of truth
  for the renderer.
- `records.index.json` — a slim projection with only the fields the
  list/detail pages need.
- `records.json` — alias for `records.full.json`, for tools that
  expect a stable filename.

Output:

```
[generate] 1 total, 1 visible
  full:  data/generated/records.full.json
  index: data/generated/records.index.json
  alias: data/generated/records.json
```

The dev server watches `data/generated/` and will rebuild the page
the moment the file lands. Visit `http://localhost:4321/projects/cal-com/`
(or click the home page card) and you should see the record render.

## Step 5 — Build the production site

```bash
grove build
```

This runs the full chain:

```
grove generate   → data/generated/records.{full,index}.json
grove sitemap    → public/sitemap.xml
grove llms       → public/llms.txt + public/llms-full.txt
astro build      → static HTML in dist/
```

The output is plain static files. Deploy `dist/` to any static host
(Vercel, Netlify, Cloudflare Pages, GitHub Pages, S3 + CloudFront).

## What just happened — the data flow

```
data/records/cal-com.yml
    │
    │  grove validate          (schema check, fails fast)
    │  grove generate          (Zod parse → records.full.json + records.index.json)
    │  grove sitemap           (records.full.json → public/sitemap.xml)
    │  grove llms              (records.full.json → public/llms.txt + llms-full.txt)
    │
    ▼
data/generated/records.{full,index}.json
public/sitemap.xml
public/llms.txt
public/llms-full.txt
    │
    │  astro build              (consume records.index.json, render static pages)
    │
    ▼
dist/                         (deployable static site)
```

Every step is reviewable. Every step is reproducible. Every record
is a file.

## Common mistakes

**Wrong `kind:` for the blueprint.** A `project-directory` space
must have records with `kind: project`. Mismatches are a hard
validation error.

**Slug collision.** Two files with the same `slug:` field (or the
same filename) are flagged. Change one.

**Missing `description`.** It has a default (`""`) but the renderer
shows "No description" for empty strings. Always write a real
description.

**`stack` and `stacks` confusion.** `stack` is a single string
(the primary one), `stacks` is an array (the full list). Use both,
or use just `stacks`. Don't use only `stack` if you have multiple.

**YAML tabs.** Tabs are not valid YAML indentation. Use spaces.

## Next steps

- **[CLI reference](/reference/cli/)** — every command.
- **[Record schema](/reference/record-schema/)** — every field, every
  default, every kind.
- **[grove.config.ts reference](/reference/config/)** — taxonomy
  configuration, integrations, theme.
