---
title: Roadmap
description: Grove's shipping status — what v0.4.0 ships today, what is planned, and what is out of scope.
---

> Grove ships in waves. Each wave ends with something a community can
> use. This page reflects the **shipping state**, not the wave narrative.

## How to read this

The roadmap is grouped by status, not by chronology:

- **Shipped** — available in `v0.4.0` (the current published release).
- **Next release (v0.5.0)** — scoped and targeted. APIs may shift
  before the cut.
- **Later** — directional. Will happen only if real spaces need it.
- **Out of scope** — explicit non-goals we will not build.

For the per-version changelog, see
[`CHANGELOG.md`](https://github.com/tortuvshin/grove/blob/main/CHANGELOG.md)
at the repo root. For the historical record of how Grove got here, see
[`docs/superpowers/`](https://github.com/tortuvshin/grove/tree/main/docs/superpowers)
(also mirrored inside `.audit/superpowers/` for working notes).

---

## Shipped — v0.4.0

The current published release. `v0.4.0` aligns the four published
packages on a single version line and ships the
`grove collection promote` command for the first time.

### Packages

Four packages on npm under the `@grove-dev/*` scope. **All four are
public** and pinned at `0.4.0`. `@grove-dev/ui`, `@grove-dev/svelte`,
and `@grove-dev/nextjs` do **not** exist in the workspace and have
never been published.

| Package                | Version | Role                                                                          |
| ---------------------- | ------- | ----------------------------------------------------------------------------- |
| `@grove-dev/core`      | `0.4.0` | Schema, config, importers, validators, taxonomy, sync, build pipeline        |
| `@grove-dev/cli`       | `0.4.0` | `init`, `check`, `sync`, `cleanup`, `audit`, `collection promote`             |
| `@grove-dev/astro`     | `0.4.0` | The V1 renderer — 31 components, layouts, server view-models                  |
| `@grove-dev/starlight` | `0.4.0` | Documentation site plugin (this site)                                         |

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

| Blueprint           | `kind`     | Schema  | Polished default pages |
| ------------------- | ---------- | :-----: | :--------------------: |
| `project-directory` | `project`  | ✅      | ✅ (`project-directory` template) |
| `resource-hub`      | `resource` | ✅      | Schema valid, list/detail routes exposed via `routes.directory`. |
| `ecosystem-map`     | `entity`   | ✅      | Schema valid, list/detail routes exposed via `routes.directory`. |

### CLI commands

The complete V1 surface, six top-level commands plus one sub-command:

```
grove init [directory] [--no-install] [--no-git]
grove check [--strict]
grove sync github [--limit N] [--strict]
grove sync contributors
grove cleanup [--strict]
grove audit [--base-url URL] [--mobile|--desktop] [--runs N]
            [--page PATH]… [--json FILE] [--junit FILE]
grove collection promote --from PATH --slug SLUG [--title T] [--description D]
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
- `kind` must match the blueprint of the site that owns the record
  (`project`, `resource`, or `entity`).
- Records without `health` are allowed for `resource-hub` and
  `ecosystem-map` blueprints; their effective visibility is the
  top-level `visibility` field, defaulting to `keep`.
- The V1 public surface of `@grove-dev/core` is exactly what
  `packages/core/src/index.ts` re-exports; everything else
  (`IndexRecord`, `loadRecords`, `unwrap*`, etc.) is internal.

---

## Next release — v0.5.0

Scope is set. Dates are not — v0.5.0 cuts when the items below are
ready, not before. The four items are the V1 release-line priorities
flagged during the v0.4.0 retrospective: internal consistency, PR-time
quality gating, contributor ergonomics, and audit-finding close-out.

### `grove import` CLI

Wrap the existing `importAwesomeList` / `writeImportedRecords` parser
exposed by `@grove-dev/core` as a CLI command so contributors can run
`grove import https://github.com/<owner>/awesome-<topic>` instead of
writing a small script. The parser and writer already ship; the CLI
layer is what unblocks the docs and `submit` flow from re-implementing
the import path inline.

### Lighthouse audit on every PR

`.github/workflows/lighthouse-audit.yml` today runs on changes to
`packages/{core,cli,astro}/**` or `apps/example/**` and on a weekly
cron. v0.5.0 will run it on every PR that touches the audit manifest
or `apps/example/`, posting the scorecard as a check run.

### Strict internal-link lint

Today `scripts/check-starlight-sidebar.mjs` validates sidebar slugs.
v0.5.0 will add a sibling script that validates every internal link in
every `apps/docs/src/content/docs/**/*.md` resolves to a real file,
and wire it as a `pnpm docs:check` step so the docs CI fails on stale
cross-links before they reach `main`.

### Close-out of verified audit findings

The internal post-launch audit catalogue (in `.audit/`) lists verified
recommendations that the shipped surface still does not address —
rasterising the OG image to PNG, third-party-action SHA pinning, OIDC
trusted publishing, and so on. v0.5.0 will land as many as fit before
the cut. Anything left over graduates to `v0.5.x` patches or v0.6.0;
every item is enumerated either way so the catalogue shrinks on every
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

### Polished `resource-hub` and `ecosystem-map` defaults (deferred from v0.5.0)

Today both blueprints validate and emit JSON, but the polished list /
detail page templates that ship with the Astro renderer are tuned for
`project-directory`. Deferred from v0.5.0; reference templates will
ship when a consumer site needs them.

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