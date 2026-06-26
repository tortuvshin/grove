---
title: Release process
description: How a Grove release is cut — version bumps across packages, the publish order, the changelog, and how breaking changes are communicated.
---

This page documents the developer workflow for cutting a release of the `@grove-dev/*` packages. If you maintain a *Grove-powered directory* (not the framework), this page is not for you — see [Governance](/maintainers/governance/) instead.

The release is run by a maintainer with npm publish access. The full mechanics are in `scripts/release.mjs`; the narrative is below.

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

That's it. The script handles the rest.

## What the release script does

`scripts/release.mjs` is the single entrypoint. It does four things, in order:

1. **Bumps versions** in every `packages/*/package.json`. The default is a patch bump (`0.2.2 → 0.2.3`); `--minor` and `--major` set the kind, `--bump=2.3.4` sets an explicit version.
2. **Builds every package** with `pnpm -r build`. This surfaces any cross-package breakage before publish.
3. **Publishes every package** in dependency order. The order is `core → ui → {astro, nextjs, svelte} → cli`. This is the order of the workspace dependency graph; an adapter that depends on `core` cannot be published before `core` is on the registry.
4. **Stops on the first failure.** If `astro` fails to publish, `cli` is not published. The script exits non-zero and prints which package failed. Re-running the script after the fix is safe — packages that already published are skipped because their versions on the registry match the bumped versions locally.

A `--dry-run` flag runs steps 1-2 and prints the publish commands without running them. Always run a dry-run first.

## The version-bump model

By default, the release script bumps **all six packages in lockstep** to the same version. This is the explicit decision: when a user runs `pnpm dlx @grove-dev/cli@latest`, they get the matching `@grove-dev/core`, `@grove-dev/astro`, etc. on the same release.

The downside: a small docs change to `@grove-dev/docs` triggers a publish of every package. The mitigations:

- **Bug fixes and docs-only changes** ship as a patch bump (`0.2.2 → 0.2.3`). The release notes for a patch should make clear that no public API changed.
- **Public API changes** ship as a minor bump (`0.2.3 → 0.3.0`). The release notes for a minor call out the new API and any deprecations.
- **Breaking changes** ship as a major bump (`0.2.3 → 1.0.0`). The release notes describe the migration.

This is standard semver, applied to a monorepo. The user experience is "every Grove package is the same version, and the version follows semver". The complexity is hidden in the script.

The exception is **alpha / beta tags**. If the script supports `--tag=next` (it does not in V1 — see the roadmap), the version would be published under a pre-release tag, and the lockstep rule stays.

## The CHANGELOG

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). The structure:

```markdown
## [Unreleased]
### Added
### Changed
### Fixed

## [1.2.0] - 2026-01-15
### Added
- `@grove-dev/core`: new `getOwnerRepoFromUrl` helper that ...
### Changed
- `@grove-dev/cli`: `grove sync github` now logs a warning when ...
### Fixed
- `@grove-dev/astro`: project detail page no longer crashes when ...
```

The `[Unreleased]` section is the working buffer. PRs that change user-visible behavior add a line to the appropriate `### Added` / `### Changed` / `### Fixed` subsection.

The maintainer cutting the release:

1. Renames `[Unreleased]` to the new version + date.
2. Adds a fresh, empty `[Unreleased]` block above it.
3. Tags every line with the affected `@grove-dev/*` package(s), since the lockstep model means a single version can affect multiple packages in different ways.
4. Commits the CHANGELOG as part of the release commit (or as a follow-up commit before the publish).

## Breaking changes

A breaking change requires more than a major version bump. It requires a **migration path**.

The mechanics:

1. **The PR that introduces the breaking change** must include a `Migration notes` section in the PR description. The template (`.github/PULL_REQUEST_TEMPLATE.md`) has a checkbox for this.
2. **The release notes** for the major version include a `Migration` section that pulls the PR's notes together. Most major releases migrate 1-3 things, not 20.
3. **The CHANGELOG** marks the breaking change with a `**BREAKING**` prefix in the bullet, so a reader scanning the diff notices it.
4. **A deprecation cycle** is preferred to a hard break. Mark the old API as `@deprecated` in the JSDoc, ship it in a minor release, remove it in the next major. The deprecation period is at least one minor release (3-6 months in practice).
5. **A `migration-codemod`** is encouraged for large-scale renames. The framework does not currently ship codemods, but a PR that adds one is welcome.

