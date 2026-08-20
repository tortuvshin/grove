---
title: SEO & social
description: The exact tags, JSON-LD nodes, sitemap entries, and social cards a Grove build emits — and the config that has to be right for them to resolve.
---

Every page rendered through Grove's `Seo` layout emits the same set of tags.
Nothing needs wiring per page; what varies is what you pass in.

:::caution[`site` must be set in `astro.config.mjs`]
Canonical URLs, Open Graph URLs, the OG image URL, and every JSON-LD `@id`
are built with `new URL(path, Astro.site)`. If `site` is unset the layout
throws rather than emitting relative URLs, because a relative `og:image` is
silently ignored by every social platform. Set
`site: 'https://your-domain'`.
:::

## Tags emitted on every page

| Tag | Value |
|---|---|
| `<title>` | the page title you pass |
| `<meta name="description">` | the page description you pass |
| `<link rel="canonical">` | `Astro.site` + the current pathname |
| `<meta name="robots">` | `index,follow,max-image-preview:large`, or `noindex,nofollow` when the page opts out |
| `og:type` | `website` by default; pass `article` for post-like pages |
| `og:url` | the canonical URL |
| `og:title`, `og:description` | title, and description truncated to 200 characters |
| `og:image` | absolute URL of the page's card |
| `og:image:width` / `:height` | always `1200` / `630` |
| `og:image:alt` | your alt text, else `"<site name> social preview"` |
| `og:site_name` | `site.name` |
| `og:locale` | `site.locale` (default `en`) |
| `twitter:card` | always `summary_large_image` |
| `twitter:site` | `site.twitter`, emitted only when set |
| `twitter:title`, `twitter:description`, `twitter:image` | mirror the OG values |

The description is truncated for the social tags only — the
`<meta name="description">` keeps your full text.

## JSON-LD

Two graphs are emitted. The site graph is on every page; the page graph
depends on what that page is.

**Site graph** — a single node typed `["WebSite", "Organization"]` with
`@id` `<site>#site`, carrying `name`, `description`, `inLanguage`, a
`publisher` Organization (using `site.logo` and `site.repoUrl` as
`sameAs` when set), and a `SearchAction` pointing at your browse path.

**Page graph** — built by `buildJsonLd`, which is overloaded on input shape:

| Builder | Emits |
|---|---|
| `recordSchema` | `["SoftwareApplication", "SoftwareSourceCode"]` for `kind: "application"`, `["CreativeWork", "WebPage"]` for `kind: "article"` — plus `codeRepository` and `license` when present |
| `collectionSchema` | `["CollectionPage", "WebPage"]`, an `ItemList` of the members, and breadcrumbs |
| `contentSchema` | `["Article", "WebPage"]` with `author` and optional `datePublished`, plus breadcrumbs |

Every one of those returns a `BreadcrumbList` alongside the main node, so
breadcrumb structured data is emitted by default, not opt-in.
`breadcrumbSchema` is also exported on its own for pages that need nothing
else.

:::note[`validateJsonLd` is a dev-time warning, not a gate]
The layout runs `validateJsonLd` only under `import.meta.env.DEV` and prints
`[grove seo] <path>: <message>` to the terminal. It never fails a build and
never runs in production. `grove check` does not validate JSON-LD.

One structural rule *is* enforced at runtime: `collectionSchema` throws if
you pass fewer than two breadcrumbs.
:::

## `sitemap.xml`

Written to `public/sitemap.xml` by `buildSitemap` in
`packages/core/src/sitemap.ts`. A single file — no `sitemap-index.xml`, no
shards.

`lastmod` is the build's `generatedAt` timestamp for most entries. Two
exceptions use real dates when they exist: a record entry prefers
`lastCommitAt`, then `addedAt`; a collection entry prefers
`lastReviewedAt`.

Filter URLs are excluded. `isIndexableFilterPath` in
`packages/core/src/robots.ts` returns `false` for anything matching
`/browse?`, `/search?`, or `/apps?` — those are query-string views of
content that is already indexed at its own URL.

## `robots.txt`

Written to `public/robots.txt`. The generated file is short:

```text
# grove-generated: edit this file to take ownership
User-agent: *
Allow: /
Disallow: /submit/

Sitemap: https://example.com/sitemap.xml
```

`/submit/` is the only disallowed path — everything else on a Grove site is
meant to be indexed. The `Sitemap:` line always points at
`<site.url>/sitemap.xml`, which is where the sitemap writer actually puts
the file.

Edit the file and delete the marker line to take ownership; Grove then stops
regenerating it. See [Outputs overview](/outputs/overview/#ownership-how-robotstxt-and-og-imagesvg-stop-regenerating).

## Social cards

Cards are rendered at build time with satori plus `@resvg/resvg-js`
(`packages/core/src/og-image.ts`) — never on demand, never SSR. They land
under `public/og/`:

- `og/home.png` — the home page
- `og/default.png` — the fallback for any page without its own card
- `og/records/<slug>.png`
- `og/collections/<slug>.png`
- `og/categories/<id>.png`, `og/stacks/<id>.png`, `og/licenses/<id>.png`

Rendering is non-fatal. A failure logs
`[grove] OG image generation failed (…); pages will fall back to
/og-image.svg` and the build continues.

`data/generated/og-manifest.json` maps each card path to a content hash so
unchanged cards are skipped on the next build — it is not a lookup table,
since the path is derivable from the slug.

## Not emitted

- **`hreflang` alternates** — Grove is single-locale; `site.locale` sets one
  language for the whole site.
- **AMP, `news:sitemap`, `xhtml:link`** — out of scope.
- **`theme-color`, web manifest** — see [Site metadata](/outputs/site-meta/).

## Related

- [Outputs overview](/outputs/overview/) — every artifact Grove writes.
- [Site metadata](/outputs/site-meta/) — what is emitted versus yours to add.
- [grove.config.ts](/reference/config/) — `site.url`, `site.locale`,
  `site.twitter`, `site.logo`, `site.repoUrl`.
