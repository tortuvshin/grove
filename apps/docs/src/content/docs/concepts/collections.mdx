---
title: Collections
description: Curated or query-driven groupings of records.
---

# Collections

A collection is a curator-managed grouping at `data/collections/<slug>.yml`. Collections are how a Grove site surfaces **reasoned views** over the record set: "Top Flutter finance apps", "Reading list for new contributors", "Stable, well-tested tools only."

A collection is different from a lens in two ways:

- Lenses are pure functions of the record set — they ask "what does the data say?" A collection is what the curator says the data means.
- A collection has its own URL and SEO surface. Lenses do not.

## Two kinds

```yaml
kind: curated         # default — query + ranking
kind: ranked          # explicit list of record ids
```

`kind: curated` is what `grove collection promote --from /browse?... --slug <s>` produces. The collection's `query` block describes facet filters and matchers; the entries are computed at build time.

`kind: ranked` is the escape hatch when the editorial intent can't reduce to a query — for example, "the six records we'd want anyone to see first." The collection file lists every record id by hand.

## Shape

```yaml
slug: top-flutter
kind: curated
title: Top Flutter apps
description: Hand-picked Flutter projects that demonstrate strong, well-maintained engineering.
query:
  stacks: [flutter]
  categories: [productivity, finance]
  excludeStatuses: [archived]
ranking:
  preset: quality         # quality | freshness | popularity | custom
seo:
  title: Top Flutter apps
  description: Hand-picked Flutter projects.
  index: true
editorial:
  reviewer: maintainer-name
  reviewedAt: "2026-04-01"
  notes: Re-curated for the 2026 launch.
```

| Field | Purpose |
|---|---|
| `slug` | The collection's slug — used in `/collections/<slug>/` URLs. |
| `kind` | `curated` (default) or `ranked`. |
| `title` | Display title; defaults to humanized slug when omitted. |
| `description` | Long description for the collection page. |
| `query` | Facet filters and matchers (`stacks`, `categories`, `platforms`, `excludeStatuses`). |
| `query.match` | Optional `tags.all`, `tags.any`, `tags.none` arrays for tag-set filtering. |
| `ranking.preset` | One of `quality`, `freshness`, `popularity`, or `custom`. |
| `seo.title` / `seo.description` / `seo.index` | Overrides the page's OG title and JSON-LD description; `seo.index: false` adds `<meta name="robots" content="noindex">`. |
| `editorial.reviewer` / `editorial.reviewedAt` / `editorial.notes` | Provenance metadata for the collection. |

A `kind: ranked` collection replaces `query` with an explicit list:

```yaml
slug: stable-only
kind: ranked
title: Six records we'd show anyone
description: Hand-picked for stability and active maintenance.
records:
  - slug: well-known-project-a
  - slug: well-known-project-b
  - slug: well-known-project-c
seo:
  index: true
```

## `grove collection promote`

The fastest way to create a collection is to land on a browse URL — `/browse?stack=flutter&category=finance` — and promote it:

```bash
pnpm exec grove collection promote \
  --from '/browse?stack=flutter&category=finance' \
  --slug top-finance-flutter \
  --title 'Top Flutter finance apps'
```

The command:

1. Parses `--from` with `URLSearchParams` (handles `&`, `=`, `+`, percent-encoded correctly).
2. Writes `data/collections/<slug>.yml` with `kind: curated`, `query` derived from the params, `ranking.preset: 'quality'`, `excludeStatuses: ['archived']`.
3. Creates the directory tree if it doesn't exist.
4. **Does not** pre-fill a description; the curator adds one.

`--from` is required, `--slug` is required, `--title` and `--description` are optional.

## How collections appear in the build

- `/collections/<slug>/` — the collection's detail page (header, hero, ranked list).
- `/collections/` — index of all collections.
- The collection contributes to `data/generated/site-config.json` so the build pipeline knows which collections to pre-render.

The page template is in `@grove-dev/astro`'s `CollectionPage` component. Consumers customize via their own `src/pages/collections/*` if they need a different layout.

## When to use a collection vs a content page

A content page is for prose. A collection is for "I want a page that lists and sorts records for me." If your collection page is mostly prose with one or two record mentions, write a content page. If it lists twenty records, that's a collection.

## See also

- [Curated collections](/content/collections/) — file shape and worked examples.
- [Promote a filter to a collection](/discovery/promote/) — the `grove collection promote` workflow.
- [`packages/core/src/collections.ts`](https://github.com/tortuvshin/grove) — query and ranking implementation.

## How matching works

`match.any.tags` and `match.any.categories` are OR-ed together. A record qualifies if it has any tag in `match.any.tags` **or** any category in `match.any.categories`. Combine with `scoreFloor` to gate by quality.

If a record was added after the collection was created and now matches the predicate, it appears automatically — no re-authoring needed.

## Generated outputs

For each collection Grove emits:

- A landing page at `/collections/<slug>/`
- A curated subset of the homepage's *featured* lens when `order: featured`
- JSON-LD `ItemList` schema with one `SoftwareApplication` per record
- An entry in `llms.txt` and the sitemap
