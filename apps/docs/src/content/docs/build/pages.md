---
title: Pages and content
description: Add new pages to your Grove directory. Markdown content pages, custom Astro pages, and per-record body content.
---

A scaffolded Grove space ships with these pages:

- `/` — Home (hero + record sections)
- `/projects/` — Browse the directory
- `/projects/<slug>/` — Project detail
- `/about/`, `/contributors/`, `/submit/` — supplementary pages
- `/404/` — Not found

To add a new page, drop an `.astro` file under `src/pages/`. Astro picks it up automatically. To add it to the top navigation, add an entry to `nav` in `grove.config.ts`.

To add a Markdown body to a record (rendered on the detail page), write `content/records/<slug>.md` and reference it from the record YAML:

```yaml
content: content/records/coolify.md
```

Grove sanitizes the rendered HTML at build time and only allows safe tags.