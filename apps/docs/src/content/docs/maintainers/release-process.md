---
title: Release process
description: How a Grove release is cut — version bumps across packages, the publish order, the changelog, and how breaking changes are communicated.
---

This page documents the developer workflow for cutting a release of the
`@grove-dev/*` packages. If you maintain a *Grove-powered directory*
(not the framework), see [Governance](/maintainers/governance/) instead.

The release is run by a maintainer with npm publish access. The full
mechanics are in `scripts/release.mjs`; the narrative is below.

## TL;DR

```bash
# 1. Cut a release candidate
pnpm release --dry-run --minor

# 2. If the dry-run is clean, run it for real
pnpm release --minor

# 3. Push the version-bump commit
git push --follow-tags

# 4. Write the release notes
# Open the GitHub release draft, paste the relevant section
# of CHANGELOG.md, publish.
```

## What the release script does

`scripts/release.mjs` is the single entrypoint. It does four things,
in order:

1. **Bumps versions** in the four published package manifests. The
   default is a patch bump (`0.4.0 → 0.4.1`); `--minor` and `--major`
   set the kind, and `--bump=2.3.4` sets an explicit version.
2. **Builds every package** with `pnpm -r build`. This surfaces any
   cross-package breakage before publish.
3. **Publishes every package** in dependency order:
   `core → astro → cli → starlight` (see
   `scripts/release.mjs:41-46`).
4. **Stops on the first failure.** A failed real release keeps
   `.release-in-progress` and the bumped files for explicit recovery
   instead of silently double-bumping on a retry.

`--skip-build` and `--skip-bump` are available for advanced flows
(mostly CI). `NPM_OTP` env or `--otp=<code>` forwards the one-time
password to `pnpm publish`.

## The version-bump model

By default, the release script bumps the **four published packages**
in lockstep: Core, Astro, CLI, and Starlight. This keeps the CLI
scaffold and its Core/Astro dependencies on one release line.

`@grove-dev/ui`, `@grove-dev/svelte`, and `@grove-dev/nextjs` do not
exist in the workspace and have never been published. If you see a
release note that references one of them, it's stale — file a PR.

For published changes:

- **Bug fixes and package docs changes** ship as a patch bump
  (`0.4.0 → 0.4.1`).
- **Public API additions** ship as a minor bump (`0.4.0 → 0.5.0`).
- **Breaking changes** ship as a major bump (`0.4.0 → 1.0.0`) with
  migration notes.

## The CHANGELOG

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The structure:

```markdown
## [Unreleased]
### Added
### Changed
### Fixed

## [0.4.0] - 2026-07-30
### Added
- `@grove-dev/cli`: new `grove collection promote` command that ...
### Changed
- `@grove-dev/core`: `parseGithubRepoUrl` now returns `null` on ...
### Fixed
- `@grove-dev/astro`: project detail page no longer crashes when ...
```

The `[Unreleased]` section is the working buffer. PRs that change
user-visible behaviour add a line to the appropriate `### Added` /
`### Changed` / `### Fixed` subsection.

The maintainer cutting the release:

1. Renames `[Unreleased]` to the new version + date.
2. Adds a fresh, empty `[Unreleased]` block above it.
3. Tags every line with the affected `@grove-dev/*` package(s).
4. Commits the CHANGELOG as part of the release commit (or as a
   follow-up commit before the publish).

> A drift-protection script (`scripts/check-versions.mjs`) fails CI
> if the largest version in `packages/*/package.json` is not
> represented by a `## [X.Y.Z]` heading in `CHANGELOG.md` dated within
> the last 90 days.

## Breaking changes

A breaking change requires more than a major version bump. It requires
a **migration path**.

The mechanics:

1. **The PR that introduces the breaking change** must include a
   `Migration notes` section in the PR description. The template
   (`.github/PULL_REQUEST_TEMPLATE.md`) has a checkbox for this.
2. **The release notes** for the major version include a `Migration`
   section that pulls the PR's notes together.
3. **The CHANGELOG** marks the breaking change with a `**BREAKING**`
   prefix in the bullet.
4. **A deprecation cycle** is preferred to a hard break. Mark the
   old API as `@deprecated` in the JSDoc, ship it in a minor
   release, remove it in the next major.
5. **A `migration-codemod`** is encouraged for large-scale renames.

## The release commit

The version-bump commit is one commit per release. The script writes
the new versions to each `packages/*/package.json`; the maintainer
commits them with a message like:

```
chore(release): cut 0.5.0

- @grove-dev/core 0.4.0 → 0.5.0
- @grove-dev/astro 0.4.0 → 0.5.0
- @grove-dev/cli 0.4.0 → 0.5.0
- @grove-dev/starlight 0.4.0 → 0.5.0

See CHANGELOG.md for the user-visible changes.
```

