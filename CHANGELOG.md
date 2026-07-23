# Changelog

All notable changes to Grove are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Grove publishes **four** packages on npm: `@grove-dev/core`,
`@grove-dev/astro`, `@grove-dev/cli`, and `@grove-dev/starlight`.
The repository also contains two private applications under `apps/`:
the canonical example/scaffold and the Starlight documentation site.

By default a version bump applies to all four packages in lockstep. The release
notes below describe the user-visible change; the affected packages are
called out in **Packages** lines.

For the developer workflow that produces these entries, see
[`apps/docs/src/content/docs/maintainers/release-process.md`](./apps/docs/src/content/docs/maintainers/release-process.md).

---

## [Unreleased]

> Working buffer. Folds into a dated `## [X.Y.Z]` heading on the next
> release.

---

## [0.3.3] — 2026-07-23

### Added

- **`@grove-dev/core` / `@grove-dev/astro`:** adds optional config-wide GA4
  analytics and config-driven default `robots.txt` and social image artifacts.
  Replacing a generated marker file transfers ownership to the consumer and
  prevents Grove from overwriting custom assets.
- **`@grove-dev/cli`:** the single Astro scaffold now includes a practical
  consumer README and MIT license.

### Changed

- **`@grove-dev/astro`:** supports Astro 6 and Astro 7, reads the canonical
  build URL directly from `grove.config.ts`, and lets directories use their own
  noun for the unfiltered browse lens.
- Removes dead scaffold content pages and the Open Apps-specific legacy route;
  initialized projects contain only the working consumer-owned pages.

### Fixed

- **`@grove-dev/astro` / `@grove-dev/core`:** custom stack and platform SVGs
  now load without a package-owned icon registry, and primary/supporting stacks
  are deduplicated consistently on cards, facets, and detail pages.
- **`@grove-dev/core`:** contributor sync paginates the GitHub API instead of
  silently stopping after the first 100 contributors.

**Packages:** `@grove-dev/core`, `@grove-dev/astro`, `@grove-dev/cli`.

---

## [0.3.2] — 2026-07-23

### Added

- **`@grove-dev/core`:** adds the browser-safe `@grove-dev/core/directory` entry point for canonical filtering, sorting, facets, display labels, pagination, and curated lens URL rules.
- **`@grove-dev/astro`:** adds reusable directory view-models and a client controller so consumer-owned pages can stay thin while keeping URL-driven discovery behavior consistent.
- **`@grove-dev/core` / `@grove-dev/astro`:** adds config-driven footer columns, submission copy, and browse/submission facets; record tags are now a first-class facet separate from controlled taxonomy.

### Changed

- **`@grove-dev/cli`:** focuses the CLI on `init`, `check`, `sync`, and `cleanup`; `grove init` now copies the single working Astro example instead of selecting templates, frameworks, or blueprints.
- **`@grove-dev/astro`:** makes generated project routes permanently consumer-owned. Grove packages own domain logic, adapters, layouts, and components without overwriting application pages during maintenance.
- Groups the private applications under `apps/example` and `apps/docs`; the example remains the only scaffold source bundled into `@grove-dev/cli`.

### Fixed

- **`@grove-dev/astro` / `@grove-dev/core`:** makes search, sort, facets, active-filter chips, and all curated lenses use one canonical filter contract in static pages. Lens links now preserve unrelated query state, active UI state hydrates from the live URL, and empty demo lenses have real curated records.
- Treats Recently added as a true sort over every record instead of a `new` label filter, keeps sort state when clearing filters, and removes the duplicate Recently added lens tab.
- Keeps selected lens and facet text readable on hover and places curated views and configured facets in one responsive toolbar row.
- Aligns directory search, sort, lens, and filter control sizing across desktop and mobile layouts.
- Improves repository statistics, contributor presentation, icon fallback behavior, submission drafting, and homepage calls to action in the canonical example.

