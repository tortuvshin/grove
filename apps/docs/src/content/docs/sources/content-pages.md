---
title: Content pages
description: Author free-form Markdown pages in content/pages/ — about, contributing, blog posts, changelogs.
---

Beyond structured records, Grove spaces support free-form Markdown pages under `content/pages/`. These render at `<slug>/` (no `[recordSlug]` suffix) and use the narrower sanitization allowlist (no GFM task lists, no inline styles, restricted image sources).

## When to use content pages

- **About page** (`content/pages/about.md`) — long-form description, mission, team.
- **Contributing guide** (`content/pages/contributing.md`) — how to add a record.
- **Methodology** (`content/pages/methodology.md`) — how scoring or selection works.
- **Changelog** (`content/pages/changelog.md`) — release notes for the curated list.
- **Blog posts** (`content/posts/2026-08-14-launch.md`) — announcements.

## Schema

```markdown
---
title: About this directory
description: A short summary used in <meta> and JSON-LD.
slug: about
template: page
hero:
  layout: centered
  title: About
  subtitle: Who runs this space and why
---

# Body content

Free-form Markdown. The narrower allowlist blocks inline styles,
external scripts, and arbitrary iframe sources.
```

## Frontmatter fields

| Field | Type | Description |
|---|---|---|
| `title` | string | Page title (and `<h1>`). |
| `description` | string | Used in `<meta name=description>` and OG. |
| `slug` | string | URL slug; defaults to the filename. |
| `template` | string | Default `page`. |
| `hero` | object | Hero block — layout, title, subtitle, image. |

## Markdown allowlist

Content pages are sanitized with the **narrow** allowlist:

- Standard markdown (headings, lists, links, emphasis)
- Fenced code blocks (no inline styles)
- Tables
- Blockquotes
- Images from allowed hosts (configured in `grove.config.ts`)

Inline styles, scripts, and arbitrary iframes are stripped. For richer formatting, use a record's `content/records/<slug>.md`, which uses the wider allowlist.

## Astro routing

Each page becomes a route at `<slug>/`. If the slug is `about`, the page renders at `/about/`. The build pipeline discovers pages by reading `content/pages/*.md` and `content/posts/*.md`.

## Related

- [Author a record](/sources/records/)
- [Custom pages](/customize/pages/)