Tag the release explicitly after publishing; the script does not
create Git tags.

## The GitHub release

After the publish, the maintainer drafts a GitHub release:

- **Tag:** `v0.5.0` (created by the push).
- **Title:** `v0.5.0` (or `v0.5.0 — <one-line summary>`).
- **Body:** the corresponding section of `CHANGELOG.md`, with the
  `### Added` / `### Changed` / `### Fixed` sections preserved.

## Cadence

There is no fixed cadence. The historical pattern is roughly:

- **Patch releases** ship as needed — usually within a day of a bug
  report that has a fix.
- **Minor releases** ship every 4-8 weeks, batching the unreleased
  changes.
- **Major releases** ship when there is a *user-visible* breaking
  change worth the migration.

The `[Unreleased]` section is the backlog. When it grows past ~10
entries or includes a feature that users are waiting on, it's time
for a minor release.

## What "ready to release" looks like

Before running `pnpm release`, check:

1. **`main` is green.** All CI checks pass on the latest commit.
2. **`[Unreleased]` is in shape.** Every entry is a real change,
   scoped to a package, and written in the present tense.
3. **No half-done migrations.** If a deprecation was added in a
   previous release, the code that uses it is updated.
4. **The dry-run is clean.** `pnpm release --dry-run --minor`
   (or `--patch` / `--major`) runs the build, the bump, and the
   dry-run publish.

A release that ships with a red main branch is a "yank it" situation.
The npm registry supports unpublishing within 72 hours, but it's a
coordination headache. Don't ship on red.

## What goes wrong, and what to do

- **A package fails to publish mid-script.** Inspect
  `.release-in-progress`, the registry, and the bumped files.
- **`pnpm publish` asks for an OTP.** The script reads `NPM_OTP`
  from the env or `--otp=<code>` from the CLI.
- **The build fails on a package you didn't expect.** A cross-package
  change broke the build of an adapter you didn't touch. Fix the
  regression, commit, re-run the release from the top.
- **A user reports a regression within hours of a release.** The
  fastest fix is a patch release with the regression fix.

## Considering Changesets

Grove currently uses a hand-rolled `scripts/release.mjs` for the
reason that the four published packages (`core`, `astro`, `cli`,
`starlight`) always release together as a single version line.
[Changesets](https://github.com/changesets/changesets) is the
de-facto standard for JS package releases; we evaluated it.

### Why we did not adopt Changesets (yet)

- **Single-version line.** Grove's packages move together. A
  Changesets workflow that bumps each package independently
  produces four diffs and four changelogs to reconcile, where
  `scripts/release.mjs` produces one.
- **Author friction.** Changesets requires a `.changeset/*.md`
  file in every PR that touches a public API. For a small
  maintainer team, the extra PR step slowed reviews in pilot
  testing.
- **Single CHANGELOG.md.** The repository publishes one
  CHANGELOG.md, not per-package. Changesets' per-package
  changelog files would have to be aggregated by the release
  script — adding the work it removes.

### What we will re-evaluate

- **Multi-version lines.** If a package splits off (say,
  `@grove-dev/starlight` ships independently), Changesets
  becomes the better fit.
- **External contributors.** If the maintainer team grows to > 5
  and a Changesets bot removes the "who bumps the version"
  conversation, the trade-off shifts.
- **Dependents.** If other packages in the JS ecosystem start
  depending on individual Grove packages with their own release
  schedules, per-package versions matter.

### Migration plan

The migration from `scripts/release.mjs` to Changesets is
mechanical:

1. `pnpm add -Dw @changesets/cli` (and `@changesets/changelog-github`).
2. Add `.changeset/config.json` with the linked-package preset:
   ```json
   {
     "linked": [
       ["@grove-dev/core", "@grove-dev/astro", "@grove-dev/cli", "@grove-dev/starlight"]
     ]
   }
   ```
3. Add a `version-packages` workflow (`changesets/action`) on push
   to `main`.
4. Add a `publish-packages` workflow that runs `pnpm publish` after
   the version PR merges.
5. Retire `scripts/release.mjs`.

The CHANGELOG.md can stay (Changesets can be configured to
aggregate into a single file) or split per-package (the default).

For now, the hand-rolled script is fine; the migration is a
day's work when the trade-off shifts.

## What is not in the release process

- **The docs site (`apps/docs/`)** is built and deployed separately
  (to withgrove.dev) and does not have a version number tied to the
  `@grove-dev/*` packages. A docs change does not require a release.
- **The example application (`apps/example/`)** is not published
  independently; `@grove-dev/cli` bundles it as the init scaffold.
- **The CLI itself** does not self-update. A user stays on the
  installed version until they run `pnpm dlx @grove-dev/cli@latest`
  again.