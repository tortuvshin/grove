---
title: Roadmap
description: Grove's shipping status — what v0.3.0 includes today, what is planned for the next release, and what is directional or out of scope.
---

> Grove ships in waves. Each wave ends with something a community can use.
> This page reflects the **shipping state**, not the wave narrative.

## How to read this

The roadmap is grouped by status, not by chronology:

- **Shipped** — available in `v0.3.0` (initial public release, 2026-06-11). Use it today.
- **Next release (V1.1)** — scoped and targeted. APIs may shift before the cut.
- **Later** — directional. Will happen only if real spaces need it.
- **Out of scope** — explicit non-goals we will not build.

For the historical record of how Grove got here, see the [original Wave 0 → Wave 5 plan](https://github.com/tortuvshin/grove/blob/main/docs/roadmap.md) on GitHub. This page replaces it.

---

## Shipped — v0.3.0 (2026-06-11)

The first version of Grove that is ready to be picked up by a community. A
real production space — [Open Apps](https://open-apps.dev.mn) — already
runs on it.

### Packages

Five packages on npm under the `@grove-dev/*` scope. Two more packages
(`@grove-dev/svelte`, `@grove-dev/nextjs`) are published as **skeletons**
to reserve their import paths; they do not yet scaffold usable spaces.

| Package                | Version  | Role                                                                          |
| ---------------------- | -------- | ----------------------------------------------------------------------------- |
| `@grove-dev/core`      | `0.2.21` | Schema, config, importers, validators, taxonomy, sync, build pipeline        |
| `@grove-dev/ui`        | `1.0.10` | Framework-agnostic UI primitives (filter, sort, score, slug, paginate)        |
| `@grove-dev/cli`       | `0.2.20` | `grove new`, `import`, `validate`, `generate`, `sync github`, `sitemap`, …    |
| `@grove-dev/astro`     | `0.2.20` | The V1 renderer — 22 components, 1 layout, tokens, default template           |
| `@grove-dev/starlight` | `0.2.20` | Documentation site plugin (this site)                                         |

### Frameworks

| Framework    | Status           |
| ------------ | ---------------- |
| Astro        | V1 supported     |
| SvelteKit    | Skeleton only — see [adapters/svelte](/adapters/svelte/) |
| Next.js      | Skeleton only — see [adapters/nextjs](/adapters/nextjs/) |

The V1 CLI refuses `--framework svelte` and `--framework nextjs` at scaffold time.

### Blueprints

A blueprint binds a `kind` to a schema, a default route, and the filters a space exposes. Records are a discriminated `Resource` union.

| Blueprint           | `kind`     | Data | Polished default pages |
| ------------------- | ---------- | :--: | :--: |
| `project-directory` | `project`  | ✅   | ✅   |
| `resource-hub`      | `resource` | ✅   | ❌ (V1.1) |
| `ecosystem-map`     | `entity`   | ✅   | ❌ (V1.1) |

`project-directory` is the V1 default and the one the rendered template ships pages for today. The other two ship **data flow** in V1 (records validate and build), but the polished `/resources/<slug>` and `/entities/<slug>` pages land in V1.1.

### CLI commands

All thirteen commands live in `@grove-dev/cli`:

```
grove new <name>                # Interactive scaffold (name, framework, deploy, blueprint)
grove import <awesome-list-url> # Turn a Markdown list into data/records/*.yml
grove validate                  # Strict per-record validation
grove generate                  # Build data/generated/records.{full,index}.json
grove sync github               # Refresh activity, releases, topics, archive signals
grove cleanup stale --report    # Flag records that need human review
grove sitemap                   # Emit public/sitemap.xml
grove llms                      # Emit public/llms.txt and llms-full.txt
grove workflows sync            # Sync GitHub Actions templates into the space
grove build                     # Framework-aware build (today: astro build)
grove dev                       # Framework-aware dev server (today: astro dev)
```

`grove run` is the dev-internal command for working on Grove itself; it is hidden from `--help` in published builds.

### Generated outputs

Every `grove build` produces:

- `dist/` — static HTML for every record, blueprint index, and about page
- `public/sitemap.xml` and `public/robots.txt` — search-engine surface
- `public/llms.txt` and `public/llms-full.txt` — AI-readable surface
- `public/records.json` — full record set for other tools
- `.github/workflows/*.yml` — validate, build, deploy, sync, cleanup workflows

### What is **not** in v0.3.0

- A working `--framework svelte` or `--framework nextjs` scaffold
- Polished list/detail pages for `resource-hub` or `ecosystem-map` blueprints
- A registry, federation, or any cross-space aggregation
- A hosted Grove SaaS, database, CMS, or admin dashboard
- Auth, paywalls, or private-space support

---

## Next release — V1.1

Scope is set. Dates are not — V1.1 cuts when the items below are ready, not before.

### Polished `resource-hub` pages

The `resource-hub` blueprint validates and builds in V1; V1.1 adds the
default `/resources/<slug>` list and detail pages that mirror what
`project-directory` ships today. Same components, same lenses, same
score bars — re-used from `@grove-dev/ui`.

### Polished `ecosystem-map` pages

Same treatment as `resource-hub`: `/entities/<slug>` list and detail
pages, with the entity-shaped fields (`type`, `founded`, `location`,
`members`, `parent`) surfaced in the UI.

### Working SvelteKit adapter

`@grove-dev/svelte` graduates from skeleton to usable. The
`--framework svelte` scaffold goes from "rejected at scaffold time" to
"produces a working SvelteKit site that builds with `pnpm build`".
The adapter uses the same `@grove-dev/ui` primitives as Astro, so the
blueprint-aware list and detail pages stay consistent across renderers.

### Real `sync contributors` command

V1 ships `grove sync github`. V1.1 replaces the stub
`sync contributors` with an actual implementation that reads
contributor data from the configured source(s) and writes it to the
contributors field on each affected record.

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

### Health signals as a first-class surface

Curator-assigned `scores:` blocks become visible in the default UI (already supported by `@grove-dev/ui`). Health statuses (`active`, `mature`, `stale`, `inactive`, `archived`, `unknown`, `needs_review`, `historical`) become filter facets in the default `RefinePanel`.

### Federation (only if asked)

A space can import resources from another space (read-only). A "Grove network" view aggregates featured resources from many spaces. No central write authority — each space keeps its own source of truth.

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
- **Open a PR** with a focused change. The V1 release shipped in under three weeks of focused work; focused changes land faster.
- **Read the audit.** The internal post-launch audit (linked from the repo) catalogues verified issues, deferred items, and breaking changes that would be needed for V1.1+. It is the working backlog.
