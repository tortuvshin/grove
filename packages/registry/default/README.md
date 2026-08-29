# `@grove` registry

Grove's UI is a [shadcn registry](https://ui.shadcn.com/docs/registry) — namespace `@grove`, published as `@grove-dev/registry`. Consumers install items with the standard shadcn CLI; `grove init` installs the full scaffold in one step, and `grove update` reconciles upstream changes against the consumer's edits without overwriting local files.

## `registry.json`

`packages/registry/registry.json` is the hand-authored manifest, in the official shadcn schema (`https://ui.shadcn.com/schema/registry.json`). It declares 12 feature-level items; each lists its files with an explicit `type` and `target` (`~/src/<path>`) and the other `@grove/*` items it depends on (`registryDependencies`).

| Item | Ships |
| --- | --- |
| `@grove/ui` | UI primitives — button, badge, empty-state, filter-drawer, page-header, search-field — plus the classnames builders that keep server-rendered and client-rebuilt controls byte-identical. |
| `@grove/shell` | The document shell every page renders inside: base layout, header, footer, container, section header, SEO head, theme toggle, the Powered-by-Grove mark, and `system.css` (design tokens, light/dark theme, Tailwind theme). |
| `@grove/project-card` | The canonical record card every listing surface renders through, with its grid host, metadata glyphs, and the brand-mark Icon component plus its generated icon registry. |
| `@grove/taxonomy` | Browse-by-category, -stack, and -license: the three index/detail route pairs, the shared list body, and the stack/category grids the home page also renders. |
| `@grove/collections` | Curated and generated collections: the index and detail routes, collection cards and rows, and the featured-collections teaser. |
| `@grove/home` | The landing route: hero with search and trust stats, the why-this-exists and pipeline story sections, three lens sections (trending / new / established), contributors, lineage, and the closing CTA. |
| `@grove/browse` | The list/discovery page and its paginated routes: search and sort, facet filters, active-filter chips, curated lens tabs, the results grid, pagination, and the client controller that re-derives all of it from the query string. |
| `@grove/record` | The per-record route: identity header, editorial summary, table of contents, rendered Markdown body, and the sticky sidebar of repository, freshness, ecosystem, and source facts. |
| `@grove/submit` | The submission route and its client: fetch a repository, validate against the taxonomy, and draft a record YAML for a pull request. |
| `@grove/about` | The narrative about route — what the site is, how it's built from files, how to contribute — with a Markdown override via `content/pages/about.md`. |
| `@grove/contributors` | The full contributors route with per-user contribution counts, read from the synced contributors data. |
| `@grove/not-found` | The on-brand fallback route: the normal shell, a short message, and a search form pointing at the browse page. |

The build adds a thirteenth item, `@grove/default` — every file of every item above, inlined, so the complete site installs in one step with no further registry lookups. This is what `grove init` installs. `pages/empty.astro` (the audit empty-state fixture) ships only in `default`; it is the one file here not owned by a feature item.

## Source layout

Item sources live under `default/`, laid out exactly like a consumer's `src/`:

```
default/
├── components/
│   ├── ui/                # primitives
│   ├── grove/              # domain UI + page-level compositions
│   └── site/               # site chrome (theme-toggle)
├── layouts/                # base-layout, container, footer, header, section-header, seo
├── pages/                  # every route — home, browse, record detail, taxonomy, collections, submit, about, contributors, 404
├── lib/                    # classnames, icon-kinds, icon-registry — UI-local helpers
└── styles/
    └── system.css          # design tokens (--grove-*), light/dark theme, Tailwind theme
```

This is a deliberate difference from a typical shadcn registry, which groups source per item and imports through `@/` aliases. Grove's `.astro` files use relative imports, so the layout *is* the import contract: a file type-checks in place here and lands at the same relative position in the consumer's `src/`. Every `target` in `registry.json` is `~/src/<same path>`.

