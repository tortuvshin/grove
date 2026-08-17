---
title: Content pages
description: Standalone Markdown pages that aren't records or collections.
---

# Content pages

Grove content pages are standalone Markdown files at `content/pages/<slug>.md`. They're for content that isn't a record, a collection, or a curated list — about pages, contributing pages, essays, glossary entries, "how we curate," etc.

A content page is a Markdown file with two responsibilities the framework adds automatically:

1. **Frontmatter** that the framework reads (`title`, `description`, `socialImage`).
2. **A `PageDocument`** that produces OG, Twitter, and JSON-LD headers.

Curators don't write the JSON-LD. `definePageDocument` from `@grove-dev/core` generates it from the frontmatter and the surrounding context.

## Shape

```yaml
---
title: About this site
description: A short note on what we curate and why.
---

This is the body. Plain Markdown. The framework renders it as an Astro page
with the surrounding layout (`src/pages/about.astro` or equivalent).
```

The page is referenced from a route the consumer authors:

```astro
---
// src/pages/about.astro
import MarkdownBody from "@grove-dev/astro/components/MarkdownBody.astro";
import { definePageDocument } from "@grove-dev/core";
import aboutMarkdown from "../../content/pages/about.md?raw";

const pageDoc = definePageDocument({
  type: "content",
  path: "/about/",
  identity: { title: "About this site", description: "A short note on what we curate and why." },
  discovery: { siteName: "My Space", siteUrl: "https://example.com" },
});
---
<MarkdownBody content={aboutMarkdown} pageDoc={pageDoc} />
```

The framework emits the same `WebSite` JSON-LD, OG image, and Twitter card as for records.

## When to write a content page

- About / manifestos / contributing guides.
- Editorial introductions to a directory section.
- Glossary entries that don't fit any record.
- Indexes that group multiple collections by editorial intent.

What a content page is NOT:

- A disguised record. If it has a slug, an avatar, a category, a tag, and a description, it should be a record.
- A static landing page — those live in the consumer's `src/pages/index.astro` and can use any Astro component.

## Routing

The consumer wires content pages into routes under `src/pages/`. A common pattern:

- `content/pages/about.md` → `src/pages/about.astro` renders it at `/about/`.
- `content/pages/contributing.md` → `src/pages/contributing.astro` renders it at `/contributing/`.
- Multiple pages sharing a layout → `src/pages/[slug].astro` reads the slug from the URL and looks up the matching `content/pages/<slug>.md`.

The Astro integration does not own content pages' routes. They are consumer-owned.

## See also

- [Custom pages](/customize/pages/) — how consumers wire routes for the records, collections, and content pages the framework produces.
- [Customize components](/customize/components/) — `MarkdownBody`, `MarkdownLayout`, and their props.
