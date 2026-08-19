---
title: Browse pages
description: Filter, lens, and search over the indexed record set.
---

The browse surface is the directory's index page — `/projects/` by default for the `project-directory` blueprint, or whatever `routes.directory` sets. Every facet and lens combination has a canonical URL on that page, driven entirely by query parameters. Visitors reach a filtered view from the filter menu or a lens tab; `grove collection promote --from '/projects/?...'` turns one of those URLs into a saved collection.

Three ingredients make it work:

- **Facets** — configured in `grove.config.ts` via `browse.facets`. The canonical ids are `category`, `stack`, `platform`, `tags`, `license`.
- **Lenses** — named views over the record set, some ordering (`all`, `recently-updated`, `new`), some filtering by a curator-applied label (`hot`, `mature`) or `curation.lenses` entry. See [Lens recipes](/discovery/lens-recipes/) for the full list and how each is triggered.
- **Search** — a substring search over the same indexed record set.

## URL shape

A filtered URL looks like:

```text
/projects/?<facet>=<id>&<facet>=<id>...
```

Examples:

```text
/projects/?stack=flutter
/projects/?category=ai-tools&stack=python
/projects/?license=mit
```

Multi-value facets repeat the key (`?stack=flutter&stack=react-native`); `license` is single-select. `?label=hot`, `?status=stale,quiet`, `?lens=good-to-learn`, and `?sort=recently-updated` compose with facets the same way — see [Lens recipes](/discovery/lens-recipes/) for what each one means.

## Configuring which facets appear

`browse.facets` lists the dimensions the filter menu exposes, in the order they render:

```ts
// grove.config.ts
export default defineConfig({
  browse: {
    facets: ["category", "stack", "platform", "tags", "license"],
  },
});
```

Drop a facet you don't need — a site with no `stack` taxonomy can omit it. A typo (`"categories"` instead of `"category"`) fails config parsing with a list of the accepted ids, rather than silently falling back to a default; the schema validates `browse.facets` against the canonical list in `packages/core/src/directory-facets.ts`.

## Turning a filter into a saved collection

Once you've clicked through to a filtered view worth keeping, promote it:

```bash
pnpm exec grove collection promote \
  --from '/projects/?stack=flutter&category=finance' \
  --slug top-finance-flutter \
  --title 'Top Flutter finance apps'
```

The command parses `--from` with `URLSearchParams`, maps `stack`/`category`/`platform` into the new collection's `query`, and writes `data/collections/<slug>.yml`. Other parameters in the URL (tags, license, search text) are dropped — add them to the YAML by hand afterward. See [Promote a filter to a collection](/discovery/promote/) for the full flag reference and what to edit next.

## Search

Search runs over the same indexed record set the facets and lenses filter — there's one index, not a separate search backend. Results respect visibility: records with an effective `visibility` of `hide` or `remove` are excluded.

## Filter URLs, OG images, and the sitemap

Filter pages don't get their own social-share card: `buildOgImages()` only renders `home`, `default`, one per record (`records/<slug>.png`), one per collection (`collections/<slug>.png`), and one per taxonomy entry (`categories/<id>.png`, `stacks/<id>.png`, `licenses/<id>.png`) — no filter-URL-specific image exists, so a filter page falls back to the site's default OG card.

Filter and search query strings (`/projects/?...`, `/search?...`) aren't written to `sitemap.xml` either — the sitemap lists the unfiltered index page, its `/page/<n>/` pagination, and each record's own detail page, but no `?facet=value` combination. `isIndexableFilterPath()` (`packages/core/src/robots.ts`) recognizes `/browse?`, `/search?`, and `/apps?` as non-indexable filter paths for callers building a custom sitemap or robots policy, but the generated sitemap doesn't call it — filter URLs simply aren't index targets today.

## Customizing the browse UI

The browse page template lives in `@grove-dev/astro`'s `DirectoryIndexClient` and `FilterGroupMenu` components. Consumers customize via:

- `src/styles/global.css` for tokens.
- Replacing `DirectoryIndexClient` in the directory's `index.astro` page with a custom layout, while keeping the data adapters from `@grove-dev/astro/server`.
- Writing a custom filter-URL parser if the default `URLSearchParams` shape doesn't fit.

The framework owns the data model; the consumer owns the presentation.

## See also

- [Lens recipes](/discovery/lens-recipes/) — the built-in lenses and when to reach for one.
- [Promote a filter to a collection](/discovery/promote/) — the `grove collection promote` workflow.
- [`packages/core/src/directory-search.ts`](https://github.com/tortuvshin/grove) — `filterRecords`, `buildFacets`, and the `IndexFilters` shape that back this page.
- [`packages/core/src/directory-facets.ts`](https://github.com/tortuvshin/grove) — canonical facet ids.
