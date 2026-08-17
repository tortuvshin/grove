---
title: Taxonomy
description: Controlled vocabularies used by filters and labels.
---

# Taxonomy

Six taxonomy files live under `data/taxonomy/`. Every entry is an `id` and display fields. The browse UI reads from these files at build time.

## Files

| File | Purpose |
|---|---|
| `categories.yml` | Top-level groupings a record belongs to. |
| `stacks.yml` | Language and framework identifiers (e.g. `typescript`, `python`, `flutter`). |
| `platforms.yml` | Runtime and deployment targets (e.g. `web`, `macos`, `linux`, `ios`, `android`). |
| `licenses.yml` | SPDX identifiers (`mit`, `apache-2.0`, etc.). |
| `topics.yml` | Domain keywords used as `tags` or other freeform classification. |
| `distribution-channels.yml` | Install and discover channels (`homebrew`, `docker`, `snap`, `winget`, etc.). |

## Shape

Each entry uses an `id:` identifier key. The body of each taxonomy file is a list:

```yaml
# data/taxonomy/categories.yml
- id: ai-tools
  name: AI tools
  description: Tools for building, running, and evaluating AI systems.
- id: agent-frameworks
  name: Agent frameworks
```

The exact field set varies by taxonomy. `categories.yml` uses `id`, `name`, `description`. `licenses.yml` uses `id`, `name`, `spdx_id`, `url`. See [Taxonomy files](/content/taxonomy-files/) for the full shape and examples.

The `id:` identifier is the value a record sets on `category`, `stack`, `stacks`, `platforms`, or `licenses`. The framework validates that every such value on a record resolves to an existing `id` in the matching file.

## Why `id` and not `slug`

Earlier versions of the codebase used `slug:` as the identifier key. The loader was changed to require `id:` because:

- Every taxonomy entry has multiple identifiers in real life (SPDX for licenses, language codes for stacks, OS names for platforms). `id:` keeps the structure open to `spdx_id` and similar secondary keys without re-reading the same `slug:`.
- A slug implies a URL; an id is just an identifier. The taxonomy files don't need URLs and the loader shouldn't pretend they do.

A vitest at `apps/docs/src/docs-taxonomy-guard.test.ts` rejects any docs example that uses `slug:` and asserts every tutorial example uses `id:`.

## Canonical facet ids

`browse.facets` in `grove.config.ts` accepts a strict subset of these dimensions:

```ts
// packages/core/src/directory-facets.ts
export const FACET_IDS = [
  "category",
  "stack",
  "platform",
  "tags",
  "license",
] as const;
```

A typo in `browse.facets` fails config parsing immediately. The intended facet shape lives in `FACET_IDS`; the docs test (`docs-taxonomy-guard.test.ts`) imports this array and asserts no docs example adds an unknown facet id.

## See also

- [Taxonomy files](/content/taxonomy-files/) — full reference + examples.
- [Reference: `grove.config.ts`](/reference/config/) — `browse.facets` field.
- [`packages/core/src/directory-facets.ts`](https://github.com/tortuvshin/grove) — the canonical ids source.
