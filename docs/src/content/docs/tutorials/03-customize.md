---
title: 3. Customize the look
description: Edit grove.config.ts to change the navigation, taxonomy facets, theme, and record overrides. Make the default site feel like your community.
---

So far the site uses every default: generic navigation, default facets,
default theme, and the seed schema. This tutorial changes all four so the
space looks like yours, not like a fresh `pnpm create grove` output.

All of this lives in `grove.config.ts` — the same file we opened in
[Tutorial 1](/tutorials/01-bootstrap/#step-3--open-groveconfigts). You will
not need to touch the Astro/Starlight files directly.

## Step 1 — Update site metadata

Open `grove.config.ts`. Replace the `site` block with something real:

```ts
export default defineConfig({
    blueprint: 'project-directory',
    site: {
        title: 'TypeScript Tools We Trust',
        description:
            'A community-curated directory of TypeScript runtimes, libraries, and frameworks that we have shipped to production.',
        url: 'https://ts-tools.example.com',
        locale: 'en',
    },
    // …rest stays the same for now
});
```

The three fields here feed:

- **`<title>`** — every page sets `<title>{record.name} · {site.title}</title>`.
- **`<meta name="description">`** — used by the homepage and detail pages.
- **`site.url`** — used by `grove sitemap` to build canonical URLs and by
  `grove llms` to write `llms.txt`.

Save and reload `http://localhost:4321`. The header and `<head>` update.

## Step 2 — Customize the navigation

The default `nav` from the scaffold has two entries. Replace them with
something more useful for a project directory:

```ts
nav: [
    { label: 'Home', href: '/' },
    { label: 'All projects', href: '/projects' },
    { label: 'By topic', href: '/topics' },
    { label: 'Recently added', href: '/recent' },
    { label: 'About', href: '/about' },
],
```

The nav block is rendered by the default header. The links must point to
routes that the blueprint exposes. The `project-directory` blueprint
guarantees these:

- `/` — homepage
- `/projects` — full listing
- `/projects/<slug>` — detail page
- `/category/<category-id>` — listing filtered by category
- `/topic/<topic-id>` — listing filtered by topic
- `/recent` — records sorted by `dateAdded` desc

For `/topics` and `/about` you have two choices:

1. **Drop the entries** and only link to routes the blueprint gives you for
   free.
2. **Add Astro pages** under `src/pages/topics.astro` and
   `src/pages/about.astro` that read from the same generated JSON. The CLI
   scaffolds the listing pages for you; the custom pages are your
   responsibility but they have access to the full data layer.

For this tutorial we'll add a minimal `src/pages/topics.astro` page that
lists every topic with a count:

```astro
---
// src/pages/topics.astro
import { getCollection } from 'astro:content';

const records = await getCollection('records');
const counts = new Map<string, number>();
for (const r of records.data) {
    for (const t of r.data.topics ?? []) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
    }
}
const topics = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ id, count }));
---
<html>
    <head><title>Topics · {Astro.props.title ?? 'Grove'}</title></head>
    <body>
        <h1>Browse by topic</h1>
        <ul>
            {topics.map((t) => (
                <li>
                    <a href={`/topic/${t.id}`}>{t.id}</a>
                    <span> — {t.count} project{t.count === 1 ? '' : 's'}</span>
                </li>
            ))}
        </ul>
    </body>
</html>
```

Save the file. The new route appears at `http://localhost:4321/topics`.

:::note[Beyond the blueprint]
Routes like `/topics` and `/about` are *additions*, not blueprint
guarantees. They work because Astro is a normal web framework — you can
write any page you want. Grove's job is to give you a structured data layer
to build from, not to lock you in.
:::

## Step 3 — Configure facets

By default, the listing pages show a category sidebar and let you click into
a topic. You probably want more — language filters, license filters, and
"show only active projects". That's what `facets` does:

```ts
facets: {
    sidebar: [
        { source: 'category', label: 'Category' },
        { source: 'topics', label: 'Topics' },
    ],
    toolbar: [
        { source: 'language', label: 'Language' },
        { source: 'license', label: 'License' },
        { source: 'health.status', label: 'Health' },
    ],
},
```

There are two locations:

- **`sidebar`** — the persistent left rail. Best for the small set of
  facets that should always be visible.
- **`toolbar`** — a row above the listing. Best for facets with many
  possible values (languages, licenses) that you don't want taking up
  vertical space.

The `source` is a dotted path into the record. `health.status` reads the
derived `status` field that `data/health.yml` produces. You can use any
field that exists on the record frontmatter or in the derived
`data/generated/records.full.json`.

If a facet has only one value across all records, it collapses
automatically — you don't need to prune it manually.

## Step 4 — Theme the site

The default Starlight theme is fine but generic. Grove exposes a small set
of theme tokens:

```ts
theme: {
    accent: '#3178c6',          // TypeScript blue
    accentDark: '#235a97',
    background: '#ffffff',
    backgroundDark: '#0d1117',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontMono: 'JetBrains Mono, ui-monospace, monospace',
},
```

Six tokens, no more. If you need deeper changes (custom layouts, new
components), see the [Components reference](/reference/components/).

Reload the site. The header buttons, the links, and the code blocks all
pick up the new accent color. The dark/light variants follow the user's
`prefers-color-scheme` setting.

## Step 5 — Override the record card

The default detail page renders all frontmatter fields as a definition
list. For some fields that's wrong — `bestFor[]` reads better as a bulleted
list, and `caveats[]` deserves a warning style. You can override any field's
renderer with the `overrides` block:

```ts
overrides: {
    bestFor: { render: 'list' },
    caveats: { render: 'callout', variant: 'warning' },
    whyListed: { render: 'list', variant: 'check' },
    repoUrl: { render: 'link', label: 'Source code' },
    homepage: { render: 'link', label: 'Homepage' },
},
```

Each override is `{ render, ...renderSpecificOptions }`. The available
renderers are:

| Renderer    | When to use                                            | Options                       |
| ----------- | ------------------------------------------------------ | ----------------------------- |
| `default`   | Plain text or a single value.                          | —                             |
| `list`      | An array of short items.                               | `variant: 'check' \| 'bullet'` |
| `callout`   | An array of warnings or notes.                         | `variant: 'warning' \| 'note'` |
| `link`      | A URL field — renders as a button.                     | `label: string`               |
| `code`      | Renders as a code block.                               | `language: string`            |
| `markdown`  | Renders the value as Markdown (escape carefully).      | —                             |
| `hidden`    | Drops the field from the rendered page.                | —                             |

`overrides` is a per-site escape hatch. If you find yourself overriding
the same field on every record, that's a signal the blueprint should
change — but for one-off shaping, overrides are the right tool.

Reload `/projects/zod`. The `bestFor` block is now a checklist, the
`caveats` block is a warning callout, and the `repoUrl` field is a button
labelled "Source code".

## Step 6 — Re-validate and re-generate

```bash
pnpm grove validate
pnpm grove generate
```

`validate` doesn't check the config — the `grove build` command does that
via the Astro integration. So run a build to catch any broken config:

```bash
pnpm build
```

If everything is green, your dev server is now showing the customized site
and the production build is the same site, ready to deploy.

## What you learned

- `grove.config.ts` is the single source of truth for the site's
  appearance. You don't have to touch Astro internals.
- `nav`, `facets`, and `theme` are the three knobs you will use 90% of
  the time.
- Custom routes are normal Astro pages that read the same data layer.
- `overrides` reshapes how individual fields render, without changing
  the underlying record format.

**Next: [Tutorial 4 — Maintain the space](/tutorials/04-maintain/)** —
keeps the site accurate as projects come and go.
