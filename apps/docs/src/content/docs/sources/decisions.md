---
title: Decisions
description: Use decisions.yml to override record visibility, slugs, and sort priority without editing the source YAML.
---

`data/decisions.yml` is a curator-authority file. It lets you override record visibility, slug, sort priority, and metadata without editing the source records directly — so upstream syncs (`grove sync github`) don't clobber your curation choices.

## Schema

```yaml
# data/decisions.yml
- slug: ollama
  visibility: hide
  reason: archived-upstream
- slug: langchain
  sortPriority: 100
  pin: true
- slug: llamaindex
  renameSlug: llama-index
```

### Fields

| Field | Type | Description |
|---|---|---|
| `slug` | string | Original slug from the source record. |
| `visibility` | `"keep"` \| `"hide"` | Force show/hide. |
| `sortPriority` | number | Higher numbers float to the top. |
| `pin` | boolean | Pin to the top of any list it appears in. |
| `renameSlug` | string | Override the slug used in URLs (rare; use sparingly). |
| `reason` | string | Curator note; not surfaced publicly by default. |

## When to use decisions

Use decisions when you need to:

- **Hide a record** without deleting the YAML (e.g., upstream was archived).
- **Pin** a record to the top of a list to mark it editorially endorsed.
- **Rename a slug** after a brand change.
- **Override sort** so the highest-priority record appears first.

When decisions conflict with `data/records/<slug>.yml` (e.g., record has `visibility: keep` but decision says `hide`), the decision wins.

## Ordering

The decision list itself is order-stable; entries that don't conflict are merged alphabetically by record slug.

## Editing

Decisions are hand-authored. The CLI does not auto-generate them. To remove a record entirely, delete the YAML; to temporarily hide it, add a `hide` decision.

## Related

- [Author a record](/sources/records/)
- [Curated collections](/sources/collections/)