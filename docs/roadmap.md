# Roadmap

> Implementation order, not a wishlist. Every step must end with something a community can use.

## How to read this

The roadmap is grouped into **waves**. Each wave is a shippable milestone. A wave is "done" when:

- A real Grove-powered space runs on it end to end, **OR**
- The framework's internal architecture is in the shape the next wave needs.

We are not optimizing for feature count. We are optimizing for **identity lock-in**: every wave should make Grove more clearly a *community knowledge framework* and less of an *OSS directory tool*.

---

## Wave 0 — Framework foundation (done)

> Status: complete. See `docs/MILESTONES.md` for the historical record.

- pnpm workspace, `packages/core`, `packages/ui`, `packages/cli`, `packages/astro`.
- Generic Zod resource schema.
- Markdown awesome-list importer.
- `data/apps/*.yml` model.
- Astro components, layouts, tokens, default template.
- `init` / `import` / `analyze` / `validate` / `build-data` / `build-llms-full` / `review` / `build` / `preview`.

This wave is what is in `main` today. The waves below reorganize and extend it.

---

## Wave 1 — Identity & architecture lock

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
  a `type` and a `topic`. **MVP in V1, full implementation in
  Wave 2.**
- **`ecosystem-map`** → `kind: entity`. Organizations, products,
  people, communities, schools, services, ecosystem actors.
  Has a `type` (company / community / school / ...) and
  optional `founded` / `location` / `members`. **MVP in V1,
  full implementation in Wave 2.**

The `kind` field is required and must match the blueprint
configured in `grove.config.ts`. A site running
`project-directory` rejects records with `kind: resource` or
`kind: entity` at validation time.

**No custom blueprint API in V1.** If a real space needs fields
the V1 schemas don't carry, Wave 2 will extend the union — not
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

### 1.3 Framework split

- `@grove-dev/core` — schemas, config, importers, validators,
  taxonomy, build pipeline, sitemap, llms.txt. **No
  Astro/React/Svelte dependencies.**
- `@grove-dev/ui` — **roadmap only in V1.** The V0 primitives
  (`filterRecords`, `sortRecords`, `paginateRecords`,
  `scoreTier`, ...) all hang off the flat `CuratedItem` type
  and cannot carry over to the discriminated `Resource`
  union. V1 ships a stub that re-exports the new types and
  an identity helper. Wave 2 rebuilds the primitives on top
  of `Resource`.
- `@grove-dev/astro` — V1 renderer. Components, layouts,
  tokens, `templates/default/`. Templates contain only pages,
  layouts, public assets, `astro.config.mjs`, and `.github/`.
  No `lib/`, no business logic.
- `@grove-dev/nextjs` and `@grove-dev/svelte` — roadmap only
  in V1. Skeleton packages; the full implementation waits for
  Wave 2 when the framework-agnostic core/ui primitives are
  rebuilt on top of `Resource`.
- `@grove-dev/cli` — `new` (scaffolds from any framework
  adapter's template), `import`, `validate`, `generate`,
  `sitemap`, `llms`, `sync github`, `cleanup stale`, `build`,
  `dev`. **No framework dependencies** in the CLI itself;
  framework commands are detected from the project's
  `package.json` and spawned.

### 1.4 Theme/template hygiene

- `packages/astro/templates/default/` is the canonical
  starting point. It contains pages, layouts, public assets,
  `astro.config.mjs`, `tailwind.config.mjs`, and a placeholder
  `data/` tree.
- All filter / sort / score / facet logic lives in
  `@grove-dev/core` or `@grove-dev/ui`. V1 ships a minimal
  template without the V0 page-fragment richness (lenses,
  faceted filters, score bars, distribution channels, monthly
  commit activity). The schema still carries the data, so
  rebuilding the components is a Wave 2 task.
- The `template/` (singular) legacy directory is removed; only
  `templates/default/` remains.

### 1.5 Documentation

- `README.md` rewritten to match the vision. Hero says "Grow
  useful community knowledge." Open Apps is one of several
  example spaces.
- `docs/vision.md` committed.
- `docs/roadmap.md` (this file) committed.
- `docs/ARCHITECTURE.md` updated to describe the
  core / ui / adapter / template split and the blueprint
  model.

**Wave 1 exit criteria:** `pnpm -r build` is green. `grove new`
scaffolds a working space from
`@grove-dev/astro/templates/default` with `workspace:*` deps in
the generated `package.json`. The README reads as a community
knowledge framework, not an OSS directory. `grove validate`,
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
2. **oss.dev.mn** — `ecosystem-map` blueprint. Local
   open-source ecosystem; tightest expression of "growing
   community knowledge"; the strongest narrative. The
   `entity` kind carries the most schema (founded / location
   / members / parent), so a real ecosystem map exercises the
   union more than a project directory.
3. A new space — riskier, but if neither Open Apps nor
   oss.dev.mn has a champion, build a small one first.

The choice is a community decision, not an architecture
decision. Whatever space ships first becomes the **reference
space** for everything after, and its blueprint is the one we
nail down first.

### 2.1 Pick a reference space and migrate

- Pick the space, name the gardener, open the repo.
- Pick the matching blueprint (`project-directory` for Open
  Apps, `ecosystem-map` for oss.dev.mn).
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

- `@grove-dev/nextjs` ships a working template that
  understands the V1 `Resource` union and renders each
  blueprint's kind.
- `@grove-dev/svelte` ships the same.
- Each template contains the same set of pages and the same
  contribution workflow.

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
  have a `links.github`. Spaces running `resource-hub` or
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
  already carries the block; the V1 UI just doesn't surface
  it. Wave 4 turns on the surface.
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