**Packages:** `@grove-dev/core`, `@grove-dev/astro`, `@grove-dev/cli`.

---

## [0.3.1] — 2026-06-30

> **Docs-only patch.** Every change since `v0.3.0` (2026-06-11) has been
> on the documentation site (`apps/docs/`), the production-side home page,
> and transitive dev-dependency bumps. **No `@grove-dev/*` package source
> code has changed.** Framework support, blueprints, CLI commands,
> generated outputs, and schema are unchanged from `v0.3.0`.

### Fixed

- **Production-site honesty pass on the standalone `/` page.** The home page no longer advertises commands, file names, or framework support that don't exist in the code:
  - The mock terminal prompt and the "Get Started" lifecycle section no longer show fake `grove add` and `grove deploy` commands. The lifecycle now reflects the V1.0 CLI commands (`import`, `validate`, `sync github`, `generate`, `sitemap`, `llms`, `build`, `cleanup stale`, `workflows sync`) and the real default Astro workflow.
  - The mock terminal writes `grove.config.ts`, matching the file the Astro default template actually emits. (The previous mock said `grove.config.yaml`.)
  - The eight-framework logo wall is replaced with an honest "Astro today, SvelteKit / Next.js planned" status card plus the actual public package list (`@grove-dev/core`, `@grove-dev/ui`, `@grove-dev/cli`). Tailwind / Node.js / GitHub are no longer presented as framework adapters — they're tooling, not adapters.
  - The "Integrate with your favorite tools" orbital diagram is replaced with "One source, multiple outputs" (static HTML, `sitemap.xml`, `llms.txt`, `llms-full.txt`).
  - The "Why Grove" features section is reframed around the maintenance problem Grove actually solves (structure drift, stale metadata, review-as-cleanup, discovery-as-software, AI-readable fragments, maintainer-memory dependence) instead of generic capabilities.
- **JSON-LD `SearchAction` removed.** The `WebSite` block in the home page (`apps/docs/src/layouts/HomeLayout.astro`) and the global Starlight `head` config (`apps/docs/astro.config.mjs`) no longer advertise a `https://grove.dev.mn/search?q=...` target. The route never existed; emitting it was invalid structured data.
- **Roadmap page renders correctly.** The `/roadmap/` route no longer prints the raw `import { Content } from '../../../roadmap.md';` statement as visible page text. The content is now inlined as a Starlight `.md` content file, evaluated through the Starlight content layer.
- **Wrong GitHub organisation.** All references to `grove-dev/grove` in source and content are replaced with the correct `tortuvshin/grove`. `https://github.com/grove-dev/grove/...` was returning 404.
- **Lucode / lucas-labs user-visible branding.** The "Lucode" and "lucas-labs" strings in the docs site footer and four content files are replaced with "Grove Starlight". Internal `packages/starlight/` source may keep upstream names with `@deprecated` aliases for downstream stability.
- **Two broken internal links in Getting Started.** `/getting-started/add-your-first-record/` (typo) → `/getting-started/add-your-first-project/`. `/getting-started/what-is-grove/` → `/introduction/`.
- **Software version drift on the home page.** The `softwareVersion` field in the homepage JSON-LD is corrected from `0.2.x` to `0.3.0`.
- **Home and roadmap images** carry explicit `width` / `height` attributes and `loading="lazy"` to prevent layout shift and reduce initial paint cost. The home images that are decorative carry `alt=""`.
- **Home sections** are now wired to their headings via `aria-labelledby`, every CTA links to a real destination (no `href="#"` placeholders), and the main landmark carries an `id="main-content"` skip target.
- **Open-graph / Twitter metadata** is emitted on every page through the Starlight `head` config.

### Changed

- **Roadmap document rewritten.** The new `/roadmap/` page groups content by shipping status (Shipped / Next release / Later / Out of scope) instead of by wave narrative. The historical Wave 0 → Wave 5 plan is preserved as a link to the GitHub history.
- **Dep bumps:** `astro` 6.4.6 → 7.0.3, `tailwindcss` 4.3.0 → 4.3.2, `@types/node` 25.9.2 → 26.0.1.

