---
title: Outputs overview
description: Every artifact Grove generates from your source files — human-facing pages, machine-readable feeds, SEO assets, and LLM-oriented outputs.
---

Grove turns your source files (YAML records, taxonomy, decisions, Markdown bodies) into a coordinated set of outputs. Each output exists for a specific consumer: humans browsing the site, search engines indexing it, AI assistants reading it, social platforms previewing it.

## Human-facing pages

| Page | URL pattern | Source |
|---|---|---|
| Home | `/` | record set + `grove.config.ts` |
| Directory index | `/projects/` | records filtered by blueprint `kind` |
| Record detail | `/projects/<recordSlug>/` | record YAML + `content/records/<slug>.md` |
| Curated collection | `/collections/<slug>/` | `data/collections/<slug>.yml` |
| Collections index | `/collections/` | same |
| Browse filters | `/browse?...` | record set + `browse.facets` |
| Categories index | `/categories/` | `data/taxonomy/categories.yml` |
| Category landing | `/categories/<id>/` | records filtered by category |
| Stacks index | `/stacks/` | `data/taxonomy/stacks.yml` |
| Stack landing | `/stacks/<id>/` | records filtered by stack |
| Platforms index | `/platforms/` | `data/taxonomy/platforms.yml` |
| Licenses index | `/licenses/` | `data/taxonomy/licenses.yml` |
| License landing | `/licenses/<id>/` | records filtered by license |
| About | `/about/` | consumer-authored Astro page |
| Contributors | `/contributors/` | `data/generated/contributors.json` |
| Submit | `/submit/` | consumer-authored Astro page (if `submission` is configured) |
| 404 | `/404/` | consumer-authored Astro page |

The exact URL prefixes (`projects/`, `resources/`, `entities/`) are decided by `routes.directory` in `grove.config.ts`. Default per blueprint:

| Blueprint | Route prefix |
|---|---|
| `project-directory` | `/projects/` |
| `resource-hub` | `/resources/` |
| `ecosystem-map` | `/entities/` |

`project-directory` is the only blueprint Grove ships today; the other two rows
record defaults the schema reserves for future blueprints.

## Machine-readable feeds

| Output | URL / path | Consumer |
|---|---|---|
| `sitemap.xml` | `/sitemap.xml` | Search engines |
| `llms.txt` | `/llms.txt` | AI assistants (concise index) |
| `llms-full.txt` | `/llms-full.txt` | AI assistants (verbose) |
| `records.full.json` | `/data/generated/records.full.json` | Any tooling — full record set |
| `records.index.json` | `/data/generated/records.index.json` | Slim visible-only index |
| `records.json` | `/data/generated/records.json` | Alias of `records.full.json` |
| `site-config.json` | `/data/generated/site-config.json` | Resolved configuration + taxonomy |
| `cleanup-report.json` | `/data/generated/cleanup-report.json` | Triage list of records that need human review |
| `contributors.json` | `/data/generated/contributors.json` | Aggregated contributor counts |
| `repo-stats.json` | `/data/generated/repo-stats.json` | Per-repo activity totals |
| `og-manifest.json` | `/data/generated/og-manifest.json` | Map of every OG card written |
| `robots.txt` | `/robots.txt` | Crawlers |
| `og-image.svg` | `/og-image.svg` | Sentinel-owned fallback OG image |
| `og/<page>.png` | `/og/<page>.png` | Per-page satori-rendered social cards |
| `icons/**` | `/icons/**` | The packaged icon set |
| `README.md` sentinel block | `<!-- grove-readme:start/end -->` | Replaces the bounded block in your README.md |

## Per-page JSON-LD, OG, and Twitter

Every page emits a `PageDocument`:

- **JSON-LD** — `WebSite` on the homepage; `CollectionPage` on collection pages; `SoftwareSourceCode` (or matching type per blueprint) on record pages.
- **Open Graph** — `og:title`, `og:url`, `og:description`, `og:image`, `og:image:width`, `og:image:height`, `og:image:alt`.
- **Twitter card** — `twitter:card` (set to `summary_large_image` when an OG card is present), `twitter:title`, `twitter:description`, `twitter:image`.

`definePageDocument` from `@grove-dev/core` is the source. See [Reference: programmatic API](/reference/api-core/) for the type signature.

## What's not generated

Grove does NOT emit any of these:

- **`feed.xml` / RSS** — not generated. Use a third-party feed generator over `llms.txt` or `records.json`.
- **`feed.json` / JSON Feed** — not generated.
- **`security.txt`** — not generated. Consumers add their own if needed.
- **`humans.txt`** — not generated. Consumers add their own if needed.
- **A `webmanifest`** with full PWA metadata — not generated. The Starlight docs site ships `<link rel="manifest" href="/manifest.json">` but the manifest itself is consumer-provided.
- **A JSON catalog of all known Grove records** — only `records.full.json` exists. There is no separate "catalog" shape.
- **A separate `sitemap-index.xml`** — only the single `sitemap.xml` is emitted.
- **An `ai.txt` separate from `llms.txt`** — only `llms.txt` and `llms-full.txt` are produced.

If a feature you need isn't on this list, look at the [Roadmap](/project/roadmap/) — there's a chance it's planned but not yet shipped.

## When each output is regenerated

| Output | When |
|---|---|
| `data/generated/*` | Every `grove check` and every Astro build (the Astro integration runs `prepareDirectory()` on every `astro:config:setup`). |
| `public/{sitemap,llms*,robots,og-image}.*` | Same — every build. |
| `public/og/<page>.png` | Every build. Satori-rendered, non-fatal on render error. |
| `public/icons/**` | Every Astro build (run by the integration) — or explicitly via `grove icons sync`. |
| `data/generated/contributors.json` | Explicit `grove sync contributors` run. |
| `data/generated/cleanup-report.json` | Explicit `grove cleanup` run. |
| `README.md` sentinel block | Explicit `grove readme generate` run. |

## What this means for editing

- **Always-regenerated** files (most outputs): edit the source YAML/Markdown/`grove.config.ts` and rebuild. Don't edit the output file directly.
- **Sentinel-owned** files (`robots.txt`, `og-image.svg`): the first time Grove writes one, it includes a sentinel marker (`<!-- grove-generated: edit this file to take ownership -->`). Editing the file after that point keeps your version; Grove regenerates only when the sentinel has not been taken. After you edit, the file is yours.
- **Per-file ownership**: `public/icons/**` lets you edit any single icon and have it preserved across builds.

## See also

- [Generated data files](/outputs/generated-data/) — exact shape of each JSON dataset.
- [LLM-oriented outputs](/outputs/llm/) — the `llms.txt` family.
- [SEO & social](/outputs/seo/) — sitemap, OG, JSON-LD details.
- [Site metadata](/outputs/site-meta/) — what's actually emitted vs consumer-provided.
- [GitHub workflows](/outputs/workflows/) — the scheduled maintenance surface.
