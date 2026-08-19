---
title: SEO & social
description: sitemap.xml, robots.txt, JSON-LD, Open Graph, Twitter card.
---

Every page in a Grove build emits the standard SEO surfaces. There's no consumer-side plug-in or template fork required for this; `definePageDocument` from `@grove-dev/core` is the source of truth.

## What's emitted per page

| Element | Source |
|---|---|
| `<title>` | Page frontmatter / per-page title from the data model |
| `<meta name="description">` | Page frontmatter |
| `<link rel="canonical">` | `site.url` + page path |
| `<meta property="og:*">` | `definePageDocument` (title, url, description, image, dimensions) |
| `<meta name="twitter:*">` | Same |
| `<script type="application/ld+json">` | `buildJsonLd` from `definePageDocument` |

The Starlight docs site additionally emits `WebSite` JSON-LD on every page (publisher metadata, language, description). The consumer's home page can override with `definePageDocument({...})` for richer types.

## `sitemap.xml`

Lives at `/sitemap.xml`. Built by `buildSitemap()` from `packages/core/src/sitemap.ts`.

- Every static page is included.
- Filter URLs (`/browse?...`) are included when `isIndexableFilterPath()` returns true (i.e., the path resolves to a non-empty result set).
- `lastmod` is set when the page depends on a YAML/Markdown file with a known mtime; otherwise today's date.

A single sitemap is emitted — there is no separate `sitemap-index.xml` and there are no `sitemap-<n>.xml` shards. Sites with thousands of pages still fit comfortably in one file.

## `robots.txt`

Lives at `/robots.txt`. Built by `buildRobotsTxt()` from `packages/core/src/robots.ts`.

The first time the file is emitted, it includes a sentinel:

```text
<!-- grove-generated: edit this file to take ownership -->
User-agent: *
Allow: /
Sitemap: https://example.com/sitemap.xml
```

After you edit, the sentinel disappears and Grove stops regenerating the file. Consumers can implement `Allow: /disallow-pattern-here` rules.

## OG cards

Grove renders PNG social cards under `/og/` using satori plus `@resvg/resvg-js` (in `packages/core/src/og-image.ts:299-346`), at build time — not on demand, not SSR. Cover variants:

- `og/home.png` — home page.
- `og/default.png` — default for any page without a specific card.
- `og/records/<slug>.png` — per record.
- `og/collections/<slug>.png` — per collection.
- `og/categories/<id>.png`, `og/stacks/<id>.png`, `og/licenses/<id>.png` — per facet landing.

The full map is written to `data/generated/og-manifest.json`.

The OG render is non-fatal: a failure on one page doesn't break the build. The Starlight docs site also embeds a fallback `<meta property="og:image" content="https://example.com/og-image.svg">` so pages without a per-page PNG still share a card.

## JSON-LD types

Per-page types via `definePageDocument`:

| Page | JSON-LD type |
|---|---|
| Home | `WebSite` (with optional `publisher` + `inLanguage`) |
| Collection | `CollectionPage` (with `mainEntity: ItemList` of records) |
| Record (`project`) | `SoftwareSourceCode` (with `name`, `description`, `url`, `license`, `programmingLanguage`, `creator`) |
| Record (`resource`) | `Article` or `MediaObject` (depending on `type`) |
| Record (`entity`) | `Organization` |
| Content pages | `WebPage` |

Every page passes through `validateJsonLd()` at build time. Malformed JSON-LD fails `grove check`.

## Twitter cards

`twitter:card` defaults to `summary_large_image` when an OG image is present, falling back to `summary`. `twitter:site` is set from `site.twitter` in `grove.config.ts` when configured.

## What is NOT emitted

- **AMP pages** — not in scope.
- **`hreflang` alternates** — multi-language is not a current Grove capability.
- **`news:sitemap`** — out of scope.
- **`xhtml:link`** — not in scope.
- **JSON-LD `BreadcrumbList`** — implemented (`breadcrumbSchema`) but only emitted by consumers who wire it. Default is to skip the breadcrumb JSON-LD.

## See also

- [Outputs overview](/outputs/overview/) — every artifact.
- [Site metadata](/outputs/site-meta/) — what's emitted vs consumer-owned (theme-color, manifest).
- [`packages/core/src/page-document.ts`](https://github.com/tortuvshin/grove) — `definePageDocument` and the JSON-LD registry.
- [`packages/core/src/sitemap.ts`](https://github.com/tortuvshin/grove) — sitemap implementation.
- [`packages/core/src/og-image.ts`](https://github.com/tortuvshin/grove) — OG card implementation.
