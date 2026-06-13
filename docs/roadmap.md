# Roadmap

> Implementation order, not a wishlist. Every step must end with something a community can use.

## How to read this

The roadmap is grouped into **waves**. Each wave is a shippable milestone. A wave is "done" when:

- A real Grove-powered space runs on it end to end, **OR**
- The framework's internal architecture is in the shape the next wave needs.

We are not optimizing for feature count. We are optimizing for **identity lock-in**: every wave should make Grove more clearly a *community knowledge framework* and less of an *OSS directory tool*.

The roadmap below is **the original Wave 0 → Wave 5 plan** as it was written. Waves 0 and 1 are **done** as of V1; the rest is forward-looking. The V1 status section in the [homepage](/) and the [adapters docs](/adapters/astro/) reflect what is shipping right now, not the roadmap narrative.

---

## Wave 0 — Framework foundation (done)

> Status: complete. See `docs/MILESTONES.md` for the historical record.

- pnpm workspace, `packages/core`, `packages/ui`, `packages/cli`, `packages/astro`.
- Generic Zod resource schema (now the V1 discriminated `Resource` union with `ProjectRecord`, `ResourceRecord`, `EntityRecord`).
- Markdown awesome-list importer (`parseAwesomeMarkdown` in `@grove-dev/core/importer`).
- `data/records/<slug>.yml` model (V1 file layout — V0 used `data/apps/*.yml`).
- Astro components, layouts, tokens, default template.
- CLI: `new` / `import` / `validate` / `generate` / `sitemap` / `llms` / `sync github` / `cleanup stale` / `workflows sync` / `build` / `dev`. (V0 names `analyze`, `enrich`, `build-data`, `build-llms-full`, `review`, `preview` have been replaced with the V1 names above.)

This wave is what is in `main` today. The waves below reorganize and extend it.

---

## Wave 1 — Identity & architecture lock (done)

> Goal: the codebase reflects the vision. `core` is framework-free. `ui` is framework-free. Framework adapters are thin. Templates contain only pages, layouts, and `.github/`. No business logic in templates.

### 1.1 Blueprint model (V1)

Grove V1 ships three fixed blueprints. Each blueprint binds a
record `kind` to a schema, a default route, and the filters a
space exposes. Records are a discriminated union keyed by `kind`:

- **`project-directory`** → `kind: project`. Structured
  collections of projects, tools, apps, packages, services,
  repositories, or internal systems. GitHub metadata is
  optional. **Built first, fully reusable.**
- **`resource-hub`** → `kind: resource`. Guides, comparisons,
  explainers, links, and practical knowledge collections. Has
  a `type` and a `topic`. **MVP in V1 (data flows through
  `grove generate`); polished default pages land in V1.1.**
- **`ecosystem-map`** → `kind: entity`. Organizations, products,
  people, communities, schools, services, ecosystem actors.
  Has a `type` (company / community / school / ...) and
  optional `founded` / `location` / `members`. **MVP in V1
  (data flows through `grove generate`); polished default pages
  land in V1.1.**

The `kind` field is required and must match the blueprint
configured in `grove.config.ts`. A site running
`project-directory` rejects records with `kind: resource` or
`kind: entity` at validation time.

**No custom blueprint API in V1.** If a real space needs fields
the V1 schemas don't carry, V1.1 will extend the union — not
the per-site API.

### 1.2 Resource schema (under the blueprints)

- Generic `Resource` discriminated union with three concrete
  shapes: `ProjectRecord`, `ResourceRecord`, `EntityRecord`.
- Common base: `slug`, `description`, `category`, `tags[]`,
  `links{ github?, website?, docs?, source? }`, optional
  `content:` (path to a Markdown body), `source:` (provenance
  block), `curation:` (human-curation block), `scores:`.
- Per-kind extensions: `ProjectRecord` carries `stack` /
  `platforms` / `projectType` / GitHub-shaped `github:` block;
  `ResourceRecord` carries `type` / `topic` / `related`; the
  `EntityRecord` carries `type` / `founded` / `location` /
  `members` / `parent`.

### 1.3 Framework split (done)

