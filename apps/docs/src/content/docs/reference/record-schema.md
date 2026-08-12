---
title: Record schema
description: The discriminated Resource union — every kind, every field, every default. The schema `grove check` validates and generates against.
---

Grove V1 ships a discriminated `Resource` union with three concrete
shapes, bound 1:1 to the three [blueprints](/concepts/blueprints/):

- `kind: 'project'` — `project-directory` blueprint
- `kind: 'resource'` — `resource-hub` blueprint
- `kind: 'entity'` — `ecosystem-map` blueprint

Every record inherits a **shared base** and adds a kind-specific
extension. The CLI rejects records whose `kind` does not match the
space's `blueprint` in `grove.config.ts`.

**Convention:** one file per record, named `<slug>.yml`. The file
name is the canonical slug. The build pipeline enforces
`slug === filename-without-extension`.

## The shared base

Every record, regardless of `kind`, carries these fields:

### `slug`

**Type:** `string` (required, min 1)
**Convention:** kebab-case, matching the filename

The unique identifier. Used as the URL, the cross-reference key
(`related[]`, `parent`), and the in-page anchor.

### `description`

**Type:** `string` · **Default:** `""`

A short, single-sentence summary. Shown in list cards, search
snippets, and `llms.txt`. Aim for under 200 characters; the
renderer truncates with an ellipsis after that.

### `category`

**Type:** `string` (required, min 1) · **Default:** `"uncategorized"`

A single category. Configure the allowed set in
`data/taxonomy/categories.yml` (or by convention in your space).

### `tags`

**Type:** `string[]` · **Default:** `[]`

Free-form labels. Normalize by convention (lowercase, kebab-case)
so cross-record searches work.

### `links`

**Type:** `Record<string, string>` (URL values) · **Default:** `{}`

A map of named links. Recognized keys: `github`, `website`, `docs`,
`source`. Additional keys are allowed (catchall) for project-specific
links.

### `content`

**Type:** `string` (path) · **Default:** `undefined`

Optional path to a Markdown body for the record, relative to
`paths.bodiesDir` (default `content/records/`). The renderer
embeds the body on the detail page.

### `source`

**Type:** `object` · **Default:** `{ type: "manual" }`

Provenance. Useful for distinguishing hand-authored records from
imported ones.

| Field | Type | Description |
|---|---|---|
| `type` | `"manual" \| "github-topic" \| "awesome-list" \| "submit" \| "import"` | How the record was created |
| `file` | `string` | Original file path (for imports) |
| `url` | `string` | Original source URL |
| `provider` | `string` | Provider name (e.g. `github`) |
| `owner` | `string` | GitHub owner (if applicable) |
| `repo` | `string` | GitHub repo name (if applicable) |

### `curation`

**Type:** `object` · **Default:** `{ reviewed: false, labels: [], lenses: [] }`

Curator metadata on the record itself.

| Field | Type | Default | Description |
|---|---|---|---|
| `reviewed` | `boolean` | `false` | Has a human reviewed this record? |
| `reviewedBy` | `string` | — | Curator handle |
| `reviewedAt` | `string` | — | ISO timestamp |
| `notes` | `string` | — | Free-form curator notes |
| `labels` | `Array<"new" \| "hot" \| "mature" \| "featured">` | `[]` | Curator-applied labels (separate from auto-derived `health.tier`) |
| `lenses` | `string[]` | `[]` | Lens names this record should appear in (e.g. `hot`, `new`, `mature`) |

### `scores`

**Type:** `object` · **Default:** `{}`

Optional 0-100 scores for the record across multiple dimensions.
Adapters and the home page can use these to rank and filter.

| Field | Type | Range | Description |
|---|---|---|---|
| `activity` | `number` | 0-100 | Recency and frequency of commits |
| `maturity` | `number` | 0-100 | Stability and production-readiness |
| `learning` | `number` | 0-100 | Quality of docs, examples, and onboarding |
| `contribution` | `number` | 0-100 | Openness to outside contributions |
| `docs` | `number` | 0-100 | Quality of documentation |
| `overall` | `number` | 0-100 | Composite score |