The aim is: a downstream user reading the changelog can answer "do I need to do anything?" in 30 seconds. The migration section makes the answer explicit.

## The release commit

The version-bump commit is one commit per release. The script writes the new versions to each `packages/*/package.json`; the maintainer commits them with a message like:

```
chore(release): cut 0.3.0

- @grove-dev/core 0.2.3 → 0.3.0
- @grove-dev/ui 0.2.3 → 0.3.0
- @grove-dev/astro 0.2.3 → 0.3.0
- @grove-dev/nextjs 0.2.3 → 0.3.0
- @grove-dev/svelte 0.2.3 → 0.3.0
- @grove-dev/cli 0.2.3 → 0.3.0

See CHANGELOG.md for the user-visible changes.
```

The `--follow-tags` flag on the push ensures the version tag (`v0.3.0`) is created.

## The GitHub release

After the publish, the maintainer drafts a GitHub release:

- **Tag:** `v0.3.0` (created by the push).
- **Title:** `v0.3.0` (or `v0.3.0 — <one-line summary>`).
- **Body:** the corresponding section of `CHANGELOG.md`, with the `### Added` / `### Changed` / `### Fixed` sections preserved. For a major release, prepend a one-paragraph "what changed" summary.
- **Pre-release:** unchecked, unless the version is suffixed (e.g., `0.3.0-rc.1`).
- **Generate release notes:** unchecked. The CHANGELOG is the source of truth; auto-generated GitHub notes duplicate it.

The release is the public announcement. Pin the release in the discussion channels (Discord, Slack, the framework's social accounts) with a one-paragraph summary and a link.

## Cadence

There is no fixed cadence. The historical pattern is roughly:

- **Patch releases** ship as needed — usually within a day of a bug report that has a fix.
- **Minor releases** ship every 4-8 weeks, batching the unreleased changes.
- **Major releases** ship when there is a *user-visible* breaking change worth the migration. There have been zero as of V1; the first is planned for V1 → V2.

The `[Unreleased]` section is the backlog. When it grows past ~10 entries or includes a feature that users are waiting on, it's time for a minor release.

## What "ready to release" looks like

Before running `pnpm release`, check:

1. **`main` is green.** All CI checks pass on the latest commit.
2. **`[Unreleased]` is in shape.** Every entry is a real change, scoped to a package, and written in the present tense ("adds X", not "added X"). No `TODO` or `WIP` entries.
3. **No half-done migrations.** If a deprecation was added in a previous release, the code that uses it is updated, or the deprecation is extended with a note.
4. **The dry-run is clean.** `pnpm release --dry-run --minor` (or `--patch` / `--major`) runs the build, the bump, and the dry-run publish. If any of those fail, fix the underlying issue and re-run.

A release that ships with a red main branch is a "yank it" situation. The npm registry supports unpublishing within 72 hours, but it's a coordination headache. Don't ship on red.

## What goes wrong, and what to do

- **A package fails to publish mid-script.** Re-run the script. Packages that succeeded are skipped (their versions on npm match). The script is idempotent.
- **`pnpm publish` asks for an OTP** (one-time password for npm 2FA). The script reads `NPM_OTP` from the env or `--otp=<code>` from the CLI. Either is fine; the latter is more scriptable.
- **The build fails on a package you didn't expect.** A cross-package change broke the build of an adapter you didn't touch. Fix the regression, commit, re-run the release from the top.
- **A version was published to npm but the GitHub release was not created.** The release can be created after the fact — it's just metadata. Don't yank the npm version.
- **A user reports a regression within hours of a release.** The fastest fix is a patch release with the regression fix. The release cadence is "as needed" for this reason.

## What is not in the release process

- **The docs site (`docs/`)** is not in the lockstep release. The docs site is built and deployed separately (to grove.dev.mn) and does not have a version number tied to the `@grove-dev/*` packages. A docs change does not require a release.
- **The example directories (`examples/`)** are not published. They are illustrative; their git history is the version history.
- **The CLI itself** does not self-update. A user on `@grove-dev/cli@0.2.3` stays on 0.2.3 until they run `pnpm dlx @grove-dev/cli@latest` again. Self-update is a V2 feature.