- `@grove-dev/core` — schemas, config, importers, validators,
  taxonomy, build pipeline, sitemap, llms.txt. **No
  Astro/React/Svelte dependencies.**
- `@grove-dev/ui` — **shipped in V1.** 5 typed primitive modules
  over the `IndexRecord` discriminated union:
  `filterRecords`, `sortRecords`, `paginateRecords`,
  `scoreRecords`, `format`. Re-exported by every adapter.
- `@grove-dev/astro` — V1 renderer. 22 components, 1 layout,
  tokens, `templates/default/`. Templates contain only pages,
  layouts, public assets, `astro.config.mjs`, scripts, and
  `.github/`. No business logic.
- `@grove-dev/nextjs` and `@grove-dev/svelte` — skeleton
  packages; the V1 CLI **refuses** `--framework nextjs` and
  `--framework svelte` at scaffold time. SvelteKit lands in
  V1.1, Next.js in V1.2.
- `@grove-dev/cli` — `new` (scaffolds from any framework
  adapter's template), `import`, `validate`, `generate`,
  `sitemap`, `llms`, `sync github`, `sync contributors`
  (stub in V1), `cleanup stale`, `workflows sync`, `build`,
  `dev`. **No framework dependencies** in the CLI itself;
  framework commands are detected from the project's
  `package.json` and spawned.

### 1.4 Naming conventions (V0→V1 migration)

The V0-published Astro package exposed several names that the
V1 release standardises on `record` / `IndexRecord` instead of
`item` / `app` / `App`. The renames are:

| V0 name (deprecated) | V1 canonical name | Where |
|---|---|---|
| `AppsIndexRow.astro` | `IndexRow.astro` | `@grove-dev/astro/components` |
| `AppsPagination.astro` | `Pagination.astro` | `@grove-dev/astro/components` |
| `ItemSection` (component) | `RecordSection` | `@grove-dev/astro/components` |
| `ItemsFilters` (type) | `IndexFilters` | `@grove-dev/astro` |
| `ItemsSort` (type) | `IndexSort` | `@grove-dev/astro` |
| `AppsFilters` / `AppsSort` (type aliases) | removed | (use `IndexFilters` / `IndexSort`) |
| `filterItems` (function) | `filterRecords` | `@grove-dev/astro` |
| `filterApps` (alias) | removed | (use `filterRecords`) |
| `[itemSlug].astro` (file name) | `[recordSlug].astro` | Astro template pages |
| `data-item-slug` / `dataset.itemSlug` | `data-record-slug` / `dataset.recordSlug` | client-side |
| `itemSlug()` (config helper) | `recordSlugConfig()` | Astro template `data/records.ts` |
| `itemSlug` (config field, deprecated) | `recordSlug` (canonical) | `grove.config.ts` blueprint config |

The V0-published Astro template exposed `/apps/<slug>` as a
static alias for the openapps-style directory. The V1 template
uses the blueprint-aware dynamic route `/<blueprint>/<record-slug>`
(e.g. `/projects/coolify`). The `apps/[recordSlug].astro` page
is a 301 redirect so any existing `/apps/<slug>` bookmarks keep
working.

`ItemCard.astro` is **kept as the V1 published name** for
downstream stability — it appears in user docs and downstream
sites' imports. The component is the V1 record card; the
name is a deliberate exception to the V0→V1 rename.

### 1.5 Theme/template hygiene

- `packages/astro/templates/default/` is the canonical
  starting point. It contains pages, layouts, public assets
  (icons, `llms.txt`, `robots.txt`, `og-image.svg`),
  `astro.config.mjs`, `data/`, `scripts/`, and `.github/`.
- All filter / sort / score / facet logic lives in
  `@grove-dev/core` or `@grove-dev/ui`. The V1 template ships
  the full UI surface — lenses, faceted filters, score bars,
  distribution channels, monthly commit activity — re-using
  the `@grove-dev/ui` primitives.
- Plain CSS + design tokens (no Tailwind required) is the
  default; Tailwind 4 is supported as an opt-in.

### 1.6 Documentation

- `README.md` rewritten to match the vision. Hero says "Grow
  useful community knowledge." Open Apps is one of several
  example spaces.
- `docs/vision.md` committed.
- `docs/roadmap.md` (this file) committed.
- `docs/ARCHITECTURE.md` updated to describe the
  core / ui / adapter / template split and the blueprint
  model.
- All `@grove-dev/*` package READMEs updated to reflect V1
  public APIs (no more V0 names like `defineGroveConfig`,
  `curatedConfigSchema`, `buildData`, `buildSitemap`,
  `buildLlmsFiles`, `fetchGithubMetadata`, `enrichFromGithubHtml`,
  `ghFetch`, `pLimit`, `validateProject`).

**Wave 1 exit criteria (met):** `pnpm -r build` is green. `grove new`
scaffolds a working space from
`@grove-dev/astro/templates/default` in ~25 seconds end-to-end
(`grove new` + `pnpm install` + `pnpm build` + `pnpm dev` +
11-endpoint curl). The README reads as a community knowledge
framework, not an OSS directory. `grove validate`,
`grove generate`, `grove sync github`, `grove cleanup stale`
all work end-to-end against `data/records/*.yml`.

---

## Wave 2 — The first real space

> Goal: **one** Grove-powered space ships in production. Everything else is roadmap.

The first space is also where the blueprint model gets
exercised in the wild. We pick the one that most clearly
proves the vision, and the one whose blueprint best stresses
the discriminated `Resource` union:

1. **Open Apps** — `project-directory` blueprint. Already has
   data, already has community signal, already validates the
   file-based model. **Likely reference space.**
2. A new space — riskier, but if Open Apps has no champion,
   build a small one first.

The choice is a community decision, not an architecture
decision. Whatever space ships first becomes the **reference
space** for everything after, and its blueprint is the one we
nail down first.

### 2.1 Pick a reference space and migrate

- Pick the space, name the gardener, open the repo.
- Pick the matching blueprint (`project-directory` for Open
  Apps, `ecosystem-map` for an entity-style space).
- Migrate from the old `apps.yml` / `items.yml` model to
  `data/records/<slug>.yml` with the blueprint's `kind` on
  every record.
- Re-author the data files to match the new schema. Records
  that don't fit the chosen blueprint are split into their
  own space, not crammed into one blueprint's kind.
- Build the static site, deploy it, point a real domain at
  it.

### 2.2 Hardening the blueprint

The first real space will surface things the V1 schema
cannot yet express. We extend the union to accommodate it,
not the other way around. Common likely additions:

- A `language` field for spaces that filter by programming
  language.
- A canonical `kind`-specific extension when one blueprint
  consistently needs the same extra field.
- A `meta:` block for one-off annotations that don't deserve
  a schema slot.

Each addition is a real-space-driven decision, not a
hypothetical. We do not add fields "in case".

### 2.3 Contribution workflow

- A submission issue template that mirrors the resource
  schema fields for the chosen blueprint.
- A bot or GitHub Action that turns submissions into PRs
  against `data/records/*.yml`.
- A docs page that explains the workflow to a first-time
  contributor.

### 2.4 Polished `resource-hub` and `ecosystem-map` templates

The V1 default Astro template ships polished pages only for
`project-directory`. V2.1 lands polished list and detail pages
for `resource-hub` (`/resources/<slug>`) and `ecosystem-map`
(`/entities/<slug>`) — the data already flows through
`grove generate` correctly; only the page chrome is missing.

**Wave 2 exit criteria:** a real space, on a real domain,
with real contributions landing via PR. The README's
"Spaces built with Grove" list has its first entry.

---

## Wave 3 — Multiple spaces, multiple blueprints

> Goal: at least three spaces in production across at least
> two blueprints, all on the same core / adapter stack with
> no duplicated logic.

### 3.1 Second space

- A second community adopts Grove, on a different blueprint
  than the first.
- We rebuild the second space from the framework template,
  not by forking the first.
- Divergences in branding and data shape are handled via
  space-level overrides, not by patching `core` or the
  adapters.

### 3.2 Adapter parity

- **`@grove-dev/svelte`** (V1.1) — ships a working SvelteKit
  template that re-uses `@grove-dev/ui` primitives and
  understands the V1 `Resource` union. Renders each
  blueprint's kind.
- **`@grove-dev/nextjs`** (V1.2) — ships the same for Next.js
  App Router.
- Each adapter's template contains the same set of pages and
  the same contribution workflow.

### 3.3 Spaces dashboard (read-only)

- A static page that lists every known Grove space.
- Each space reports its URL, blueprint, and a one-line
  description via a simple JSON file in its repo.
- No central database, no scraping, no auth — just curated
  links.

**Wave 3 exit criteria:** two more spaces live, all on the
same engine, no copy-pasted logic between them. A
first-time contributor can fork a template, pick a
blueprint, and ship a new space in a weekend.

---

## Wave 4 — Maintenance signals (optional enhancement layer)

> Status: optional in MVP. Becomes real when spaces need it.

This is the GitHub signal sync that exists today. It is a
value-add, not the core identity. We re-introduce it
carefully:

- Signal sync lives entirely in `@grove-dev/core` as an
  opt-in command (`grove sync github`).
- **Blueprint-aware**: spaces running `project-directory` can
  sync GitHub metadata for `kind: project` records that
  have a `repoUrl`. Spaces running `resource-hub` or
  `ecosystem-map` skip signal sync — the V1 schemas for
  those kinds don't carry a `github:` block. The CLI exits
  early with a friendly message if a space's blueprint has
  no GitHub-shaped records.
- Health signals (`active`, `mature`, `stale`, `inactive`,
  `archived`, `unknown`, `needs_review`, `historical`) live
  on each record's `health:` block. `data/decisions.yml` is
  still the human curation layer.

### 4.1 Scoring

- Optional `scores: { activity, maturity, learning,
  contribution, docs, overall }` per record. The V1 schema
  already carries the block; the V1 UI surfaces it via the
  `scoreRecords` primitive in `@grove-dev/ui`.
- Curator-assigned, not algorithmically generated, by
  default. The framework stores and surfaces them; the
  gardener decides what they mean.

### 4.2 AI-assisted curation (gated)

- Optional CLI pass that suggests topics, tags, and
  descriptions for uncurated records.
- Always a suggestion, never a write. Humans approve.

**Wave 4 exit criteria:** at least one space uses signal
sync productively, and the gardeners confirm it makes
curation easier, not noisier.

---

## Wave 5 — Federation (later, only if asked)

> Status: do not build this unless spaces need it.

- A space can import resources from another space (read-only).
- A "Grove network" view aggregates featured resources from many spaces.
- No central write authority. Each space keeps its own source of truth.

This is a v2+ conversation. It is not in scope for any current wave.

---

## What we will not do

These are explicit non-goals. If you find yourself wanting to add any of them, stop and ask whether they serve the vision.

- A hosted Grove SaaS. The framework repo is not a marketing site.
- A database, a CMS, an admin dashboard. Data lives in files.
- A plugin marketplace. The engine is small enough to fork.
- A real-time collaboration layer. PRs are the collaboration layer.
- Auth, paywalls, private spaces. Every space is public.
- Replacing `awesome-*` repos. Grove runs alongside them, not against them.
- Tying the data model to GitHub. GitHub is one optional signal, not the spine.

---

## Open questions

These are the questions the next two waves need to answer. They are not blockers, but the answers shape the architecture.

1. **Resource identity** — should a resource be globally addressable across spaces (`grove:resource/<hash>`) or scoped to a single space? Lean: scoped, with optional cross-space references later.
2. **Space identity** — is a space just a repo URL, or does it need a registry entry? Lean: just a repo URL for the first three waves. Registry later.
3. **Topics vs. tags** — same field, different conventions, or two distinct fields? Lean: two distinct fields. Topics are curated and finite; tags are open and free-form.
4. **Maintainers** — first-class people records with profiles, or free-form names per resource? Lean: free-form names with optional `metadata` for richer profiles later.
5. **Multi-language content** — does the engine need i18n, or is that a space-level concern? Lean: space-level. The engine stays language-neutral.

We resolve these as we ship waves 2 and 3, not before.
