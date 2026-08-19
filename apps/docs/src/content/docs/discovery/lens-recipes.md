---
title: Lens recipes
description: Reusable, opinionated views over the record set.
---

A lens is an opinionated view over the record set, computed at build time. Grove ships four built-in lenses — `featured`, `hot`, `new`, `mature` — and supports custom lenses through `@grove-dev/core`'s programmatic API.

## Built-in lenses

Each lens is a pure function of the record set plus the curator-applied `curation.labels`.

| Lens | Built from |
|---|---|
| `featured` | `curation.labels: ['featured']` |
| `hot` | High recent activity + growing stars (uses `github.*` block, refreshed by sync) |
| `new` | Records first seen in the last 90 days, not yet `mature` |
| `mature` | Sustained activity + high `scores.docs` and `scores.overall` |

A record can carry multiple labels and surface in several lenses.

## When a lens is the right shape

A lens answers "what does the data say?" — a question the visitor can ask. A collection answers "what does the curator say?" — a question the curator decides.

Concrete cases:

- **"Show me new tools"** → lens: `new`.
- **"Show me the six tools we'd want anyone to see first"** → collection: `kind: ranked` with six ids.
- **"Show me Flutter finance apps"** → browse filter: `/browse?stack=flutter&category=finance`. To make it persistent and editorially reviewed, promote it to a collection.

## Authoring custom lenses

Programmatic API: import the helpers from `@grove-dev/core` and run them in your Astro build:

```ts
import { filterEntries, rankEntries, scoreTier } from "@grove-dev/core";
import recordsData from "@grove/generated/records.json";

const records = recordsData.records;

const seedlingLens = filterEntries(records, {
  match: {
    "labels.all": ["experimental"],
    "tags.any": ["agent"],
  },
}).filter((r) => scoreTier(r) === "experimental");

const ranked = rankEntries(seedlingLens, { preset: "freshness" });
```

A custom lens:

- Lives in your `src/pages/lens/seedling.astro` or similar.
- Reuses the same `records.json` already built by the framework.
- Doesn't fork the data layer.

## Promoting a custom lens to a collection

Once a custom lens proves useful, hand-curate it:

```bash
# Start with the URL your custom lens generates.
pnpm exec grove collection promote \
  --from '/lens/seedling' \
  --slug seedling-agents \
  --title 'Seedling agents'
```

Editing the resulting YAML fine-tunes ranking, exclusions, and SEO copy without touching the lens code.

## See also

- [Browse pages](/discovery/browse/) — how facets, lenses, and search fit together.
- [Promote a filter to a collection](/discovery/promote/) — the `grove collection promote` workflow.
- [Reference: programmatic API](/reference/api-core/) — `filterEntries`, `rankEntries`, `LENSES`, `scoreTier`.
- [`packages/core/src/directory-lenses.ts`](https://github.com/tortuvshin/grove) — built-in lens implementation.
