# `@grove/default`

The default registry scaffold shipped with `@grove-dev/registry`. `grove init` installs this into the consumer's `src/` and `grove update` reconciles upstream changes against the consumer's edits without overwriting local files.

## What gets installed

```
default/
├── registry.json          # this scaffold's manifest
├── README.md
├── components/
│   ├── ui/                # primitives (button, badge, empty-state, filter-drawer, page-header, search-field)
│   ├── grove/              # domain UI + page-level compositions (project-card, hero, directory-browse, taxonomy-list, …)
│   └── site/               # site chrome (theme-toggle)
├── layouts/                # base-layout, container, footer, header, section-header, seo
├── pages/                  # home, browse, record detail, taxonomy, collections, submit, about, 404
├── lib/                    # classnames, icon-kinds, icon-registry — UI-local helpers
└── styles/
    └── system.css          # design tokens (--grove-*), light/dark theme, Tailwind theme
```

`pages/` installs into the consumer's `src/pages/` exactly like every other directory here — there is no separate template-copy step. A fresh `grove init` produces a fully routable site (home, browse, taxonomy, collections, record detail, submit, about, 404) with zero records in it; add `data/records/*.yml` to populate it.

Two composition components — `components/grove/directory-browse.astro` and `components/grove/taxonomy-list.astro` — hold markup shared by more than one page (the browse page and its pagination route; the three taxonomy list pages) and aren't meant to be imported anywhere else. `components/grove/pipeline-strip.astro` is optional editorial content for the home page; its sample record is illustrative markup, not live data (pass `samplePath` once you have a real record to link to).

## Versioning

`@grove/default` is versioned independently of `@grove-dev/core` and `@grove-dev/astro` per §21 of the v1 architecture spec. A patch to the engine packages does not require a UI bump; a UI redesign does not require an engine bump.

## Update behavior

`grove update` runs the three-way classifier from `apps/docs/concepts/registry.md`:

| Installed | Lock | Registry | Classification | Action |
| --- | --- | --- | --- | --- |
| absent | absent | present | new | install |
| matches lock | matches | matches | unchanged | skip |
| matches lock | matches | differs | upstream_changed | apply |
| differs from lock | differs | matches lock | locally_modified | **preserve, never overwrite** |
| differs from lock | differs | differs | conflict | preserve + warn |
| present | present | absent | removed | report, do not delete |

The locally-modified rule is load-bearing. See the architecture spec §5.
