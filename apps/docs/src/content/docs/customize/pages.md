---
title: Custom pages
description: Add new Astro pages to your Grove space. Changelogs, methodology, contributor guides — anything that's not a record.
---

A Grove space is an Astro project; adding a page is a normal Astro workflow. Drop a `.astro` file under `src/pages/` and the build picks it up.

## Three page patterns

| Pattern | Use for |
|---|---|
| `src/pages/<page>.astro` | Curated pages with bespoke layout — submit form, changelog, status dashboard |
| `content/pages/<page>.md` (rendered via `getPageContentHtml`) | Long-form prose with the default layout |
| `data/records/<slug>.yml` + the scaffolded `[slug].astro` | Directory entries — pages generated from data |

## Adding an Astro page

Create `src/pages/<page>.astro`:

```astro
---
import BaseLayout from "../layouts/base-layout.astro";
import { records } from "@grove-dev/astro/server";

const recent = records
  .filter(r => r.github?.sync?.syncedAt)
  .sort((a, b) => (b.github.sync.syncedAt > a.github.sync.syncedAt ? 1 : -1))
  .slice(0, 10);
---

<BaseLayout title="Changelog" description="Recent updates">
  <h1>Changelog</h1>
  <ul>
    {recent.map(r => (
      <li><a href={`/projects/${r.slug}/`}>{r.name}</a></li>
    ))}
  </ul>
</BaseLayout>
```

Add it to the top nav in `grove.config.ts`:

```ts
nav: [
  { label: "Home", href: "/" },
  { label: "Browse", href: "/projects" },
  { label: "Changelog", href: "/changelog" },
],
```

That's it. The page is part of the site.

## Adding a Markdown page

For prose-heavy pages (methodology, contributing, code of conduct), use Markdown under `content/pages/`:

```markdown
---
title: Methodology
description: How projects are selected, scored, and curated.
---

Projects are added through a public submission process. A maintainer
reviews each submission against the criteria below ...

## Inclusion criteria

- Active maintenance (commit within the last 12 months)
- Public source and a clear license
- Functional software, not vaporware
```

Render it from an Astro wrapper:

```astro
---
import BaseLayout from "../layouts/base-layout.astro";
import Container from "../layouts/container.astro";
import { getPageContentHtml } from "@grove-dev/astro/server";
import siteConfig from "@grove/generated/site-config.json";

const html = getPageContentHtml("methodology");
---

<BaseLayout title="Methodology" description="How entries are chosen." site={siteConfig}>
  <Container>
    {html && <article set:html={html} />}
  </Container>
</BaseLayout>
```

The Markdown file is rendered to HTML at build time and embedded in the page.

:::caution[Frontmatter is not passed through]
`getPageContentHtml(page)` returns `string | null` — the rendered HTML, or `null` when
no matching file exists (`packages/astro/src/server/directory.ts:751`). It does **not**
return an object, and it does not hand you the frontmatter: the frontmatter block is
stripped and discarded during rendering. Set the page title and description on
`BaseLayout` yourself, as the example above does.
:::

## When Markdown isn't enough

Use an Astro page when:

- The page needs structured data (`records.filter(...)` to render a list).
- The page needs interactivity (search, form, tabs).
- The page has bespoke layout (dashboard, calendar, status board).

## Related

- [Components](/customize/components/) — overriding default components
- [Branding](/customize/branding/) — site identity
- [Astro pages](https://docs.astro.build/en/basics/astro-pages/) — full Astro reference