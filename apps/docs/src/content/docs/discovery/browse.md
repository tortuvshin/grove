---
title: Browse pages
description: Filter, lens, and search over the indexed record set.
---

# Browse pages

The browse surface is URL-driven: every facet combination has a canonical URL. Visitors land there from filter menus; `grove collection promote --from /browse?...` turns a URL into a curated collection YAML.

Three ingredients make the browse work:

- **Facets** — `browse.facets` in `grove.config.ts`. The canonical ids are `category`, `stack`, `platform`, `tags`, `license`.
- **Lenses** — opinionated views (`featured`, `hot`, `new`, `mature`) computed at build time from `curation.labels` and the record's `github.*` / `scores` data.
- **Search** — an indexed substring search backed by the same record set.

## URL shape

A canonical browse URL looks like:

```text
/browse?<facet>=<id>&<facet>=<id>...
```

Examples:

```text
/browse?stack=flutter
/browse?category=ai-tools&stack=python
/browse?license=mit
```

Filter URLs are themselves indexable (`og-image.svg` and `og/browse.png` are generated) but `isIndexableFilterPath()` from `@grove-dev/core` excludes parameter combinations that produce empty result sets from `sitemap.xml`. See [SEO and social](/outputs/seo/) for details.

## How facets are selected

`browse.facets` lists the dimensions the browse UI exposes, in the order they appear in the filter menu:

```ts
// grove.config.ts
export default defineConfig({
  browse: {
    facets: ["category", "stack", "platform", "tags", "license"],
  },
});
```

A typo in `browse.facets` — say `"categories"` instead of `"category"` — fails config parsing with a list of accepted ids. This is deliberate: silent fallback to a default would let typos ship.

The schema enforces `browse.facets` against the canonical list imported from `packages/core/src/directory-facets.ts:FACET_IDS`.

## Lenses

Lenses are opinionated views built from the record set:

| Lens | What it surfaces |
|---|---|
| `featured` | Records with `curation.labels: ['featured']`. |
| `hot` | High recent activity (commits, releases) and growing stars. |
| `new` | Recently first seen and not yet classified as mature. |
| `mature` | Sustained contributions and good docs. |

A record can carry multiple labels and appear in multiple lenses.

## Search

Search runs through `@grove-dev/core`'s indexed record store. The Astro integration mounts a search field on every page that lists records. The same index powers the lens and facet computations.

Search results respect visibility: records with `visibility: hide` or `visibility: remove` are excluded from result lists. They remain in the index for the detail-page link resolver.

## Filter URLs and SEO

The Astro integration generates per-filter-URL `og/<filter-hash>.png` cards so each filter page has its own share preview. The `sitemap.xml` excludes empty-result filter URLs (as a quality gate — empty pages shouldn't be discoverable) but every non-empty filter URL is included.

## How a filter URL becomes a collection

Run:

```bash
pnpm exec grove collection promote \
  --from '/browse?stack=flutter&category=finance' \
  --slug top-finance-flutter \
  --title 'Top Flutter finance apps'
```

The command:

1. Parses `--from` with `URLSearchParams`.
2. Writes `data/collections/<slug>.yml` with `kind: curated`, the matching `query` block, `ranking.preset: 'quality'`, and `excludeStatuses: ['archived']`.
3. Leaves the rest of the collection (description, ranking overrides, SEO copy) for the curator.

See [Promote a filter to a collection](/discovery/promote/) and the [Curated collections](/content/collections/) reference for more.

## Customizing the browse UI

The browse page template is in `@grove-dev/astro`'s `DirectoryIndexClient` and `FilterGroupMenu` components. Consumers customize via:

- `src/styles/global.css` for tokens.
- Replacing `DirectoryIndexClient` in `src/pages/projects/index.astro` with their own layout while keeping the data adapters from `@grove-dev/astro/server`.
- Writing a custom filter URL parser if the default `URLSearchParams` shape doesn't fit.

The framework owns the data model; the consumer owns the presentation.

## See also

- [`packages/core/src/directory-search.ts`](https://github.com/tortuvshin/grove) — search implementation.
- [`packages/core/src/directory-lenses.ts`](https://github.com/tortuvshin/grove) — built-in lenses.
- [`packages/core/src/directory-facets.ts`](https://github.com/tortuvshin/grove) — canonical facet ids.
- [Reference API](/reference/api-core/) — `filterEntries`, `rankEntries`, `LENSES`, `scoreTier`.
