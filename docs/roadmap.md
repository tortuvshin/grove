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

### 1.1 Resource model generalization

- Replace the GitHub-first `AppRecord` with a generic `Resource` schema.
- `name`, `description`, `type`, `url`, `repository?`, `topics[]`, `tags[]`, `status?`, `maintainers[]`, `organizations[]`, `metadata`.
- `repository` is optional; spaces that do not have a GitHub repo skip signal sync.
- `ResourceType` is a string union that spaces extend via taxonomy.

### 1.2 Framework split

- `@grove-dev/core` — schemas, config, importers, validators, taxonomy, build pipeline, sitemap, llms.txt. **No Astro/React/Svelte dependencies.**
- `@grove-dev/ui` — framework-agnostic primitives: filterRecords, sortRecords, paginateRecords, buildDirectoryStats, scoreTier, slugForCategory, etc. **No framework dependencies.**
- `@grove-dev/astro` — Astro components, layouts, tokens, Astro integrations, **and** a `templates/default/` directory. Templates contain only pages, layouts, public assets, `astro.config.mjs`, `tailwind.config.mjs`, and `.github/`. No `lib/`, no business logic.
- `@grove-dev/nextjs` and `@grove-dev/svelte` — same shape, scaffolded but not yet battle-tested.
- `@grove-dev/cli` — `new` (scaffolds from any framework adapter's template), `import`, `analyze`, `validate`, `build-data`, `sitemap`, `build-llms-full`, `review`, `build`, `dev`. **No framework dependencies** in the CLI itself; framework commands are detected from the project's `package.json` and spawned.

### 1.3 Theme/template hygiene

- `packages/astro/templates/default/` is the canonical starting point. It contains pages, layouts, public assets, `astro.config.mjs`, `tailwind.config.mjs`, and a placeholder `data/` tree.
- All filter / sort / score / facet logic is imported from `@grove-dev/ui`, not re-implemented in the template.
- The `template/` (singular) legacy directory is removed; only `templates/default/` remains.

### 1.4 Documentation

- `README.md` rewritten to match the vision. Hero says "Grow useful community knowledge." Open Apps is one of several example spaces.
- `docs/vision.md` (this file) committed.
- `docs/roadmap.md` (this file) committed.
- `docs/ARCHITECTURE.md` updated to describe the core / ui / adapter / template split.

**Wave 1 exit criteria:** `pnpm -r build` is green. `grove new` scaffolds a working space from `@grove-dev/astro/templates/default` with no `workspace:*` deps in the generated `package.json`. The README reads as a community knowledge framework, not an OSS directory.

---

## Wave 2 — The first real space

> Goal: **one** Grove-powered space ships in production. Everything else is roadmap.

We pick the one that most clearly proves the vision. Candidates:

1. **Open Apps** — already has data, already has community signal, already validates the file-based model.
2. **oss.dev.mn** — local open-source ecosystem; tightest expression of "growing community knowledge"; the strongest narrative.
3. A new space — riskier, but if neither Open Apps nor oss.dev.mn has a champion, build a small one first.

The choice is a community decision, not an architecture decision. Whatever space ships first becomes the **reference space** for everything after.

### 2.1 Pick a reference space and migrate

- Pick the space, name the gardener, open the repo.
- Migrate from the old `apps.yml` model to the generic `Resource` model.
- Re-author the data files to match the new schema.
- Build the static site, deploy it, point a real domain at it.

### 2.2 Hardening the generic model

The first real space will surface things the generic model cannot yet express. We extend the schema to accommodate it, not the other way around. Common likely additions:

- A canonical "kind" of resource per space (`type: "open-source-project" | "tool" | "learning-resource" | "company" | ...`).
- A `language` field for spaces that filter by programming language.
- A `platforms` field for cross-platform OSS spaces.
- A `license` field that is independent of `repository.license`.

Each addition is a real-space-driven decision, not a hypothetical.

### 2.3 Contribution workflow

- A submission issue template that mirrors the resource schema fields.
- A bot or GitHub Action that turns submissions into PRs against `data/resources/*.yml`.
- A docs page that explains the workflow to a first-time contributor.

**Wave 2 exit criteria:** a real space, on a real domain, with real contributions landing via PR. The README's "Spaces built with Grove" list has its first entry.

---

## Wave 3 — Multiple spaces, one engine

> Goal: at least three spaces in production, all on the same core / ui / adapter stack with no duplicated logic.

### 3.1 Second space

- A second community adopts Grove.
- We rebuild the second space from the framework template, not by forking the first space.
- Divergences in branding and data shape are handled via space-level overrides, not by patching `core` or `ui`.

### 3.2 Adapter parity

- `@grove-dev/nextjs` ships a working template.
- `@grove-dev/svelte` ships a working template.
- Each template contains the same set of pages and the same contribution workflow.

### 3.3 Spaces dashboard (read-only)

- A static page that lists every known Grove space.
- Each space reports its URL and a one-line description via a simple JSON file in its repo.
- No central database, no scraping, no auth — just curated links.

**Wave 3 exit criteria:** two more spaces live, all on the same engine, no copy-pasted logic between them. A first-time contributor can fork a template and ship a new space in a weekend.

---

## Wave 4 — Maintenance signals (optional enhancement layer)

> Status: optional in MVP. Becomes real when spaces need it.

This is the GitHub signal sync that exists today. It is a value-add, not the core identity. We re-introduce it carefully:

- Signal sync lives entirely in `@grove-dev/core` as an opt-in command (`grove analyze`).
- Spaces without GitHub repos skip it. Spaces with mixed resources sync only the ones that have a `repository`.
- Health signals (`active`, `mature`, `stale`, `inactive`, `archived`, `unknown`, `needs_review`, `historical`) are stored in `data/health.yml` and are never the source of truth — `data/decisions.yml` is.

### 4.1 Scoring

- Optional `scores: { activity, maturity, learning, contribution, docs, overall }` per resource.
- Curator-assigned, not algorithmically generated, by default. The framework stores and surfaces them; the gardener decides what they mean.

### 4.2 AI-assisted curation (gated)

- Optional CLI pass that suggests topics, tags, and descriptions for uncurated resources.
- Always a suggestion, never a write. Humans approve.

**Wave 4 exit criteria:** at least one space uses signal sync productively, and the gardeners confirm it makes curation easier, not noisier.

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
