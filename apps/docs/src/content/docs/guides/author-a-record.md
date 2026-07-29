---
title: Author a record
description: How a contributor writes a new YAML record, from "I found an app" to "it's on the site".
---

This guide is the contributor's path. The companion [Record schema reference](/reference/record-schema/) lists every field; this guide walks through *deciding* which fields matter for your record.

If you just want the minimum viable record, see [Add your first project](/getting-started/add-your-first-project/) first. Come back here when your record needs to be more than a stub.

## The decision tree

When you sit down to add a record, answer these in order. Most contributors stop after the third.

1. **What blueprint is this site?** Look at `grove.config.ts` — the `blueprint` field. V1 ships three:
   - `project-directory` → `kind: project`
   - `resource-hub` → `kind: resource`
   - `ecosystem-map` → `kind: entity`

   Your record's `kind` must match. If it doesn't, the `grove check` step fails. See the [Blueprints concept](/concepts/blueprints/) page for which blueprint your site should be using.

2. **Does a record for this thing already exist?** `grep -r "repoUrl: " data/records/` or check the live site's record index. If yes, edit the existing one — don't fork.

3. **What is the canonical URL?** For projects, that's the GitHub repo. Set `repoUrl`. Don't just set `links.github` — `repoUrl` is the single source of truth for stars, contributors, and the "view repo" CTA. `links.github` is the human-facing display URL on the project page.

4. **Is it worth listing?** If you have to ask, list it. The health block will demote it to `experimental` tier automatically; promotion to `curated` happens when stars and maintenance signals accumulate. This is how `grove sync github` keeps the directory honest.

