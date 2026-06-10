# Changelog

All notable changes to Grove are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Grove is a monorepo of six published packages
(`@grove-dev/core`, `@grove-dev/ui`, `@grove-dev/cli`,
`@grove-dev/astro`, `@grove-dev/nextjs`, `@grove-dev/svelte`).
By default a version bump applies to all six in lockstep. The release
notes below describe the user-visible change; the affected packages are
called out in **Packages** lines.

For the developer workflow that produces these entries, see
[`docs/RELEASING.md`](./docs/RELEASING.md).

---

## [Unreleased]

### Added
- Project configuration: `.editorconfig`, `.prettierrc.json`, `.prettierignore`.
- `.github/` directory: issue templates (bug, feature, docs, question),
  pull request template, `FUNDING.yml`, `dependabot.yml`, and
  `SUPPORT.md`.
- CI workflows: `ci.yml` (build, type-check, scaffold smoke test, repo
  hygiene checks) and `audit.yml` (weekly `pnpm audit`).
- Root `CHANGELOG.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `SECURITY.md`, and `LICENSE` (MIT).
- `docs/RELEASING.md` and `docs/SUPPORT.md` to round out the
  contributor-facing documentation.
- Dependabot configured to ignore `@grove-dev/*` workspace deps (the
  release script owns those rewrites).

### Changed
- None.

### Fixed
- None.

### Security
- None.

**Packages:** all six (`@grove-dev/core`, `@grove-dev/ui`, `@grove-dev/cli`,
`@grove-dev/astro`, `@grove-dev/nextjs`, `@grove-dev/svelte`).

---

## [0.2.2] — 2025-06-10

### Added
- Removal of the deprecated landing and showcase pages; the
  `lucode-starlight` theme now serves as the docs site shell.
- `@grove-dev/astro`, `@grove-dev/nextjs`, and `@grove-dev/svelte` ship
  the same surface area: components, layouts, design tokens, and a
  default template.
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
- `grove import` accepts GitHub awesome-list URLs and produces
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
  [`docs/RELEASING.md`](./docs/RELEASING.md) for the full workflow.
- The `Versions` table in `SECURITY.md` describes the support window
  per release line.

[Unreleased]: https://github.com/tortuvshin/grove/compare/v0.2.2...HEAD
[0.2.2]: https://github.com/tortuvshin/grove/releases/tag/v0.2.2
[0.2.1]: https://github.com/tortuvshin/grove/releases/tag/v0.2.1
[0.1.0]: https://github.com/tortuvshin/grove/releases/tag/v0.1.0
