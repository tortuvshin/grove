---
title: Records
description: One file, one typed entity, schema per blueprint.
---

# Records

A record is one typed entity in a Grove site, stored as a single YAML file at `data/records/<slug>.yml`. The schema depends on the site's blueprint — see [Three blueprints](/concepts/blueprints/):

- `project-directory` → `kind: project`
- `resource-hub` → `kind: resource`
- `ecosystem-map` → `kind: entity`

Every kind shares the same base fields (slug, name/title, description, summary, sourceDescription, category, tags, links, content, source, curation, scores, visibility) and adds kind-specific fields. The base is in `packages/core/src/schema.ts:resourceBaseSchema`; each kind is a `z.object().extend()` of that base.

## Minimal record

```yaml
kind: project
name: my-project
description: One-line summary of what the project does.
```

That's enough for `grove check` to validate and `astro build` to render a record detail page. The slug is the filename: `data/records/my-project.yml`.

## Where the schema lives

The full schema for every kind is documented at [Record schema](/reference/record-schema/). The implementation is:

| Schema | Path |
|---|---|
| Resource base (shared) | `packages/core/src/schema.ts:resourceBaseSchema` |
| `projectRecordSchema` | `packages/core/src/schema.ts:351` |
| `resourceRecordSchema` | `packages/core/src/schema.ts:432` |
| `entityRecordSchema` | `packages/core/src/schema.ts:448` |
| `resourceSchema` (discriminated union) | `packages/core/src/schema.ts:464` |
| `recordsFileSchema` (one file = one record) | `packages/core/src/schema.ts:487` |

## What every record carries

The shared base. These fields are valid for any record regardless of `kind`:

```yaml
# resourceBaseSchema fields
slug: my-record                            # matches filename; kebab-case by convention
description: One-line summary.             # default: ""
summary: Curator-written lead paragraph.    # optional; rendered above sourceDescription
sourceDescription: Original-from-GitHub.   # optional; preserved against curator edits
category: ai-tools                          # taxonomy category id; default: "uncategorized"
tags: [llm, agent]                          # default: []
links:                                      # default: {}
  github: https://github.com/me/my-record
  website: https://example.com
content: content/records/my-record.md       # optional markdown body path
source:                                     # how the record was authored
  type: manual                              # manual | github-topic | awesome-list | submit | import
visibility: keep                            # default "keep"; see Decisions
curation:                                   # reviewer metadata
  reviewed: false                           # default false
  reviewedBy:
  reviewedAt:
  notes:
  labels: []                                # one of: new, hot, mature, featured
  lenses: []                                # any lens id
scores:                                     # default {}
  activity: 0..100
  maturity: 0..100
  learning: 0..100
  contribution: 0..100
  docs: 0..100
  overall: 0..100
```

The slug must match the filename. `kind` discriminates between blueprints. `category` must be a valid id from `data/taxonomy/categories.yml` (otherwise the record fails to validate).

## What each kind adds

### Project (default scaffold)

```yaml
kind: project
name: My Project
projectType: tool                          # real-app, production, reference, library, tool, demo, template, historical
stack: python                              # (legacy single stack)
stacks: [python, typescript]               # preferred for new records
platforms: [web]
licenses: [mit]
difficulty: intermediate                   # beginner, intermediate, advanced
codebaseSize: medium                       # small, medium, large, huge
repoUrl: https://github.com/me/my-project
logoUrl: https://example.com/logo.png
screenshots: []                            # curated gallery
bestFor: ["Use case A", "Use case B"]
whyListed: ["Reason 1", "Reason 2"]
caveats: ["Caveat 1"]
distribution:
  channels: []
github:                                    # refreshed by grove sync github
  repository: {}                           # raw REST shape
  languages: {}
  sync: { syncedAt, source }
health:                                    # auto-derived by classifyHealth()
  status: active
  maturity: useful
  tier: listed
  visibility: keep
  cleanupCandidate: false
  confidence: medium
  reasons: []
```

### Resource

```yaml
kind: resource
title: "An article title"
type: guide                                # guide, comparison, link, explainer, tool, video, article, course, book, podcast, other
topic: knowledge-management
related: [another-resource-slug]
publishedAt: "2026-04-01"
author: "Author Name"
```

### Entity

```yaml
kind: entity
name: "My Organization"
type: organization                         # company, organization, community, school, university, research-lab, agency, service, product, person, other
founded: "2026-01-01"
location: "Ulaanbaatar, MN"
members: 12
parent: parent-org-slug                    # optional parent entity
```

## What you'll do day-to-day

- **Add a record** — create `data/records/<slug>.yml` with at least `kind`, `name`/`title`, `description`.
- **Add a Markdown body** — create `content/records/<slug>.md` and set `content:` to its relative path.
- **Tag and categorize** — set `category`, `tags`, `stacks`, `platforms`, `licenses` from the matching `data/taxonomy/*.yml`.
- **Curate** — set `curation.{reviewed,reviewedBy,lables,lenses}`, `scores.*`, or `visibility`.
- **Add screenshots** — list `screenshots: [{ src, alt, source?, width?, height? }]`.

See [Author a record](/content/author-a-record/) for the full walkthrough.