5. **What category?** Look at the other records in the same directory and pick the closest match. New categories are easy to add (it's a string field) but they show up as orphans until the second record joins.

## Anatomy of a project record

This is the shape you'll write 90% of the time. Comments are not allowed in YAML; the field guide is below.

```yaml
kind: project          # required, must match grove.config.ts blueprint
slug: astro             # required, matches the filename
name: Astro              # required, display name
description: |          # required, one- or two-sentence pitch
  Astro is a web framework for content-driven sites.
category: frameworks    # required, must be non-empty (defaults to "uncategorized")
tags:                   # optional, but most records have 2-5
  - web
  - static-site
repoUrl: https://github.com/withastro/astro   # canonical repo URL
logoUrl: https://avatars.githubusercontent.com/u/79145104  # optional
projectType: framework  # optional but recommended; see below
stack: typescript       # optional, primary stack (single string)
stacks:                 # optional, all stacks (array)
  - typescript
  - go
platforms:              # optional
  - web
difficulty: intermediate  # optional
codebaseSize: large     # optional
bestFor:                # optional, list of use-cases
  - content sites
  - docs sites
whyListed:              # optional, editor's note
  - Strong content collections model
  - First-class MDX support
caveats:                # optional, things to watch for
  - Newer than Next.js; smaller plugin ecosystem
```

### Field guide

`projectType` — one of `real-app`, `production`, `reference`, `library`, `tool`, `demo`, `template`, `historical`. The Astro template renders this as a chip on the project detail page. Pick the closest, not the most flattering.

`stack` vs `stacks` — `stack` is a single string for "primary language". `stacks` is an array of all languages used. If you only know one, fill `stack`; `stacks` is optional.

`difficulty` — how hard is this for a new contributor to get running? `beginner` = clone, install, dev in five minutes. `intermediate` = some setup. `advanced` = a day of reading.

`codebaseSize` — `small` (under 10k LoC), `medium`, `large`, `huge`. This is editorial — don't try to be precise, the goal is to set reader expectations.

`bestFor` — what someone should reach for this for. 1-3 short phrases.

`whyListed` — the editor's case for inclusion. Different from `bestFor`: `bestFor` says what the project is good at; `whyListed` says why the editor thinks it belongs in *this* directory.

`caveats` — what to watch out for. Empty is fine; populated is great.

## Anatomy of a resource record

For the `resource-hub` blueprint. Note the different required fields — `title` (not `name`), `type`, `topic`.

```yaml
kind: resource
slug: prisma-vs-drizzle
title: Prisma vs Drizzle — an honest comparison
description: A side-by-side look at the two TypeScript ORMs
type: comparison             # required
topic: databases             # required
related:                     # optional, slugs of related resources
  - prisma-overview
  - drizzle-overview
publishedAt: 2025-09-15      # optional, ISO date
author: jane@example.com     # optional
```

`type` — one of `guide`, `comparison`, `link`, `explainer`, `tool`, `video`, `article`, `course`, `book`, `podcast`, `other`. The Astro template renders this as a tag in the resource index.

`topic` — free-form. Pick something that matches the other resources' topics; if you create a new one, it shows up as a one-record topic until another joins.

`related` — slugs of other records. Used by the template to render a "related" block on the detail page.

## Anatomy of an entity record

For the `ecosystem-map` blueprint. Records of *organizations*, not products.

```yaml
kind: entity
slug: mozilla-foundation
name: Mozilla Foundation
description: Nonprofit that promotes a healthy internet
type: organization   # required
founded: 2003        # optional
location:            # optional
  - US
members: 30          # optional, approximate
parent:              # optional, slug of a parent entity
```

`type` — `company`, `organization`, `community`, `school`, `university`, `research-lab`, `agency`, `service`, `product`, `person`, `other`.

`parent` — use sparingly. Most entities are roots; only add a parent if the entity is a sub-org of something notable in your map.

## Optional fields shared by all kinds

These can be added to any record regardless of `kind`.

```yaml
# Long-form content (markdown body). Path is relative to content/records/.
content: ./bodies/astro-overview.md

# Source tracking — auto-filled by grove readme generate, manual otherwise.
source:
  type: manual
  file: data/records/astro.yml
  # For github-topic, awesome-list, submit, or import:
  url: https://github.com/withastro/astro
  provider: github
  owner: withastro
  repo: astro

# Curation: editor's review status
curation:
  reviewed: true
  reviewedBy: jane
  reviewedAt: 2025-10-12
  notes: Verified by Jane on 2025-10-12; promoted from experimental.
  labels:                  # special labels rendered as chips
    - featured
    - mature
  lenses:                  # free-form tags for filtered views
    - open-source
    - typed

# Editorial scores, 0-100
scores:
  activity: 95
  maturity: 90
  learning: 70
  contribution: 85
  docs: 90
  overall: 88

# Custom links (catch-all)
links:
  github: https://github.com/withastro/astro
  website: https://astro.build
  docs: https://docs.astro.build
  changelog: https://github.com/withastro/astro/releases
```

`curation.labels` — only `new`, `hot`, `mature`, `featured` are special. The template renders them as chips; anything else is shown as plain text.

`scores` — manual scores. Most records leave this empty and let the auto-derived health block speak. Use it when you have a strong editorial opinion the signals can't capture.

## Common mistakes

**Setting only `links.github`, not `repoUrl`.** The health block, star count, and "view repo" button all use `repoUrl`. If you set only `links.github`, the page will render the link but every GitHub-derived field will be empty until `grove sync github` runs and the missing `repoUrl` warning shows up.

**Using an inconsistent `slug`.** The slug is the filename minus `.yml`. If you set `slug: prisma-vs-drizzle` in `prisma-vs-drizzle.yml`, great. If you set `slug: prisma-vs-drizzle` in `prisma.yml`, the URL will be `/resources/prisma-vs-drizzle/` but the file is at `prisma.yml` — confusing for the next contributor. The CLI tolerates this; the GitHub UI does not.

**Editing the `health` block by hand.** The health block is auto-derived from GitHub metadata on every `grove sync github` run. Hand edits get overwritten. If you disagree with the auto-derived health, write a decision (`data/decisions.yml`) — see [Manage decisions](/guides/manage-decisions/).

**Adding a `category` with no other records.** It's a string field, so it'll save. But until the second record joins that category, it shows up as a one-record section in the index, which reads as "the editor gave up halfway through". Add the second record in the same PR.

## After you write the record

1. `pnpm exec grove check` — validates against the Zod schema, generates the JSON payloads, and runs `astro check`. Catches typos, wrong enums, missing required fields.
2. `pnpm dev` (or `pnpm build`) — see the record on the site.
3. Open a PR. The CI workflow runs `grove check` plus `astro build`. If your site has `integrations.github: public`, the `sync-github.yml` workflow also enriches the record with live metadata.

See [Sync GitHub metadata](/guides/sync-github-metadata/) for what the sync step does, and [Maintain health signals](/guides/maintain-health-signals/) for what to do when CI flags a record as stale.
