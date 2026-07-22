# Grove Architecture

## Product boundary

Grove is a build-time toolkit for curated directories, not a hosted platform and not a runtime-owned application shell. A Grove-powered project is a normal Astro application that owns its routes, markup, styling, deployment, and custom features.

## Ownership

- `packages/core` owns framework-independent domain logic: schema, validation, filtering, sorting, pagination, lenses, scores, display formatting, taxonomy aggregation, generation, and sync decisions.
- `packages/astro` owns Astro adapters, generated-data loading, sanitized Markdown rendering, page view-models, layouts, components, client controllers, and integration setup.
- `packages/cli` owns `init`, `check`, `sync`, and `cleanup` orchestration.
- `apps/example` is both the real AI demo and the only scaffold copied by `grove init`.
- `apps/docs` is the Starlight documentation application.
- A generated project's `src/pages` belongs permanently to that project. Grove maintenance commands never overwrite it.

## Page data flow

```text
YAML/config -> core prepare/generate -> data/generated/*.json
            -> astro/server view-models -> consumer src/pages
            -> granular Astro components -> static HTML
```

Pages decide section order, copy, component choice, and custom routes. View-model functions prepare reusable directory state but do not return page markup. Large browser behaviors live in reusable Astro client-controller components rather than being duplicated in pages.

## Initialization and updates

`grove init` copies the canonical `apps/example/` once. After initialization, page and style changes are user code. `grove sync` updates generated metadata and public build artifacts only; it is not a template updater.