### `visibility`

**Type:** `"highlight" \| "keep" \| "needs_review" \| "hide" \| "remove" \| "historical"` · **Default:** `"keep"`

Effective visibility after any `decisions.yml` override. For
`project` records, the canonical signal lives in
`health.visibility`; for `resource` and `entity` records, this
top-level `visibility` is the source of truth.

## `ProjectRecord` (`kind: project`)

For the `project-directory` blueprint. The full record with
project-specific fields:

```yaml
kind: project
slug: cal-com
name: Cal.com
description: Open-source scheduling infrastructure for teams and platforms.
category: productivity
tags: [scheduling, calendar, saas]
links:
  github: https://github.com/calcom/cal.com
  website: https://cal.com
repoUrl: https://github.com/calcom/cal.com
logoUrl: https://example.com/calcom-logo.png
stack: Next.js
stacks: [Next.js, TypeScript, Prisma, tRPC]
platforms: [Web, Self-hosted]
projectType: production           # real-app | production | reference | library | tool | demo | template | historical
difficulty: intermediate          # beginner | intermediate | advanced
codebaseSize: large               # small | medium | large | huge
bestFor:
  - Adding scheduling to SaaS products
  - Replacing Calendly with a self-hostable alternative
whyListed:
  - Active, well-maintained open-source project
caveats:
  - Requires Postgres for self-hosted setups
distribution:
  channels:
    - { type: docker, platform: linux, label: "Docker image" }
    - { type: website, url: https://cal.com, verified: true }
github:
  repository:
    full_name: calcom/cal.com
    stargazers_count: 32000
    pushed_at: "2024-09-14T..."
  sync:
    syncedAt: "2024-09-14T..."
    source: api
health:
  status: active                 # active | mature | stale | inactive | archived | unknown | historical | needs_review | quiet | unavailable
  maturity: mature               # experimental | useful | mature | unknown
  tier: curated                  # curated | listed | experimental | hidden
  visibility: keep               # (see Visibility enum above)
  cleanupCandidate: false
  confidence: high               # low | medium | high
  reasons: []
```

### Project-specific fields

| Field | Type | Description |
|---|---|---|
| `name` | `string` (required) | Human-readable name. Shown in cards and headings. |
| `projectType` | enum | One of `real-app`, `production`, `reference`, `library`, `tool`, `demo`, `template`, `historical` |
| `stack` | `string` | The single primary stack piece (e.g. `Next.js`) |
| `stacks` | `string[]` | Full stack list |
| `platforms` | `string[]` | `Web`, `Self-hosted`, `CLI`, `iOS`, `Android`, etc. |
| `difficulty` | enum | `beginner` \| `intermediate` \| `advanced` |
| `codebaseSize` | enum | `small` \| `medium` \| `large` \| `huge` |
| `repoUrl` | `string` (URL) | Canonical repo URL. **Preferred** by `grove sync github` over `links.github`. |
| `logoUrl` | `string` (URL) | Optional logo/avatar. Falls back to the GitHub owner avatar (for `github.com` `repoUrl`) or initials. |
| `bestFor` | `string[]` | Short bullets on what the project is good for |
| `whyListed` | `string[]` | Curator note: why this record is included |
| `caveats` | `string[]` | Curator note: things to be aware of |
| `distribution.channels` | array | Where the project ships: `docker`, `npm`, `pypi`, `website`, etc. |
| `github.repository` | object | Live metadata from `grove sync github` (do not edit by hand) |
| `health` | object | Auto-derived + curator-overridden health block |

### The `health` block

The `health` block is the **auto-derived** signal of how fresh and
relevant the record is. It is populated by `grove sync github` and
can be overridden by curator decisions in `data/decisions.yml`.

