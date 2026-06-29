---
title: Roadmap
description: Grove's shipping status — what v0.3.0 ships today (patched through v0.3.1), what is planned for V1.1, and what is directional or out of scope.
---

> Grove ships in waves. Each wave ends with something a community can use.
> This page reflects the **shipping state**, not the wave narrative.

## How to read this

The roadmap is grouped by status, not by chronology:

- **Shipped** — available in `v0.3.0` (initial public release, 2026-06-11). The current repo tag is `v0.3.1` (2026-06-30), a docs-only patch that aligns the docs site with v0.3.0's actual surface. No package source changed in `v0.3.1`.
- **Next release (V1.1)** — scoped and targeted. APIs may shift before the cut.
- **Later** — directional. Will happen only if real spaces need it.
- **Out of scope** — explicit non-goals we will not build.

For the historical record of how Grove got here, see the [original Wave 0 → Wave 5 plan](https://github.com/tortuvshin/grove/blob/main/docs/roadmap.md) on GitHub. This page replaces it.

For the per-version changelog, see [`CHANGELOG.md`](https://github.com/tortuvshin/grove/blob/main/CHANGELOG.md) at the repo root.

---

## Shipped — v0.3.0 (patched through v0.3.1)

The initial public release. The current repo tag `v0.3.1` is a
docs-only patch over the same package surface — see the
[release notes](https://github.com/tortuvshin/grove/releases/tag/v0.3.1)
for the patches applied to the docs site. **No `@grove-dev/*` package
source changed in `v0.3.1`.**

### Packages

Seven packages on npm under the `@grove-dev/*` scope. **Five public**
(`core`, `ui`, `cli`, `astro`, `starlight`) are the V1-supported surface.
**Two private-but-published adapters** (`@grove-dev/svelte`,
`@grove-dev/nextjs`) exist only to reserve their import paths; their
templates are skeleton-only and the V1 CLI refuses
`--framework svelte` / `--framework nextjs` at scaffold time.

| Package                | Version  | Role                                                                          |
| ---------------------- | -------- | ----------------------------------------------------------------------------- |
| `@grove-dev/core`      | `0.2.21` | Schema, config, importers, validators, taxonomy, sync, build pipeline        |
| `@grove-dev/ui`        | `1.0.10` | Framework-agnostic UI primitives (filter, sort, score, slug, paginate)        |
| `@grove-dev/cli`       | `0.2.20` | `grove new`, `import`, `validate`, `generate`, `sync github`, `sitemap`, …    |
| `@grove-dev/astro`     | `0.2.20` | The V1 renderer — 22 components, 1 layout, tokens, default template           |
| `@grove-dev/starlight` | `0.2.20` | Documentation site plugin (this site)                                         |
| `@grove-dev/svelte`    | `0.2.20` | Skeleton only — see [adapters/svelte](/adapters/svelte/)                      |
| `@grove-dev/nextjs`    | `0.2.20` | Skeleton only — see [adapters/nextjs](/adapters/nextjs/)                      |

Versions are the current `v0.2.21` / `1.0.10` / `0.2.20` track on npm. Version drift across the seven packages is an open issue and is **not** resolved in `v0.3.1` (the patch is docs-only).

### Frameworks

| Framework    | Status           |
| ------------ | ---------------- |
| Astro        | V1 supported     |
| SvelteKit    | Skeleton only — `--framework svelte` rejected at scaffold time. Working scaffold lands in V1.1. |
| Next.js      | Skeleton only — `--framework nextjs` rejected at scaffold time. Working scaffold lands in V1.2. |

### Blueprints

A blueprint binds a `kind` to a schema, a default route, and the filters a space exposes. Records are a discriminated `Resource` union.

| Blueprint           | `kind`     | Data | Polished default pages |
| ------------------- | ---------- | :--: | :--: |
| `project-directory` | `project`  | ✅   | ✅   |
| `resource-hub`      | `resource` | ✅   | ❌ (V1.1) |
| `ecosystem-map`     | `entity`   | ✅   | ❌ (V1.1) |

Only `project-directory` ships polished default pages today. `resource-hub` and `ecosystem-map` validate, build, and produce the right JSON; the polished list and detail pages are V1.1 work.

### CLI commands

```
grove new <name>                  # Interactive scaffold (name, framework, deploy, blueprint)
grove import <awesome-list-url>   # Turn a Markdown list into data/records/*.yml
grove validate                    # Strict per-record validation
grove generate                    # Build data/generated/records.{full,index}.json
grove sync github                 # Refresh activity, releases, topics, archive signals
grove cleanup stale --report      # Flag records that need human review
grove sitemap                     # Emit public/sitemap.xml
grove llms                        # Emit public/llms.txt and llms-full.txt
grove workflows sync              # Sync GitHub Actions templates into the space
grove build                       # Framework-aware build (today: astro build)
grove dev                         # Framework-aware dev server (today: astro dev)
```

`grove sync contributors` is **not** in the shipped surface yet — it exists as a stub in V1 with no usable implementation. Real `sync contributors` is V1.1.

`grove run` is the dev-internal command for working on Grove itself; it is hidden from `--help` in published builds.

### Generated outputs

Every `grove build` produces:

- `dist/` — static HTML for every record, blueprint index, and about page
- `public/sitemap.xml` and `public/robots.txt` — search-engine surface
- `public/llms.txt` and `public/llms-full.txt` — AI-readable surface
- `public/records.json` — full record set for other tools
- `.github/workflows/*.yml` — validate, build, deploy, sync, cleanup workflows

### What changed in v0.3.1 (docs-only patch)

The full list is in [`CHANGELOG.md`](https://github.com/tortuvshin/grove/blob/main/CHANGELOG.md#031--2026-06-30). The short version:

- **Production-site honesty.** The standalone `/` page no longer advertises commands, file names, or framework support that don't exist. Fake `grove add` / `grove deploy` are gone; the mock terminal writes `grove.config.ts`; the eight-framework logo wall is replaced with an honest "Astro today, planned" status card; the "Integrate with your favorite tools" orbital diagram is replaced with "One source, multiple outputs".
- **JSON-LD cleanup.** The `SearchAction` block (which pointed at a 404 `/search` route) is removed from the home page and the global Starlight `head` config.
- **Roadmap render fix.** `/roadmap/` no longer prints the raw `import { Content } from '../../../roadmap.md';` as visible text.
- **Brand and org consistency.** "Lucode" / "lucas-labs" user-visible branding is replaced with "Grove Starlight". `grove-dev/grove` references are replaced with `tortuvshin/grove`.
- **Two broken internal links fixed.** `/getting-started/add-your-first-record/` (typo) and `/getting-started/what-is-grove/`.
- **Roadmap document rewritten** to group by shipping status, not wave narrative.
- **Three dev-dependency bumps:** `astro` 6.4.6 → 7.0.3, `tailwindcss` 4.3.0 → 4.3.2, `@types/node` 25.9.2 → 26.0.1.

### What is **not** in v0.3.0 (or v0.3.1)

- A working `--framework svelte` or `--framework nextjs` scaffold
- Polished list/detail pages for `resource-hub` or `ecosystem-map` blueprints
- A working `grove sync contributors` command (stub only)
- A registry, federation, or any cross-space aggregation
- A hosted Grove SaaS, database, CMS, or admin dashboard
- Auth, paywalls, or private-space support

---

## Next release — V1.1

Scope is set. Dates are not — V1.1 cuts when the items below are ready, not before.

### Polished `resource-hub` default pages

The `/resources/<slug>` list and detail pages, built on the same `ItemCard`,
`IndexRow`, `RefinePanel`, and `ScoreBars` components the
`project-directory` template already uses. Data already flows through
`grove generate`; only the page chrome is new.

### Polished `ecosystem-map` default pages

The `/entities/<slug>` list and detail pages, with the entity-shaped
fields (`type`, `founded`, `location`, `members`, `parent`) surfaced in
the UI. Same component set as the other two blueprints.

### Working SvelteKit adapter

`@grove-dev/svelte` graduates from skeleton to usable. The
`--framework svelte` scaffold goes from "rejected at scaffold time" to
"produces a working SvelteKit site that builds with `pnpm build`".
The adapter uses the same `@grove-dev/ui` primitives as Astro, so the
blueprint-aware list and detail pages stay consistent across renderers.

### Real `sync contributors` command

`grove sync contributors` replaces its V1 stub with an actual
implementation that reads contributor data from the configured source(s)
and writes it to the `contributors:` field on each affected record.

**V1.1 is not:** a Next.js adapter, federation, registry entries, or
any feature that breaks the V1 schema.

---

## Later — directional

These are real conversations the project will have. Each one happens only if at least one Grove-powered space needs it.

### V1.2 — Working Next.js adapter

`@grove-dev/nextjs` graduates from skeleton to usable, with parity to the Astro and SvelteKit adapters. Same `@grove-dev/ui` primitives, same blueprint-aware routing.

### Spaces dashboard (read-only)

A static page that lists every known Grove-powered space. Each space reports its URL, blueprint, and a one-line description via a JSON file in its own repo. **No central database. No scraping. No auth.** Just curated links.

### AI-assisted curation (gated)

An optional CLI pass that suggests topics, tags, and descriptions for uncurated records. **Always a suggestion, never a write.** Humans approve. The CLI never modifies `data/records/*.yml` without a human review step.

### Federation (only if asked)

A space can import resources from another space (read-only). A "Grove network" view aggregates featured resources from many spaces. No central write authority — each space keeps its own source of truth.

### Open remaining audit findings

The v0.3.0-era audit catalogue (described in **How to influence**, below) lists verified recommendations that the shipped surface still does not address. Examples include rasterizing the OG image to PNG, explicit `editLink.baseUrl`, strict YAML schema parsing, strict record-slug path-traversal protection, `pnpm test` (vitest) in CI, explicit workflow `permissions:` blocks, third-party-action SHA pinning, OIDC trusted publishing, and resolving version drift across the seven packages. Each one is a candidate for a future minor or patch release.

---

## Out of scope — explicit non-goals

These are not roadmap items. If a contributor proposes any of them, the answer is no, and "no" is the design decision.

- **A hosted Grove SaaS.** The framework repo is not a marketing site.
- **A database, CMS, or admin dashboard.** Data lives in files.
- **A plugin marketplace.** The engine is small enough to fork.
- **Real-time collaboration.** PRs are the collaboration layer.
- **Auth, paywalls, private spaces.** Every space is public.
- **Replacing `awesome-*` repos.** Grove runs alongside them, not against them.
- **Tying the data model to GitHub.** GitHub is one optional signal, not the spine.

---

## Open questions

These shape the next waves. They are not blockers, but the answers shape the architecture.

1. **Resource identity** — should a resource be globally addressable across spaces (`grove:resource/<hash>`) or scoped to a single space? Lean: scoped, with optional cross-space references later.
2. **Space identity** — is a space just a repo URL, or does it need a registry entry? Lean: just a repo URL for V1.x. Registry later, if asked.
3. **Topics vs. tags** — same field or two distinct fields? Lean: two distinct fields. Topics are curated and finite; tags are open and free-form.
4. **Maintainers** — first-class people records with profiles, or free-form names per resource? Lean: free-form names with optional metadata for richer profiles later.
5. **Multi-language content** — engine-level i18n or space-level? Lean: space-level. The engine stays language-neutral.

We resolve these as V1.1 and V1.2 ship, not before.

---

## How to influence the roadmap

- **File an issue** describing a real gap you hit while running Grove. Real-space findings drive real roadmap changes — see [CONTRIBUTING.md](https://github.com/tortuvshin/grove/blob/main/CONTRIBUTING.md).
- **Open a PR** with a focused change. v0.3.1 was a docs-only patch; the v0.3.0 initial public release shipped in under three weeks of focused work; focused changes land faster.
- **Read the audit.** An internal post-launch audit catalogues verified issues, deferred items, and breaking changes that would be needed for V1.1+. It is the working backlog for the v0.3.x → V1.1 cycle.
