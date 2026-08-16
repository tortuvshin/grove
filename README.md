# Grove

> **Publish structured knowledge that stays useful.**

Grove turns YAML and Markdown in Git into searchable websites, curated views,
SEO surfaces, and machine-readable outputs — with reviewable automation that
keeps machine-owned facts synchronized.

[Documentation](https://withgrove.dev) ·
[Quickstart](https://withgrove.dev/getting-started/create-a-space/) ·
[Roadmap](https://withgrove.dev/roadmap/) ·
[Changelog](./CHANGELOG.md)

```bash
pnpm dlx @grove-dev/cli@latest init my-space
cd my-space
pnpm dev
```

That is a complete, deployable site: records, browse, search, filters,
collection pages, detail pages, sitemap, robots, social cards, and
LLM-oriented outputs — running on files you own.

---

## Why Grove exists

A curated list starts useful and decays predictably:

- **Facts drift.** Stars, licenses, and last-commit dates were true the day
  they were written down.
- **Judgment and metadata get mixed.** "This is worth using because…" ends up
  in the same field as a number a script could have fetched.
- **Surfaces diverge.** The website says one thing, the README another, and
  the sitemap, structured data, and AI-readable exports say a third.
- **Maintainers retype.** The same entry gets entered once for the site, again
  for the README, again for a JSON export.

Grove's answer is one file-backed source, many derived outputs, and
synchronization you review rather than trust.

```text
structured sources  →  Grove  →  human + machine outputs  →  reviewable maintenance
```

## What you get

| You maintain | Grove produces |
| --- | --- |
| YAML records | Searchable index, filters, and rich detail pages |
| Markdown content | Editorial pages with navigation and metadata |
| Taxonomy and collections | Category, stack, license, and collection views |
| One site config | Canonical URLs, sitemap, robots, OG images, JSON-LD, README block, JSON datasets, `llms.txt` |
| Review rules | Validation, health signals, cleanup reports, reviewable sync diffs |

## How it works

```text
Author  →  Validate  →  Publish  →  Maintain
```

1. **Author.** One YAML file per record in `data/records/`, optional Markdown
   sidecars for long-form content, taxonomy and curated collections alongside.
2. **Validate.** `grove check` parses every file against the schema, reports
   errors and warnings, and writes the generated artifacts. The Astro
   integration runs the same pipeline on `dev` and `build`.
3. **Publish.** `pnpm build` emits a static site plus every machine-readable
   surface. Deploy it anywhere that serves files.
4. **Maintain.** `grove sync github` refreshes machine-owned fields,
   `grove cleanup` files stale records into a review queue, and
   `data/decisions.yml` records what a human decided and why.

Automation synchronizes facts and flags candidates for review. It does not
decide what belongs in your collection, and it does not promise your content
is never outdated.

## Quickstart

```bash
pnpm dlx @grove-dev/cli@latest init my-space   # scaffold + install
cd my-space

pnpm dev                                        # http://localhost:4321
pnpm exec grove check                           # validate + regenerate artifacts
pnpm build                                      # static output in dist/
```

After `grove check` you will find generated JSON under `data/generated/` and
`sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt`, plus per-page social
cards under `public/`. Those files are Grove-owned — edit the sources, not the
output.

Next: [add your first record](https://withgrove.dev/getting-started/add-your-first-project/),
then [configure the space](https://withgrove.dev/getting-started/configure/).

## What you own

Everything that matters stays in your repository:

```text
data/records/          one YAML file per record — the filename is the slug
data/taxonomy/         categories, stacks, platforms, licenses, topics
data/collections/      curated collections with a written rationale
data/decisions.yml     curator visibility overrides, with reasons  (optional)
data/overrides.yml     manual record patches                       (optional)
content/records/       Markdown sidecars for long-form record content
grove.config.ts        site identity, navigation, theme, integrations
src/pages/             every route, copied into your project and yours to edit
src/styles/global.css  theme overrides                             (optional)
```

Grove supplies the engine, the components, and the generators. It does not own
your routes: `grove init` **copies** pages into your project, and no later
Grove command overwrites them. There is no hosted service, no runtime database,
no admin UI, and no account.

## Supported today

- **Astro is the supported renderer.** `@grove-dev/astro` is the integration;
  there is no SvelteKit or Next.js adapter, and none is scaffolded.
- **`project-directory` is the polished blueprint.** `resource-hub` and
  `ecosystem-map` have stable schemas and generate correctly, but reuse the
  project-directory page templates rather than shipping tuned ones.
- **Output is static and public.** There is no auth, no paywall, and no
  private-space mode.
- **Node.js ≥ 22.12.** Astro 6 or 7.

Honest limitations: one record per YAML file (multi-record bundles are a future
schema); GitHub is the only metadata sync source; the audit command needs a
local Chrome; and JSON-LD is emitted as valid structured metadata, which is not
the same as a guarantee of search-engine rich results.

## Built with Grove

[**Open App Scout**](https://openappscout.com) — a directory of 76 curated
open-source applications with 83 contributors, running the published
`@grove-dev/*` packages from outside this monorepo. It is the acceptance
consumer: a release that breaks it is a release that does not ship.
[Source](https://github.com/tortuvshin/open-apps).

## Packages

| Package | Role |
| --- | --- |
| [`@grove-dev/core`](./packages/core) | Headless engine — schemas, validation, generation, sync, collections, SEO artifacts, health, decisions, importers. No UI. |
| [`@grove-dev/astro`](./packages/astro) | The Astro integration, layouts, components, and server view-models. |
| [`@grove-dev/cli`](./packages/cli) | `grove` — create a project and run every maintenance operation. |
| [`@grove-dev/starlight`](./packages/starlight) | An optional Starlight documentation theme. Independent of the publishing pipeline. |

```text
packages/     the four published packages
apps/example/ the canonical demo — and the single source for `grove init`
apps/docs/    the Starlight documentation site (withgrove.dev)
```

The CLI packages a snapshot of `apps/example/`, so the demo you can read and
the project you get from `grove init` cannot drift into separate
implementations.

## Contributing

```bash
pnpm install
pnpm dev          # run apps/example
pnpm check        # types
pnpm test         # unit + integration
pnpm build        # every package + the example
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow, and
[the contributor guide](https://withgrove.dev/maintainers/contributing/) for
architecture notes.

- [Issues](https://github.com/tortuvshin/grove/issues) ·
  [Discussions](https://github.com/tortuvshin/grove/discussions)
- [Security policy](./SECURITY.md) ·
  [Code of conduct](./CODE_OF_CONDUCT.md)

## License

[MIT](./LICENSE)
