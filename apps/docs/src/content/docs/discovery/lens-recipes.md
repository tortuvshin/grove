---
title: Lens recipes
description: Reusable, opinionated views over the record set.
---

A lens is a named view over the record set, reached via `?lens=<id>` (or the URL parameters it implies). Grove defines twelve lenses in `LENSES` (`packages/core/src/directory-lenses.ts`); only three — `all`, `recently-updated`, `new` — render as tabs on the browse page by default. The rest exist for deep-linking (`?lens=hot`, `?label=hot`, `?status=active`, and so on) and aren't shown as tabs unless you build UI for them yourself.

## Built-in lenses

| Lens | Tabbed? | Built from |
|---|---|---|
| `all` | yes | No filter — every record, in default order. |
| `recently-updated` | yes | Sort only (`sort=recently-updated`) — orders by most recent commit, no records excluded. |
| `new` | yes | Sort only (`sort=recently-added`) — orders by when the record joined the directory, no records excluded. |
| `hot` | no | Filter (`label=hot`) — records carrying `hot` in `curation.labels`. |
| `mature` | no | Filter (`label=mature`) — records carrying `mature` in `curation.labels`. |
| `good-to-learn` | no | Filter (`lens=good-to-learn`) — records carrying `good-to-learn` in `curation.lenses`. |
| `production-like` | no | Filter (`lens=production-like`) — records carrying `production-like` in `curation.lenses`. |
| `beginner-friendly` | no | Filter (`lens=beginner-friendly`) — `curation.lenses`. |
| `contribution-ready` | no | Filter (`lens=contribution-ready`) — `curation.lenses`. |
| `launches` | no | Filter (`lens=launches`) — `curation.lenses`. |
| `actively-developed` | no | Filter (`status=active`) — `health.status`. |
| `needs-maintainer` | no | Filter (`status=stale,quiet`) — `health.status`. |

Three shapes underneath the table:

- **Sort-based** (`all`, `recently-updated`, `new`) never exclude a record — they only reorder. This is deliberate: they're the two questions a directory visitor actually has ("what's alive?", "what's new?"), and a visitor should never land on an empty tab.
- **Label-based** (`hot`, `mature`) filter on `curation.labels`, a curator-applied field — nothing computes these automatically. `new` and `featured` are also valid `curation.labels` values (see [Decisions and curation](/concepts/decisions/)), but neither has a dedicated lens; filter on them directly with `?label=new` or `?label=featured`.
- **Curator-assigned** (`good-to-learn`, `production-like`, `beginner-friendly`, `contribution-ready`, `launches`) filter on `curation.lenses`, a free-text array a curator fills in per record — there's no scoring behind them.
- **Status-based** (`actively-developed`, `needs-maintainer`) filter on the computed `health.status` — see [Health classification](/content/health-classification/) for how that field is derived.

A record can carry several labels and several `curation.lenses` entries, so it can surface in more than one lens at once.

## When a lens is the right shape

A lens answers "what does the data say?" — a question the visitor can ask by picking a tab or URL. A collection answers "what does the curator say?" — a page the curator deliberately assembled and can annotate.

Concrete cases:

- **"Show me what's active"** → lens: `recently-updated` or `actively-developed`.
- **"Show me the six tools we'd want anyone to see first"** → collection: `kind: curated` with an editorial `query`, hand-picked and annotated.
- **"Show me Flutter finance apps"** → browse filter: `/projects/?stack=flutter&category=finance`. To make it persistent and reviewable, promote it to a collection.

## Beyond the built-ins

The lens list is fixed in code — there's no config-level way to define a new lens id. If a view isn't covered by the built-ins:

1. Build the filter URL that expresses it, using facets, `label`, `status`, and `sort` (see [Browse pages](/discovery/browse/)).
2. Promote it to a saved collection with `grove collection promote`, then hand-edit the resulting YAML for ranking and editorial copy (see [Promote a filter to a collection](/discovery/promote/)).

That's the supported path from "a filter I keep reusing" to a durable, curator-owned page.

## See also

- [Browse pages](/discovery/browse/) — how facets, lenses, and search fit together.
- [Promote a filter to a collection](/discovery/promote/) — the `grove collection promote` workflow.
- [Decisions and curation](/concepts/decisions/) — `curation.labels` and `curation.lenses`.
- [`packages/core/src/directory-lenses.ts`](https://github.com/tortuvshin/grove) — the `LENSES` and `PRIMARY_LENSES` definitions.