| Field | Type | Description |
|---|---|---|
| `status` | enum | `active` (commit ≤ 183d), `stale` (184–548d), `inactive` (> 730d), `archived`, `unknown` — plus editor-only `mature` / `quiet` / `historical` / `needs_review` / `unavailable` set via `decisions.yml`. Implementation in `packages/core/src/health.ts: classifyHealth`. |
| `maturity` | enum | `experimental`, `useful`, `mature`, `unknown` — `mature` is auto-set when `active` + ≥ 500★ + maintained signals (recent release or clear license). |
| `tier` | enum | `curated` (≥ 500★), `listed` (≥ 50★), `experimental` (else), `hidden` (status is `archived` or `inactive`). The record is still in the data; `hidden` only excludes it from the index. |
| `visibility` | enum | `keep` (tier=curated/listed/experimental), `hide` (tier=hidden) — overridden by `decisions.yml`. |
| `cleanupCandidate` | `boolean` | `true` when `status` is `stale`, `archived`, or `inactive`. Drives `grove cleanup`. |
| `staleReason` | `string \| null` | Machine-readable reason: `no_commits_365_days` (stale), `no_commits_24_months` (inactive), `github_archived`. |
| `confidence` | enum | `low`, `medium`, `high` — `high` when GitHub metadata is complete; `low` when no GitHub data exists at all. |
| `reasons` | `string[]` | Human-readable reasons explaining the current state (e.g. "Recent repository activity", "Repository is archived on GitHub"). |

**Health is a review signal, not a final ranking.** The
`cleanup.yml` workflow surfaces records with
`cleanupCandidate: true` for human review; the curator decides
whether to keep, hide, mark historical, or remove.

## `ResourceRecord` (`kind: resource`)

For the `resource-hub` blueprint. For curating pieces of content:

```yaml
kind: resource
slug: choosing-a-database
title: How to choose a database for your side project
type: guide                     # guide | comparison | link | explainer | tool | video | article | course | book | podcast | other
topic: databases                # the high-level topic
description: A practical decision tree for picking a database.
category: engineering
tags: [database, postgresql, sqlite]
links:
  website: https://example.com/db-chooser
related:                        # slugs of related resources
  - postgres-vs-sqlite
  - understanding-indexes
publishedAt: "2024-08-01"
author: Jane Doe
```

### Resource-specific fields

| Field | Type | Description |
|---|---|---|
| `title` | `string` (required) | The resource's title |
| `type` | enum (required) | `guide` \| `comparison` \| `link` \| `explainer` \| `tool` \| `video` \| `article` \| `course` \| `book` \| `podcast` \| `other` |
| `topic` | `string` (required) | High-level topic (e.g. `databases`, `deployment`, `career`) |
| `related` | `string[]` | Slugs of related resources |
| `publishedAt` | `string` (date) | Publication date |
| `author` | `string` | Author name |

## `EntityRecord` (`kind: entity`)

For the `ecosystem-map` blueprint. For curating organizations
and people:

```yaml
kind: entity
slug: mn-ai-community
name: Mongolia AI Community
type: community                  # company | organization | community | school | university | research-lab | agency | service | product | person | other
description: A community of AI practitioners in Mongolia.
category: community
tags: [ai, mongolia, community]
founded: "2023-04-15"
location: Ulaanbaatar, Mongolia
members: 250
parent: mn-tech-scene            # slug of a parent entity
links:
  website: https://example.com/mn-ai
```

### Entity-specific fields

| Field | Type | Description |
|---|---|---|
| `name` | `string` (required) | The entity's name |
| `type` | enum (required) | `company` \| `organization` \| `community` \| `school` \| `university` \| `research-lab` \| `agency` \| `service` \| `product` \| `person` \| `other` |
| `founded` | `string` (date) | Founding date (ISO) |
| `location` | `string` | Free-form location (city, country, "Remote", etc.) |
| `members` | `number` (int ≥ 0) | Member count, if applicable |
| `parent` | `string` | Slug of a parent entity (for sub-communities) |

## Related docs

- **[Blueprints](/concepts/blueprints/)** — which `kind` goes with
  which blueprint.
- **[grove.config.ts](/reference/config/)** — site config.
- **[CLI](/reference/cli/)** — `grove check` validates and
  generates against this schema.