**Packages:** none (docs-only).

---

## [0.3.0] — 2026-06-11

> **Initial public release.** The first version of Grove that is ready to
> be picked up by a community. A real production space
> ([Open Apps](https://open-apps.dev.mn)) already runs on it.

This entry folds in the V0→V1 migration that had accumulated in the
`[Unreleased]` buffer through 0.2.3–0.2.16. Per-patch entries for that
range are intentionally not reconstructed; the git history of
`CHANGELOG.md` is the working record.

### Added

- **Three V1 blueprints.** Discriminated `Resource` union keyed by `kind`:
  - `project-directory` → `kind: project` — apps, packages, tools, services, repositories, internal systems. GitHub metadata optional. **V1 default, polished default pages.**
  - `resource-hub` → `kind: resource` — guides, comparisons, explainers, links, knowledge collections. Has a `type` and a `topic`. **Data flow only in V1; polished default pages deferred.**
  - `ecosystem-map` → `kind: entity` — organizations, products, communities, schools, ecosystem actors. Has a `type` and optional `founded` / `location` / `members` / `parent`. **Data flow only in V1; polished default pages deferred.**
- The `kind` field is required and validated against the blueprint in `grove.config.ts` at validation time.
- `--deploy <provider>` writes a provider-specific config file (`vercel.json`, `netlify.toml`, `wrangler.jsonc`, or a GitHub Pages workflow) plus a matching `.github/workflows/deploy-<provider>.yml`. The `none` value writes no deploy workflow.
- Project configuration: `.editorconfig`, `.prettierrc.json`, `.prettierignore`.
- `.github/` directory: issue templates (bug, feature, docs, question), pull request template, `FUNDING.yml`, `dependabot.yml`, `SUPPORT.md`.
- CI workflows: `ci.yml` (build, type-check, scaffold smoke test, repo hygiene checks) and `audit.yml` (weekly `pnpm audit`).
- Root `CHANGELOG.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `LICENSE` (MIT).
- `apps/docs/src/content/docs/maintainers/release-process.md` and `apps/docs/src/content/docs/maintainers/security.md` to round out the contributor-facing documentation.
- Dependabot configured to ignore `@grove-dev/*` workspace deps (the release script owns those rewrites).
- The Astro default template ships **22 components** (`Hero`, `ItemCard`, `IndexRow`, `Pagination`, `RecordSection`, `RefinePanel`, `ScoreBars`, `SmartLensTabs`, `ExploreByCategory`, `ExploreByStack`, `WhyThisExists`, `CurationGrid`, `ContributorsGrid`, `StackGrid`, `Icon`, `MinimalAbout`, `OriginalCollection`, `DecisionRow`, `FilterGroupMenu`, `FilterOptions`, `CategoryGrid`) and **one layout** (`BaseLayout`).
- 11 GitHub Actions workflows generated by `grove new --github public` mode (validate, build, deploy, sync-github-metadata, sync-contributors stub, cleanup-stale-records, update-records, …).
- `llms.txt` and `llms-full.txt` generated at build time (via `grove llms`).
- `sitemap.xml` generated at build time (via `grove sitemap`).

### Changed

- **V0→V1 naming migration.** Internal component and type names aligned with the V1 `record` / `IndexRecord` / `Resource` convention. The V0-published Astro package's `ItemCard` name is **retained** for downstream stability; all other V0→V1 renames are listed below. V0 `/apps/<slug>` URLs resolve via a static 301 redirect generated by the Astro template.
  - `@grove-dev/astro`: `AppsIndexRow.astro` → `IndexRow.astro`; `AppsPagination.astro` → `Pagination.astro`; `ItemSection` → `RecordSection`.
  - `@grove-dev/astro`: `ItemsFilters` → `IndexFilters`; `ItemsSort` → `IndexSort`; `AppsFilters` / `AppsSort` (type aliases) **removed**; `filterItems` → `filterRecords`; `filterApps` (alias) **removed**.
  - `@grove-dev/astro`: dynamic route files renamed from `[itemSlug].astro` to `[recordSlug].astro`; client-side `data-item-slug` / `dataset.itemSlug` → `data-record-slug` / `dataset.recordSlug`.
  - `@grove-dev/astro/templates/default`: `itemSlug()` → `recordSlugConfig()`; config field `itemSlug` (deprecated) → `recordSlug` (canonical, `itemSlug` kept for V0 backwards-compat).
  - `@grove-dev/core`: `curatedConfigSchema` → `blueprintSchema`; `defineGroveConfig` → `defineConfig`; `resourceSchema` (single) → `projectRecordSchema` / `resourceRecordSchema` / `entityRecordSchema` (split per `kind`); `itemsFileSchema` **removed**; `buildData` → `generate` (library form); `buildLlmsFiles` → `buildLlmsTxt` + `buildLlmsFullTxt` (split into two functions); `pickReviewCandidates` → `pickCleanupCandidates`; `buildReviewReport` **removed**; `parseAppYaml` / `normalizeAppRecord` / `toIndexApp` **removed**; `validateProject` / `validateAppRecord` **removed** (validation is part of `generate`); `ghFetch` / `pLimit` are now **internal** to `github-client.ts`, not part of the V1 public surface.
  - `@grove-dev/ui`: V0 `0.0.0-roadmap` stub replaced with V1 `1.0.x` — 5 typed modules over `IndexRecord`: `filterRecords`, `sortRecords`, `paginateRecords`, `scoreRecords`, `format`. Adapter barrels re-export the same primitives.
  - Astro template URL convention: canonical V1 detail URL is `/<blueprint>/<record-slug>` (e.g. `/projects/coolify`).
- `@grove-dev/cli`: `--framework` now refuses `nextjs` and `svelte` with a clear error (V1 supports `astro` only; `nextjs` lands in V1.2, `svelte` in V1.1).
- `@grove-dev/cli`: V1 scaffolds **Astro** projects only.
- `packages/nextjs/templates/default/package.json` and `packages/svelte/templates/default/package.json` rewritten to use V1 CLI commands.
- `scripts/test-scaffold.mjs` tests the Astro scaffold path only.
- All seven `@grove-dev/*` packages are now published with consistent metadata (`homepage`, `repository`, `bugs`, `publishConfig`).

### Removed

- `--framework nextjs` and `--framework svelte` from `@grove-dev/cli`. The `Framework` union is now `"astro"` only. The Next.js and SvelteKit adapter packages still exist (no source files changed) but their templates are skeleton-only and do not scaffold a runnable project. They return as scaffold options in V1.1 (SvelteKit) and V1.2 (Next.js).
- The `nextjs` and `svelte` branches in `FRAMEWORK_LABELS`, the framework select prompt, and the help text for `grove new` / `grove run`. The `detectFramework()` / `frameworkBuildCommand()` / `frameworkDevCommand()` helpers no longer have a non-astro branch.

### Fixed

- `grove new --framework nextjs` no longer silently produces a half-populated project. It exits with `Unknown framework: nextjs` and a hint to use `astro` (or wait for the relevant release).
- `scripts/test-scaffold.mjs` no longer attempts to scaffold `nextjs` / `svelte` projects. It is an Astro-only smoke test.
- Scaffold step now rewrites `workspace:*` deps only at publish time, avoiding the "404 on a version that doesn't exist yet" install failure.
- Layout-level tokens for container widths now align with Starlight's design system.
- Resolved the import path of Starlight's reset / util styles so the build no longer relies on a fragile `node_modules` lookup.

### Migration

- **Source code:** search-and-replace V0 names with the V1 canonical names in any custom Astro template that imports from `@grove-dev/astro`. See the table above.
- **URLs:** existing `/apps/<slug>` links continue to work via 301 redirect to `/projects/<slug>`. No action required.
- **Data:** records remain in `data/records/<slug>.yml` (no data migration needed). The V0 `data/apps/*.yml` layout is gone.
- **Config:** `grove.config.ts` shape is unchanged. The `blueprintConfig.itemSlug` field is kept as an alias of the V1 canonical `recordSlug` for backwards-compat.

**Packages:** all seven (with `@grove-dev/starlight` and `@grove-dev/nextjs` / `@grove-dev/svelte` published as skeleton-only at `0.2.20`).

---

## [0.2.2] — 2025-06-10

### Added
- Removal of the deprecated landing and showcase pages; the
  `@grove-dev/starlight` theme now serves as the docs site shell.
- `@grove-dev/astro` ships the V1 components, layouts, design tokens,
  and default template. Next.js and SvelteKit remain roadmap adapters.
- Optional `g-container-wide` layout class for wider landing-page
  sections.
- Virtual module stubs for Starlight components in `@grove-dev/astro`
  (improved theme integration).

### Changed
- All six `@grove-dev/*` packages are now published with consistent
  metadata (`homepage`, `repository`, `bugs`, `publishConfig`).

### Fixed
- Layout-level tokens for container widths now align with Starlight's
  design system.
- Resolved the import path of Starlight's reset / util styles so the
  build no longer relies on a fragile `node_modules` lookup.

**Packages:** all six.

---

## [0.2.1] — 2025-06-09

### Added
- `grove analyze` command: refreshes GitHub activity, release, and
  archive-state signals for every record in the space.
- `grove validate` command: strict-mode validation with detailed
  per-record issue reporting.
- `grove import` command: accepts GitHub awesome-list URLs and produces
  one YAML record per resource.

### Changed
- `@grove-dev/core` consolidates the resource schema, importers,
  validators, taxonomy, sitemap, and `llms.txt` generation in a
  single headless package.
- `@grove-dev/cli` orchestrates the `core` commands. The framework
  adapters (`astro` / `nextjs` / `svelte`) are now peer dependencies.

### Fixed
- Scaffold step now rewrites `workspace:*` deps only at publish time
  (via `pnpm publish`), avoiding the "404 on a version that doesn't
  exist yet" install failure.

**Packages:** `@grove-dev/core`, `@grove-dev/cli`.

---

## [0.1.0] — 2025-05-21

### Added
- Initial public release of the Grove monorepo.
- `@grove-dev/core` — headless engine.
- `@grove-dev/ui` — framework-agnostic UI primitives (filter, sort,
  stats, slug helpers). Roadmap-only at this version; not yet
  consumed by adapters.
- `@grove-dev/cli` — `grove new`, `grove import`, `grove analyze`,
  `grove validate`, `grove build-data`, `grove sitemap`, `grove build`,
  `grove dev`.
- `@grove-dev/astro` — first framework adapter, with a default
  template.
- Example space `examples/openapps`.

**Packages:** all six.

---

## Release tag format

- Repository tags use the form `vX.Y.Z` and are created **manually**
  after `scripts/release.mjs` finishes publishing. See
  [`apps/docs/src/content/docs/maintainers/release-process.md`](./apps/docs/src/content/docs/maintainers/release-process.md) for the full workflow.
- The `Versions` table in `SECURITY.md` describes the support window
  per release line.

[Unreleased]: https://github.com/tortuvshin/grove/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/tortuvshin/grove/releases/tag/v0.3.1
[0.3.0]: https://github.com/tortuvshin/grove/releases/tag/v0.3.0
[0.2.2]: https://github.com/tortuvshin/grove/releases/tag/v0.2.2
[0.2.1]: https://github.com/tortuvshin/grove/releases/tag/v0.2.1
[0.1.0]: https://github.com/tortuvshin/grove/releases/tag/v0.1.0
