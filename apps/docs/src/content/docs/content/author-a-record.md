---
title: Author a record
description: How a contributor writes a new YAML record, from "I found an app" to "it's on the site".
---

If you want the minimum viable record, see [Author your first record](/getting-started/first-record/) first. Come back here when your record needs to be more than a stub.

The companion [Record schema reference](/reference/record-schema/) lists every field; this guide covers *deciding* which fields matter.

## The decision tree

When you sit down to add a record, answer these in order:

1. **What blueprint is this site?** Look at `grove.config.ts`. The three blueprints are:
   - `project-directory` → `kind: project`
   - `resource-hub` → `kind: resource`
   - `ecosystem-map` → `kind: entity`

   Your record's `kind` must match.

2. **Does a record already exist?** `grep -r "repoUrl: " data/records/` or check the live site's index. If yes, edit the existing one.

3. **What is the canonical URL?** For projects, that's the GitHub repo. Set `repoUrl` (not just `links.github` — `repoUrl` is the single source of truth for stars, contributors, and the "view repo" CTA).

4. **Is it worth listing?** If you have to ask, list it. The health block will demote it to `experimental` tier; promotion to `curated` happens when stars and maintenance signals accumulate.

5. **What category?** Pick the closest match. New categories are easy to add but show up as orphans until a second record joins.

## Anatomy of a project record

The shape you'll write 90% of the time:

```yaml
kind: project
slug: astro
name: Astro
description: |
  Astro is a web framework for content-driven sites.
category: frameworks
tags: [web, static-site]
repoUrl: https://github.com/withastro/astro
logoUrl: https://avatars.githubusercontent.com/u/79145104
projectType: framework
stack: typescript
stacks: [typescript, go]
platforms: [web]
difficulty: intermediate
codebaseSize: large
bestFor:
  - content sites
  - docs sites
whyListed:
  - Strong content collections model
  - First-class MDX support
caveats:
  - Newer than Next.js; smaller plugin ecosystem
```

### Field guide

`projectType` — `real-app`, `production`, `reference`, `library`, `tool`, `demo`, `template`, `historical`. Pick the closest, not the most flattering.

`stack` vs `stacks` — `stack` is a single string for "primary language". `stacks` is an array of all languages.

`difficulty` — `beginner` (clone/install/dev in 5 min), `intermediate` (some setup), `advanced` (a day of reading).

`codebaseSize` — `small` (under 10k LoC), `medium`, `large`, `huge`. Editorial; set reader expectations.

`bestFor` — what someone should reach for this for. 1-3 short phrases.

`whyListed` — the editor's case for inclusion. Different from `bestFor` ("what the project is good at") — `whyListed` says why the editor thinks it belongs in *this* directory.

`caveats` — what to watch out for. Empty is fine.

## Anatomy of a resource record

For the `resource-hub` blueprint. Note: `title` (not `name`), `type`, `topic`.

```yaml
kind: resource
slug: prisma-vs-drizzle
title: Prisma vs Drizzle — an honest comparison
description: A side-by-side look at the two TypeScript ORMs
type: comparison
topic: databases
related:
  - prisma-overview
  - drizzle-overview
publishedAt: 2025-09-15
author: jane@example.com
```

`type` — `guide`, `comparison`, `link`, `explainer`, `tool`, `video`, `article`, `course`, `book`, `podcast`, `other`.

`topic` — free-form. Match existing topics; new ones show up as one-record topics until another joins.

`related` — slugs of other records. Renders a "related" block on the detail page.

## Anatomy of an entity record

For the `ecosystem-map` blueprint. Records of *organizations*, not products.

```yaml
kind: entity
slug: mozilla-foundation
name: Mozilla Foundation
description: Nonprofit that promotes a healthy internet
type: organization
founded: 2003
location:
  - US
members: 30
```

`type` — `company`, `organization`, `community`, `school`, `university`, `research-lab`, `agency`, `service`, `product`, `person`, `other`.

## Common mistakes

**Setting only `links.github`, not `repoUrl`.** The health block, star count, and "view repo" button all use `repoUrl`. If you set only `links.github`, every GitHub-derived field is empty until `grove sync github` runs and the missing `repoUrl` warning shows up.

**Using an inconsistent `slug`.** The slug is the filename minus `.yml`. If `slug: prisma-vs-drizzle` is in `prisma.yml`, the URL is `/resources/prisma-vs-drizzle/` but the file is `prisma.yml` — confusing for the next contributor.

**Editing the `health` block by hand.** Auto-derived from GitHub metadata on every sync run. Hand edits get overwritten. If you disagree with the auto-derived health, write a [decision](/content/decisions/).

**Adding a `category` with no other records.** It saves, but until the second record joins, it shows up as a one-record section in the index. Add the second record in the same PR.

## After you write the record

1. `pnpm exec grove check` — validates against the Zod schema, generates the JSON payloads, runs `astro check`.
2. `pnpm dev` (or `pnpm build`) — see the record on the site.
3. Open a PR. The CI workflow runs `grove check` plus `astro build`. If `integrations.github` is enabled, `sync-github.yml` enriches the record with live metadata.

See [Health classification](/content/health-classification/) for what to do when CI flags a record as stale.