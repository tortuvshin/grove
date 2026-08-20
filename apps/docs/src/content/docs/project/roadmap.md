---
title: Roadmap
description: What Grove 0.6.1 ships today, what is being worked on, what may happen later, and what will never be built.
---

This page is the shipping state, not a schedule. It is grouped by status:
what exists today, what is actively in flight, what is directional, and
what is an explicit non-goal.

For per-version detail, read
[`CHANGELOG.md`](https://github.com/tortuvshin/grove/blob/main/CHANGELOG.md)
at the repo root.

## Shipped — `0.6.1`

Four packages, released in lockstep at the same version.

| Package | Role |
|---|---|
| `@grove-dev/core` | Schema, config, importers, validation, taxonomy, sync, the build pipeline, the awesome-list README generator, and the audit budget |
| `@grove-dev/cli` | The `grove` command |
| `@grove-dev/astro` | The renderer — 33 components, 7 layouts, and the server-side view models |
| `@grove-dev/starlight` | The Starlight theme plugin this documentation site runs on |

`@grove-dev/ui`, `@grove-dev/svelte`, and `@grove-dev/nextjs` do not exist
in the workspace and have never been published.

### Renderer

Astro is the only renderer. `pnpm dev` and `pnpm build` are `astro dev` and
`astro build`; the `@grove-dev/astro` integration hooks
`astro:config:setup` and runs the whole data pipeline from there, so a
build needs no prebuild script of its own.

### CLI surface

Nine top-level commands:

```
grove init [directory] [--no-install] [--no-git]
grove check [--strict]
grove sync github [--limit N] [--strict]
grove sync contributors [--strict]
grove cleanup [--strict]
grove audit [--base-url URL] [--mobile|--desktop] [--runs N]
            [--page PATH]… [--json FILE] [--junit FILE]
grove import <source>
grove collection promote --from PATH --slug SLUG [--title T] [--description D]
grove icons sync [--force] [--check]
grove readme generate [--stdout] [--path PATH] [--check]
```

The [CLI reference](/reference/cli/) has the full options, the files each
command reads and writes, and its exit codes.

### Outputs

Rewritten on every build (`grove check`, `astro dev`, `astro build`):

- `data/generated/records.full.json`, `records.index.json`, `records.json`,
  `site-config.json`, `og-manifest.json`
- `public/sitemap.xml`, `public/llms.txt`, `public/llms-full.txt`
- `public/og/**` — per-page PNG social cards
- `public/robots.txt`, `public/og-image.svg` — only while Grove still owns
  them; editing away the marker line takes ownership permanently

Written only by their own command: `cleanup-report.json` (`grove cleanup`),
`contributors.json` and `repo-stats.json` (`grove sync contributors`), and
the `README.md` sentinel block (`grove readme generate`).

[Outputs overview](/outputs/overview/) covers every one of these in detail.

### Schema constraints

- One YAML file is one record. The filename minus `.yml` is the canonical
  slug; a `slug:` field that disagrees is a warning and the filename wins.
- Every record is `kind: project`. `resourceRecordSchema` and
  `entityRecordSchema` exist in the schema file but have no scaffold, no
  routes, and no authoring path — treat them as schema-only.
- The public surface of `@grove-dev/core` is exactly what
  `packages/core/src/index.ts` re-exports. Anything else is internal and
  may change without notice.

## In flight

### Health derivation is not wired up

`classifyHealth` in `packages/core/src/health.ts` derives a record's
status, maturity, tier, visibility, and cleanup flag from its GitHub
metadata — but no shipped command runs it. `grove sync github` writes only
under `github.*`, and `data/health.yml` is validated by `grove check`
without ever being read by the build. Health entries are hand-authored
today. Closing this gap is the largest outstanding item.

### Audit findings from the post-launch review

The internal audit catalogue still lists verified items the shipped surface
does not address — third-party action SHA pinning and OIDC trusted
publishing among them. Each release closes as many as fit; the rest carry
forward enumerated rather than dropped.

## Later — directional

None of these are committed. Each happens only if a real Grove-powered
space needs it.

- **A read-only spaces dashboard.** A static page listing known Grove
  spaces, each self-reporting via a JSON file in its own repo. No central
  database, no scraping, no auth.
- **AI-assisted curation, gated.** An optional CLI pass suggesting topics,
  tags, and descriptions for uncurated records. Always a suggestion, never
  a write — the CLI would not modify `data/records/*.yml` without a human
  approving.
- **Federation.** One space importing records from another, read-only, with
  no central write authority.
- **Multi-record YAML files.** A single file carrying a `records: [...]`
  array, behind `recordsBundleSchema`.
- **SvelteKit and Next.js renderers.** No demand today, so no scaffolding
  and no templates are committed.
- **Making `resource` and `entity` real.** Turning those schema shapes into
  usable spaces means a scaffold, routes, and templates. Deferred until a
  consumer site needs one.

## Out of scope

Not roadmap items. If a contributor proposes one, the answer is no, and the
"no" is the design decision.

- **A hosted Grove SaaS.** The framework repo is not a marketing funnel.
- **A database, CMS, or admin dashboard.** Data lives in files.
- **A plugin marketplace.** The engine is small enough to fork.
- **Real-time collaboration.** Pull requests are the collaboration layer.
- **Auth, paywalls, private spaces.** Every space is public.
- **Replacing `awesome-*` repos.** Grove runs alongside them.
- **Tying the data model to GitHub.** GitHub is one optional signal, not
  the spine.

## Influencing this list

File an issue describing a real gap you hit while running Grove —
findings from real spaces are what actually move this page. Focused pull
requests land faster than broad ones. See
[CONTRIBUTING.md](https://github.com/tortuvshin/grove/blob/main/CONTRIBUTING.md).