A file's registry type follows from what the shadcn CLI does with it. `.astro` files are never transformed, so they carry semantic types (`registry:page`, `registry:component`, `registry:ui`). `.ts` and `.css` files must be `registry:file` — the CLI runs other types through ts-morph transformers that strip comments and reformat, and `grove update` hashes installed files, so they have to land byte-identical.

Two composition components — `components/grove/directory-browse.astro` and `components/grove/taxonomy-list.astro` — hold markup shared by more than one page (the browse page and its pagination route; the three taxonomy list pages) and aren't meant to be imported anywhere else. `components/grove/pipeline-strip.astro` is optional editorial content for the home page; its sample record is illustrative markup, not live data (pass `samplePath` once you have a real record to link to).

## Build and check

```bash
pnpm registry:check   # validate registry.json against default/ (CI gate)
pnpm registry:build   # validate, generate `default`, then `shadcn build` → dist/r/
```

Validation (`scripts/lib/registry.mjs`) fails the build when:

- a file under `default/` belongs to no item, or to more than one (unless listed as default-only);
- an item's `registryDependencies` differ from what its files' relative imports imply — dependencies are derived from imports, so a stale or missing entry is an error;
- a `.ts`/`.css` file is not `registry:file`, or any `target` is not `~/src/<path>`;
- a file imports the removed `@grove-dev/astro/{components,ui,layouts}` subpaths.

The build then stamps every item with `meta.version` from this package's version and runs the official `shadcn build` (a devDependency), producing `dist/r/<item>.json` with file contents inlined, plus a `dist/r/registry.json` index.

`apps/example` is the reference consumer: `scripts/check-example-mirrors-registry.mjs` verifies every file of the `default` item exists at its target under `apps/example` with identical bytes.

## Hosting

`@grove-dev/registry` on npm ships `dist/r/` (exported as `./r/*`). The docs site copies `dist/r` into `apps/docs/public/r/` before each build (`scripts/sync-registry-public.mjs`), so items are served at `https://withgrove.dev/r/<item>.json`.

## Installing items

`grove init` writes a `components.json` that maps the namespace to that URL:

```json
{ "registries": { "@grove": "https://withgrove.dev/r/{name}.json" } }
```

From then on the standard shadcn CLI works — no React and no `shadcn init` required, a bare Astro project with `components.json` and a tsconfig `@/*` alias is enough:

```bash
npx shadcn@latest add @grove/browse                 # install browse + its @grove/* dependencies
npx shadcn@latest add @grove/project-card --overwrite   # restore one item's files to upstream
npx shadcn@latest view @grove/home                  # preview an item without installing
```

`grove init` itself runs `shadcn add` against the bundled `default.json` — the CLI depends on this package, so a fresh scaffold needs no registry request — then writes `.grove/registry.lock.json` (scaffold `@grove/default`, version, per-file sha256 of the installed content).

## Versioning

`@grove/default` is versioned independently of `@grove-dev/core` and `@grove-dev/astro` per §21 of the v1 architecture spec. A patch to the engine packages does not require a UI bump; a UI redesign does not require an engine bump. Every built item carries the package version in `meta.version`.

## Update behavior

`grove update` fetches `@grove/default` from the registry URL in `components.json` (or `--from <path-or-url>`; falls back to the bundled copy) and runs the three-way classifier from `apps/docs/concepts/registry.md`:

| Installed | Lock | Registry | Classification | Action |
| --- | --- | --- | --- | --- |
| absent | absent | present | new | install |
| matches lock | matches | matches | unchanged | skip |
| matches lock | matches | differs | upstream_changed | apply |
| differs from lock | differs | matches lock | locally_modified | **preserve, never overwrite** |
| differs from lock | differs | differs | conflict | preserve + warn |
| present | present | absent | removed | report, do not delete |

The locally-modified rule is load-bearing. See the architecture spec §5. This is Grove's value-add over plain `shadcn add`, whose only answer to an existing, differing file is a yes/no overwrite prompt.
