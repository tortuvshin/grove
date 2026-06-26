---
title: Custom pages
description: Add new Astro pages to your Grove directory. Changelogs, methodology, contributor guides — anything that's not a record.
---

Add any `.astro` file under `src/pages/` and Astro picks it up automatically. Examples:

- `src/pages/changelog.astro` — release notes
- `src/pages/methodology.astro` — how the directory is curated
- `src/pages/contributors.astro` — already shipped in the default template

For static Markdown content rendered with Grove's layout, write a Markdown file under `content/pages/<page>.md` and reference it from a custom `.astro` page using `getPageContentHtml("<page>")` from `@grove-dev/astro`. The default template uses this pattern for `about.md` and `methodology.md`.

To add the new page to the top navigation, append to `nav` in `grove.config.ts`.