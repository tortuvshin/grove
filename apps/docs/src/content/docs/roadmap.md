---
title: Roadmap
description: Grove's shipping status — what 0.6.1 ships today, what is planned, and what is explicitly out of scope.
---

> This page reflects Grove's **shipping state**. Everything under
> "Shipped" is in the published packages today. Everything below it is
> a plan, and plans move.

## How to read this

The roadmap is grouped by status, not by chronology:

- **Shipped — `0.6.1`** — in the published packages right now.
- **Next release** — scoped items expected in the following version.
- **Later — directional** — will happen only if a real Grove space needs it.
- **Out of scope** — explicit non-goals that will not be built.

For the per-version history, see
[`CHANGELOG.md`](https://github.com/tortuvshin/grove/blob/main/CHANGELOG.md)
at the repository root.

---

## Shipped — `0.6.1`

### Packages

Four packages on npm under the `@grove-dev/*` scope. All four are
public and versioned in lockstep at `0.6.1`.

| Package                | Version | Role                                                                                                                     |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `@grove-dev/core`      | `0.6.1` | Headless engine — config, schemas, validation, generation, synchronization, collections, SEO artifacts, health, decisions, importers |
| `@grove-dev/astro`     | `0.6.1` | The supported renderer — integration, layouts, components, server view-models                                            |
| `@grove-dev/cli`       | `0.6.1` | `init`, `check`, `sync`, `cleanup`, `import`, `collection promote`, `readme generate`, `icons sync`, `audit`             |
| `@grove-dev/starlight` | `0.6.1` | Optional Starlight documentation theme (this site)                                                                       |

`@grove-dev/ui`, `@grove-dev/svelte`, and `@grove-dev/nextjs` do **not**
exist in the workspace and have never been published. Older documents in
the repository that mention them are historical.

### Renderers

| Renderer  | Status                                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| Astro     | **Supported.** The only renderer. `pnpm dev` / `pnpm build` invoke `astro dev` / `astro build` through the `@grove-dev/astro` integration. |
| SvelteKit | **Not shipped.** No package exists.                                                                          |
| Next.js   | **Not shipped.** No package exists.                                                                          |

### Blueprints

A blueprint binds a `kind` to a schema, a default route, and the filters
a space exposes. Records are a discriminated `Resource` union.

| Blueprint           | `kind`     | Schema | Default UI   | Notes                                                                        |
| ------------------- | ---------- | ------ | ------------ | ---------------------------------------------------------------------------- |
| `project-directory` | `project`  | Stable | Stable       | The polished end-to-end default; every page template is tuned for it.        |
| `resource-hub`      | `resource` | Stable | Experimental | Schema validates and records generate; pages reuse the project-directory templates. |
| `ecosystem-map`     | `entity`   | Stable | Experimental | Schema validates and records generate; pages reuse the project-directory templates. |

### CLI surface

```
grove init [directory] [--no-install] [--no-git]
grove check [--strict]
grove sync <github|contributors> [--limit N] [--strict]
grove cleanup [--strict]
grove import <source>
grove collection promote --from PATH --slug SLUG [--title T] [--description D]
grove readme generate [--stdout] [--path PATH] [--check]
grove icons sync [--force]
grove audit [--base-url URL] [--mobile|--desktop] [--runs N]
            [--page PATH]… [--json FILE] [--junit FILE]
```

See the [CLI reference](/reference/cli/) for the full options, reads,
writes, and exit codes of each command.

### Generated outputs

`grove check` (and every `astro dev` / `astro build`, through the
integration) produces:

- `data/generated/records.full.json` — every record, every field.
- `data/generated/records.index.json` — slim projection for list pages.
- `data/generated/records.json` — alias for `records.full.json`.
- `data/generated/site-config.json` — site name, tagline, nav, theme,
  taxonomy, integrations, repo stats.
- `public/sitemap.xml`, `public/robots.txt` — search-engine surface.
- `public/llms.txt`, `public/llms-full.txt` — LLM-oriented surface.
- `public/og/*.png` — per-record, per-collection, per-taxonomy social
  cards, content-hashed so unchanged pages skip the rasterizer.

Other commands add: `data/generated/cleanup-report.json` (`grove cleanup`),
and `data/generated/contributors.json` + `repo-stats.json`
(`grove sync contributors`).

### SEO surface

Every page declares a `PageDocument`; the framework emits title,
description, canonical, Open Graph, Twitter, and JSON-LD from that one
declaration. See [SEO & social](/outputs/seo/).

JSON-LD is emitted as valid structured metadata. It is **not** a
guarantee of Google rich results — search engines decide what to render.

### Schema constraints

- One YAML file = one record. The filename (minus `.yml`) is the
  canonical slug. Multi-record files are a future feature.
- `kind` must match the blueprint of the space that owns the record
  (`project`, `resource`, or `entity`).
- Records without `health` are allowed for `resource-hub` and
  `ecosystem-map`; their effective visibility is the top-level
  `visibility` field, defaulting to `keep`.
- The public surface of `@grove-dev/core` is exactly what
  `packages/core/src/index.ts` re-exports.

---

## Next release

Scoped items expected in the version after `0.6.1`. Dates are not set.

### Lighthouse audit on every relevant PR

`.github/workflows/lighthouse-audit.yml` runs today on changes to
`packages/{core,cli,astro}/**` or `apps/example/**` and on a weekly
cron. The next release runs it on every PR that touches the audit
manifest or the example app, posting the scorecard as a check run.

### Explicit public API snapshot

`@grove-dev/core` and `@grove-dev/astro` still use broad `export *`
re-exports in places. The next release narrows them to deliberate named
exports with a snapshot test, so an accidental surface change is caught
before it is published.

### External consumer verification

Grove releases should be tested against at least one consumer outside
the monorepo before publishing. See
[Built with Grove](/open-apps/) for the current state of that work.

---

## Later — directional

These are real conversations the project will have. Each happens only if
at least one Grove-powered space needs it.

### Polished `resource-hub` and `ecosystem-map` defaults

Both blueprints validate and emit JSON today, but the shipped list and
detail templates are tuned for `project-directory`. Reference templates
will ship when a consumer space needs them.

### Spaces index (read-only)

A static page listing known Grove-powered spaces. Each space reports its
URL, blueprint, and a one-line description via a JSON file in its own
repository. No central database, no scraping, no auth.

### AI-assisted curation (gated)

An optional CLI pass that suggests topics, tags, and descriptions for
uncurated records. Always a suggestion, never a write — the CLI would
not modify `data/records/*.yml` without a human review step.

### Federation (only if asked)

A space imports resources from another space, read-only. No central
write authority; each space keeps its own source of truth.

### Multi-record YAML files

A single YAML file carrying a `records: [...]` array, behind
`recordsBundleSchema`.

### SvelteKit and Next.js adapters

Would graduate from "not shipped" only if a real community space needs
one. No such demand exists today, so no scaffolding or templates are
committed.

---

## Out of scope — explicit non-goals

These are not roadmap items. If a contributor proposes one, the answer
is no, and "no" is the design decision.

- **A hosted Grove SaaS.** Grove is a library and a CLI, not a service.
- **A database, CMS, or admin dashboard.** Data lives in files.
- **A plugin marketplace.** The engine is small enough to fork.
- **Real-time collaboration.** Pull requests are the collaboration layer.
- **Auth, paywalls, private spaces.** Generated output is static and public.
- **Replacing `awesome-*` repositories.** Grove runs alongside them.
- **Tying the data model to GitHub.** GitHub is one optional signal,
  not the spine.

---

## How to influence the roadmap

- **File an issue** describing a real gap you hit while running Grove.
  See [CONTRIBUTING.md](https://github.com/tortuvshin/grove/blob/main/CONTRIBUTING.md).
- **Open a pull request** with a focused change. Focused changes land faster.
