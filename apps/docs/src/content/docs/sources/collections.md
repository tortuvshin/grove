---
title: Curated collections
description: How to author and maintain curated collections that filter records by tag, score, or feature.
---

A *collection* is a curator-authored subset of records that tells a focused story — “Top AI agents,” “Best Flutter libraries,” “Foundations to follow.” Collections live at `data/collections/<slug>.yml` and are first-class pages with their own feeds, JSON-LD, and SEO metadata.

## Schema

```yaml
# data/collections/top-ai-agents.yml
slug: top-ai-agents
title: "Top AI Agents"
description: "Hand-picked agent frameworks that ship today."
summary: "A curated list of agent frameworks we consider production-ready."
match:
  any:
    tags: [agent, agents, llm-agent]
    categories: [ai]
  scoreFloor: 70
limit: 25
order: featured
coverImage: ./data/collections/top-ai-agents.png
visibility: keep
```

### Required fields

| Field | Type | Description |
|---|---|---|
| `slug` | string | URL slug (used in `/collections/<slug>/`). |
| `title` | string | Display title. |
| `description` | string | One-paragraph summary. |

### Optional fields

| Field | Type | Description |
|---|---|---|
| `summary` | string | Long-form description. |
| `match` | object | Predicate: `any.tags`, `any.categories`, `scoreFloor`. |
| `limit` | number | Max records. |
| `order` | string | One of `featured`, `stars`, `updated`, `score`. |
| `coverImage` | path | Optional banner image. |
| `visibility` | `"keep"` \| `"hide"` | Default `keep`. |

## Creating a collection

Two paths exist:

### Path 1 — `grove collection promote` (recommended)

```bash
# Promote the current "Top AI Agents" lens into a named collection.
grove collection promote --from lens:featured --slug top-ai-agents \
    --title "Top AI Agents" \
    --description "Hand-picked agent frameworks that ship today."
```

This writes `data/collections/top-ai-agents.yml` based on the current filter expression.

### Path 2 — hand-author `data/collections/<slug>.yml`

Use the schema above when the promotion target doesn't yet exist as a lens.

## How matching works

`match.any.tags` and `match.any.categories` are OR-ed together. A record qualifies if it has any tag in `match.any.tags` **or** any category in `match.any.categories`. Combine with `scoreFloor` to gate by quality.

If a record was added after the collection was created and now matches the predicate, it appears automatically — no re-authoring needed.

## Generated outputs

For each collection Grove emits:

- A landing page at `/collections/<slug>/`
- A curated subset of the homepage’s *featured* lens when `order: featured`
- JSON-LD `ItemList` schema with one `SoftwareApplication` per record
- An entry in `llms.txt` and the sitemap

## Related

- [Decisions](/sources/decisions/) — visibility overrides at the record level
- [Author a record](/sources/records/)
- [CLI reference → `collection promote`](/reference/cli/)