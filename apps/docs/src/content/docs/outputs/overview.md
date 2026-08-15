---
title: Overview
description: Catalogue of every artifact Grove generates from your source files — human-facing pages, machine-readable feeds, SEO assets, and LLM-oriented outputs.
---

Grove turns your source files (YAML records, taxonomy, decisions, Markdown bodies) into a coordinated set of outputs. Each output exists for a specific consumer: humans browsing the site, search engines indexing it, AI assistants reading it, social platforms previewing it, RSS readers subscribing to it.

## Human-facing pages

| Page | URL pattern | Source |
|---|---|---|
| Home | `/` | record set + blueprint config |
| Blueprint list | `/<routeSlug>/` | records filtered by `kind` |
| Record detail | `/<routeSlug>/<recordSlug>/` | record YAML + `content/records/<slug>.md` |
| Curated collection | `/collections/<slug>/` | `data/collections/<slug>.yml` |
| Categories index | `/categories/` | `data/taxonomy/categories.yml` |
| Category landing | `/categories/<name>/` | records filtered by category |
| Stacks index | `/stacks/` | `data/taxonomy/stacks.yml` |
| Stack landing | `/stacks/<name>/` | records filtered by stack |
| Licenses index | `/licenses/` | `data/taxonomy/licenses.yml` |
| License landing | `/licenses/<name>/` | records filtered by license |
| About | `/about/` | `content/pages/about.md` |
| Contributors | `/contributors/` | `data/generated/contributors.json` |
| Submit | `/submit/` | hard-coded Astro page |
| 404 | `/404/` | hard-coded Astro page |

## Machine-readable feeds

| Output | URL | Purpose |
|---|---|---|
| `sitemap.xml` | `/sitemap.xml` | Search engine discovery |
| `llms.txt` | `/llms.txt` | Short LLM context index (≤10 KB) |
| `llms-full.txt` | `/llms-full.txt` | Per-record sections |
| `records.json` | `/data/generated/records.json` | Full dataset (visible + hidden) |
| `records.full.json` | `/data/generated/records.full.json` | Same content as `records.json` |
| `records.index.json` | `/data/generated/records.index.json` | Slim, visible-only |
| `site-config.json` | `/data/generated/site-config.json` | Config + taxonomy + stats |
| `cleanup-report.json` | `/data/generated/cleanup-report.json` | Stale-record report |
| `repo-stats.json` | `/data/generated/repo-stats.json` | Repo aggregate stats |
| `contributors.json` | `/data/generated/contributors.json` | Contributor aggregate |

## SEO & social

| Output | URL | Purpose |
|---|---|---|
| `robots.txt` | `/robots.txt` | Crawler directives |
| `og-image.svg` | `/og-image.svg` | Default social preview (1200×630) |
| JSON-LD per page | inline `<script>` | Google rich results |

## Per-record artifacts

| Output | URL | Purpose |
|---|---|---|
| Per-record Markdown shim | `/<routeSlug>/<recordSlug>.md` | LLM-readable mirror |

## Site metadata (planned)

| Output | URL | Purpose | Status |
|---|---|---|---|
| `manifest.webmanifest` | `/manifest.webmanifest` | PWA install hint | Planned |
| `security.txt` | `/.well-known/security.txt` | RFC 9116 vulnerability disclosure | Planned |
| `humans.txt` | `/humans.txt` | Team credit | Planned |
| `/.well-known/ai.txt` | `/.well-known/ai.txt` | AI crawler policy (IETF draft 00) | Planned |
| `<collection>/feed.xml` | `/<blueprint-slug>/feed.xml` | RSS per blueprint | Planned |
| `<collection>/feed.atom` | `/<blueprint-slug>/feed.atom` | Atom per blueprint | Planned |
| `<collection>/feed.json` | `/<blueprint-slug>/feed.json` | JSON Feed v1.1 | Planned |
| `sitemap-index.xml` | `/sitemap-index.xml` | Sitemap index (split when >45 k URLs) | Planned |

## Pipeline flow

```
records/*.yml ─┐
taxonomy/*.yml ├─► generate() ─► data/generated/*.json ─► buildSitemap() ─► sitemap.xml
content/*.md   │                                            buildLlmsFiles() ► llms.txt
                                                                       ─► buildSiteArtifacts() ─► robots.txt
                                                                                                       og-image.svg
```

Each step is a pure function from sources to outputs. To add a new output, drop a function into the pipeline and emit one new file.

## Related

- [LLM-oriented outputs](/outputs/llm/)
- [SEO & social](/outputs/seo/)
- [Site metadata](/outputs/site-meta/)