---
title: Outputs overview
description: Every artifact Grove writes — the pages the scaffold routes, the files it publishes to public/, the JSON it keeps in data/generated/, and what it deliberately does not emit.
---

Grove turns your source files — YAML records, taxonomy, decisions, Markdown
bodies, `grove.config.ts` — into a coordinated set of outputs. Each one exists
for a specific consumer: people browsing, search engines indexing, AI
assistants reading, social platforms previewing.

They fall into three groups, and the difference between the second and third
is the one people get wrong.

## Pages the scaffold routes

These are Astro pages in your own `src/pages/`. `grove init` gives you a
working set; they are yours to change or delete.

| Page | Route | Source |
|---|---|---|
| Home | `/` | record set + `grove.config.ts` |
| Directory index | `/<prefix>/` | the visible record set |
| Paginated index | `/<prefix>/page/<n>/` | same, paginated |
| Card view | `/<prefix>/page/cards/` | same |
| Client index endpoint | `/<prefix>/page/records.json` | the visible record set, as JSON |
| Record detail | `/<prefix>/<recordSlug>/` | record YAML + `content/records/<slug>.md` |
| Collections index | `/collections/` | `data/collections/*.yml` |
| Collection | `/collections/<slug>/` | `data/collections/<slug>.yml` |
| Categories index | `/categories/` | `data/taxonomy/categories.yml` |
| Category | `/categories/<name>/` | records in that category |
| Stacks index | `/stacks/` | `data/taxonomy/stacks.yml` |
| Stack | `/stacks/<name>/` | records with that stack |
| License | `/licenses/<name>/` | records with that license |
| About | `/about/` | your Astro page, reading a content page |
| Contributors | `/contributors/` | `data/generated/contributors.json` |
| Submit | `/submit/` | your Astro page |
| 404 | `/404/` | your Astro page |

`<prefix>` defaults to `projects`. Override it with `routes.directory` in
`grove.config.ts`; the resolved value surfaces as
`blueprintConfig.routeSlug` in `site-config.json`, which is what the
scaffolded routes read.

:::note[There is no platforms landing page]
`data/taxonomy/platforms.yml` feeds browse facets and record pages, but the
scaffold ships no `/platforms/` route. Nor is there a standalone `/browse`
page — filtering happens on the directory index itself, driven by
`browse.facets`.
:::

## Files published to `public/`

These are written by the build and served at the URL that matches their path.

| File | URL | Consumer |
|---|---|---|
| `sitemap.xml` | `/sitemap.xml` | Search engines |
| `llms.txt` | `/llms.txt` | AI assistants — site header and counts only |
| `llms-full.txt` | `/llms-full.txt` | AI assistants — per-record detail |
| `robots.txt` | `/robots.txt` | Crawlers |
| `og-image.svg` | `/og-image.svg` | Fallback social image |
| `og/home.png`, `og/default.png` | `/og/…` | Satori-rendered social cards |
| `og/records/<slug>.png` | `/og/records/…` | Per-record cards |
| `og/collections/<slug>.png`, `og/categories/<id>.png`, `og/stacks/<id>.png`, `og/licenses/<id>.png` | `/og/…` | Per-page cards |
| `icons/**` | `/icons/**` | The packaged icon set |

`README.md`'s sentinel block is the one output that lands outside `public/`
— `grove readme generate` rewrites the region between
`<!-- grove-readme:start -->` and `<!-- grove-readme:end -->`.

## JSON kept in `data/generated/`

:::caution[These are not published URLs]
Nothing copies `data/generated/` into `public/`, so there is no
`/data/generated/records.json` on your deployed site. These files are build
inputs and tooling inputs — read them from disk, or through the
`@grove/generated` Vite alias. The one record payload your site *does* serve
is the `/<prefix>/page/records.json` endpoint above.
:::

`records.full.json`, `records.index.json`, `records.json`,
`site-config.json`, and `og-manifest.json` are rewritten on every build.
`cleanup-report.json`, `contributors.json`, and `repo-stats.json` are written
only by their own commands. [Generated data files](/outputs/generated-data/)
has the exact shape of each.

## Per-page JSON-LD, OG, and Twitter tags

Every page is described by a `PageDocument`, built with `definePageDocument`
from `@grove-dev/core`:

- **JSON-LD** — `buildJsonLd` is overloaded by input shape and emits
  `WebSite` for the site, `CollectionPage` for collections,
  `SoftwareSourceCode` for project records, and an article-style node for
  content pages. `validateJsonLd` reports structural issues.
- **Open Graph** — `og:title`, `og:url`, `og:description`, `og:image`, and
  the image's `width` / `height` / `alt`.
- **Twitter** — `twitter:card` (`summary_large_image` when a card exists),
  `twitter:title`, `twitter:description`, `twitter:image`.

See [Programmatic API](/reference/api-core/) for the signatures.

## What Grove does not emit

- **RSS or JSON Feed** — neither `feed.xml` nor `feed.json` is generated.
- **`security.txt`, `humans.txt`, `manifest.json`** — add your own to
  `public/` if you want them.
- **`sitemap-index.xml`** — one `sitemap.xml`, no index.
- **`ai.txt`** — only `llms.txt` and `llms-full.txt`.

## When each output is regenerated

| Output | When |
|---|---|
| `data/generated/records*.json`, `site-config.json`, `og-manifest.json` | Every `grove check` and every Astro build — the integration runs `prepareDirectory()` on `astro:config:setup` |
| `public/sitemap.xml`, `public/llms.txt`, `public/llms-full.txt` | Same |
| `public/og/**` | Same. Satori-rendered; a render failure logs and falls back to `/og-image.svg` rather than failing the build |
| `public/robots.txt`, `public/og-image.svg` | Same, but only while Grove still owns them — see below |
| `public/icons/**` | Every Astro build, or explicitly with `grove icons sync` (`--check` reports drift, `--force` overwrites local edits) |
| `data/generated/contributors.json`, `repo-stats.json` | `grove sync contributors` |
| `data/generated/cleanup-report.json` | `grove cleanup` |
| `README.md` sentinel block | `grove readme generate` |

## Ownership: how `robots.txt` and `og-image.svg` stop regenerating

Both files are written with a marker on the first line:

- `robots.txt` — `# grove-generated: edit this file to take ownership`
- `og-image.svg` — `<!-- grove-generated: edit this file to take ownership -->`

Before each rewrite, Grove reads the existing file and checks for its marker.
If the marker is gone, it leaves the file alone permanently. Deleting the
marker line is how you take ownership; deleting the whole file makes Grove
write a fresh one.

Everything else regenerates unconditionally — edit the source, not the
output. `public/icons/**` is per-file: `grove icons sync` preserves an icon
you modified unless you pass `--force`.

## Related

- [Generated data files](/outputs/generated-data/) — the JSON shapes.
- [LLM-oriented outputs](/outputs/llm/) — `llms.txt` and `llms-full.txt`.
- [SEO & social](/outputs/seo/) — sitemap, OG, JSON-LD.
- [Site metadata](/outputs/site-meta/) — emitted vs consumer-provided.
- [GitHub workflows](/outputs/workflows/) — the scheduled surface.
