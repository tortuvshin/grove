# `@grove/default`

The default registry scaffold shipped with `@grove-dev/registry`. `grove init` installs this into the consumer's `src/` and `grove update` reconciles upstream changes against the consumer's edits without overwriting local files.

## What gets installed

In v1, the scaffold's `files[]` manifest is empty (no `.astro` content has migrated yet). The structural directories are scaffolded so Phase 4 of the v1 migration plan can populate them:

```
default/
├── registry.json          # this scaffold's manifest
├── README.md
└── (in Phase 4)
    ├── components/
    │   ├── ui/            # primitives (button, badge, input, sheet, …)
    │   ├── grove/         # domain UI (project-card, filter-bar, …)
    │   └── site/          # site chrome (theme-toggle, …)
    ├── layouts/           # base-layout, footer, header, seo
    ├── pages/             # home, browse, record detail, taxonomy, …
    ├── styles/            # system.css (design tokens), global.css
    └── lib/               # UI-local helpers
```

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
