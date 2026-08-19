---
title: Roadmap
description: Grove's shipping status — what `0.5.0-next.2` ships today, what is planned, and what is out of scope.
---

> Grove ships in waves. Each wave ends with something a community can
> use. This page reflects the **shipping state**, not the wave narrative.

## How to read this

The roadmap is grouped by status, not by chronology:

- **Shipped — `0.5.0-next.2`** — available in the current pre-release.
  The four published packages are pinned at `0.5.0-next.2`; nine CLI
  commands and 37 Astro components are live.
- **Closing for v0.5.0** — the items below that still need to land
  before the stable cut. Dates are not set.
- **Later — directional** — will happen only if real spaces need it.
- **Out of scope** — explicit non-goals we will not build.

For the per-version changelog, see
[`CHANGELOG.md`](https://github.com/tortuvshin/grove/blob/main/CHANGELOG.md)
at the repo root.

---

## Shipped — `0.5.0-next.2`

The current pre-release. The four published packages are pinned at
`0.5.0-next.2`; nine CLI commands and 37 Astro components ship.

### Packages

Four packages on npm under the `@grove-dev/*` scope. **All four are
public** and pinned at `0.5.0-next.2`. `@grove-dev/ui`, `@grove-dev/svelte`,
and `@grove-dev/nextjs` do **not** exist in the workspace and have
never been published.

| Package                | Version          | Role                                                                                                            |
| ---------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `@grove-dev/core`      | `0.5.0-next.2`   | Schema, config, importers, validators, taxonomy, sync, build pipeline, awesome-list README generator, audit     |
| `@grove-dev/cli`       | `0.5.0-next.2`   | `init`, `check`, `sync github`, `sync contributors`, `cleanup`, `audit`, `import`, `collection promote`, `readme generate` |
| `@grove-dev/astro`     | `0.5.0-next.2`   | The V1 renderer — 37 components, 7 layouts, server view-models                                                  |
| `@grove-dev/starlight` | `0.5.0-next.2`   | Documentation site plugin (this site)                                                                           |

### Frameworks

| Framework    | Status                                                                       |
| ------------ | ---------------------------------------------------------------------------- |
| Astro        | **V1 supported.** Astro is the only renderer; `pnpm dev` and `pnpm build`     |
|              | invoke `astro dev` / `astro build` and the `@grove-dev/astro` integration.   |
| SvelteKit    | **Not shipped.** No `@grove-dev/svelte` package exists. The scaffold only     |
|              | emits an Astro project; "Svelte" / "SvelteKit" does not appear anywhere.      |
| Next.js      | **Not shipped.** No `@grove-dev/nextjs` package exists.                       |

### Blueprints

A blueprint binds a `kind` to a schema, a default route, and the
filters a space exposes. Records are a discriminated `Resource` union.

| Blueprint           | `kind`     | Status |
| ------------------- | ---------- | ------ |
| `project-directory` | `project`  | ✅ Shipped — the only supported blueprint. `grove init` always scaffolds it. |

The schema also defines `resource-hub` (`kind: resource`) and
`ecosystem-map` (`kind: entity`), but neither is a supported
blueprint yet — there's no scaffold, template, or documented
authoring path for them. See [Later — directional](#later--directional).

### CLI commands

The complete `0.5.0-next.2` surface — nine top-level + sub commands:

```
grove init [directory] [--no-install] [--no-git]
grove check [--strict]
grove sync github [--limit N] [--strict]
grove sync contributors
grove cleanup [--strict]
grove audit [--base-url URL] [--mobile|--desktop] [--runs N]
            [--page PATH]… [--json FILE] [--junit FILE]
grove import <source>           # GitHub URL, raw README URL, or local path
grove collection promote --from PATH --slug SLUG [--title T] [--description D]
grove readme generate [--stdout] [--path PATH] [--check]
```

See the [CLI reference](/reference/cli/) for the full options, reads,
writes, and exit codes of each command.

### Generated outputs

Every `grove check` produces:

- `data/generated/records.full.json` — every record, every field.
- `data/generated/records.index.json` — slim projection for list pages.
- `data/generated/records.json` — alias for `records.full.json`.
- `data/generated/site-config.json` — site name, tagline, nav, theme,
  taxonomy, integrations, repo stats.
- `data/generated/cleanup-report.json` — when `grove cleanup` runs.
- `data/generated/contributors.json` + `repo-stats.json` — when
  `grove sync contributors` runs.
- `public/sitemap.xml`, `public/robots.txt` — search-engine surface.
- `public/llms.txt`, `public/llms-full.txt` — AI-readable surface.
- `public/og-image.svg` — re-emitted when the marker comment is present.

### Schema constraints

- One YAML file = one record. The filename (minus `.yml`) is the
  canonical slug. Multi-record files are a V2 feature.
- `kind` must match the blueprint of the site that owns the record.
  Today that means `kind: project`, the only supported blueprint.
- The V1 public surface of `@grove-dev/core` is exactly what
  `packages/core/src/index.ts` re-exports; everything else
  (`IndexRecord`, `loadRecords`, `unwrap*`, etc.) is internal.

### What `0.5.0-next.2` already includes

The following items are already in the codebase; the stable `0.5.0`
cut is the version line where they ship together.

- **`grove import`** — wraps the `importAwesomeList` +
  `writeImportedRecords` parser as a CLI command so contributors can
  run `grove import https://github.com/<owner>/awesome-<topic>` and
  land `data/records/<slug>.yml` files tagged `source: { type: "import" }`.
- **`grove collection promote`** — promotes a filter URL
  (e.g. `/browse?stack=flutter&category=finance`) into a curated
  `data/collections/<slug>.yml` with `kind: curated`,
  `ranking.preset: quality`, and `excludeStatuses: [archived]`.
- **`grove readme generate`** — renders the awesome-list README
  block between `<!-- grove-readme:start -->` /
  `<!-- grove-readme:end -->` sentinels; supports `--stdout`,
  `--path`, and `--check` for CI.
- **`grove audit`** — runs Lighthouse against the `audit.pages[]`
  manifest in `grove.config.ts` and enforces the default quality
  budget (Lighthouse "good" thresholds: scores ≥ 0.9, lcp ≤ 2500ms,
  cls ≤ 0.25, tbt ≤ 200ms).
- **Internal-link lint** — `scripts/check-starlight-internal-links.mjs`
  walks every Markdown / MDX file under `apps/docs/src/content/docs/`
  and asserts each `/path/` target resolves to a real file; wired
  into `pnpm docs:check`.

---

## Closing for v0.5.0

A short list of items still to land before the stable cut. Everything
in this section is scoped; the stable `0.5.0` ships when the list is
empty.

### Lighthouse audit on every PR

`.github/workflows/lighthouse-audit.yml` today runs on changes to
`packages/{core,cli,astro}/**` or `apps/example/**` and on a weekly
cron. `v0.5.0` will run it on every PR that touches the audit
manifest or `apps/example/`, posting the scorecard as a check run.

### Close-out of verified audit findings

The internal post-launch audit catalogue lists verified recommendations
that the shipped surface still does not address — rasterising the OG
image to PNG, third-party-action SHA pinning, OIDC trusted publishing,
and so on. `v0.5.0` will land as many as fit before the cut.
Anything left over graduates to `v0.5.x` patches or `v0.6.0`; every
item is enumerated either way so the catalogue shrinks on every
release.

---

## Later — directional

These are real conversations the project will have. Each one happens
only if at least one Grove-powered space needs it.

### Spaces dashboard (read-only)

A static page that lists every known Grove-powered space. Each space
reports its URL, blueprint, and a one-line description via a JSON file
in its own repo. **No central database. No scraping. No auth.** Just
curated links.

### AI-assisted curation (gated)

An optional CLI pass that suggests topics, tags, and descriptions for
uncurated records. **Always a suggestion, never a write.** Humans
approve. The CLI never modifies `data/records/*.yml` without a human
review step.

### Federation (only if asked)

A space can import resources from another space (read-only). A "Grove
network" view aggregates featured resources from many spaces. No
central write authority — each space keeps its own source of truth.

### Multi-record YAML files (`recordsBundleSchema`)

V2 schema behind `recordsBundleSchema` so a single YAML file can
carry a `records: [...]` array. Today this is explicitly a V2 feature.

### SvelteKit and Next.js adapters (deferred from v0.5.0)

`@grove-dev/svelte` and `@grove-dev/nextjs` would graduate from
"planned" to "shipped" if a real community space needs one. Today no
such demand exists, so no scaffolding or templates are committed.
Deferred from v0.5.0 to avoid scope creep.

### `resource-hub` and `ecosystem-map` blueprints (deferred from v0.5.0)

The `resourceRecordSchema` and `entityRecordSchema` shapes exist in
`packages/core/src/schema.ts`, but neither is a supported blueprint:
there's no `grove init` scaffold, no list/detail page templates, and
no documented authoring path. Turning them into real blueprints —
scaffold, routes, templates — is deferred from v0.5.0; it will happen
when a consumer site needs one.

---

## Out of scope — explicit non-goals

These are not roadmap items. If a contributor proposes any of them,
the answer is no, and "no" is the design decision.

- **A hosted Grove SaaS.** The framework repo is not a marketing site.
- **A database, CMS, or admin dashboard.** Data lives in files.
- **A plugin marketplace.** The engine is small enough to fork.
- **Real-time collaboration.** PRs are the collaboration layer.
- **Auth, paywalls, private spaces.** Every space is public.
- **Replacing `awesome-*` repos.** Grove runs alongside them, not
  against them.
- **Tying the data model to GitHub.** GitHub is one optional signal,
  not the spine.

---

## How to influence the roadmap

- **File an issue** describing a real gap you hit while running Grove.
  Real-space findings drive real roadmap changes — see
  [CONTRIBUTING.md](https://github.com/tortuvshin/grove/blob/main/CONTRIBUTING.md).
- **Open a PR** with a focused change. Focused changes land faster.
- **Read the audit.** An internal post-launch audit catalogues verified
  issues, deferred items, and breaking changes that would be needed
  for V1.1+. It is the working backlog.