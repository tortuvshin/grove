---
title: Resource hub
description: The resource-hub blueprint — for collecting resources, articles, tutorials, and references.
---

The **resource hub** blueprint (`kind: resource-hub`) is for spaces that collect *resources* — articles, tutorials, videos, tools, references, papers — rather than projects. The structure mirrors a library catalogue: each entry has a title, a URL, a source, an author, and rich taxonomy tags. There are no GitHub-specific fields, no star counts, no contributors.

## When to use it

Choose `resource-hub` when your space answers one of:

- *“What are the best resources for learning X?”*
- *“Where can I find curated articles / videos / podcasts about Y?”*
- *“I want a knowledge base of links, organized by topic.”*

Common use cases: learning hubs, link blogs, research digests, internal documentation portals, topic-focused newsletters.

## Schema

A resource record (`data/records/<slug>.yml`):

```yaml
kind: resource-hub
slug: awesome-rust-books
title: "Awesome Rust Books"
url: https://rust-ebooks.dev/
description: A curated list of paid and free books covering Rust.
visibility: keep
taxonomy:
  categories: [books]
  stacks: [rust]
  platforms: [web]
  licenses: [cc-by-sa]
  tags: [learning, reading]
```

### Required fields

| Field | Type | Description |
|---|---|---|
| `kind` | `"resource-hub"` | Discriminator; must match the blueprint kind. |
| `slug` | string | URL-safe identifier (lowercase, dash-separated). |
| `title` | string | Display name. |
| `url` | URL | Canonical URL of the resource. |
| `description` | string | One-paragraph summary. |

### Optional fields

| Field | Type | Description |
|---|---|---|
| `visibility` | `"keep"` \| `"hide"` | Curator override; defaults to `keep`. |
| `taxonomy` | object | Map of taxonomy-name → list of slugs. |
| `featured` | boolean | Pin to featured lens. |
| `source` | object | Provenance (`type`, `url`, `addedAt`). |
| `scores` | object | Curator scores (quality, depth). |
| `topics` | string[] | Free-form tags. |
| `updatedAt` | ISO 8601 | Last meaningful update. |
| `images` | object | Cover image, screenshots. |

## Differences from `project-directory`

| Aspect | `project-directory` | `resource-hub` |
|---|---|---|
| Primary URL | Repository URL (`repoUrl`) | Resource URL (`url`) |
| GitHub metadata | Auto-fetched (`sync github`) | Not applicable |
| Contributors | Tracked | Optional, only if cited |
| Health signals | Commit age, star count | Last verified date |
| Score axes | Adoption, activity | Quality, depth, recency |

## Generated outputs

The blueprint emits the same set of artifacts as `project-directory` (`llms.txt`, `sitemap.xml`, JSON-LD `CreativeWork`), but JSON-LD type is `CreativeWork` instead of `SoftwareSourceCode`.

## Related

- [Project directory blueprint](/blueprints/project-directory/)
- [Author a record](/sources/records/)
- [Health classification](/sources/health-classification/)