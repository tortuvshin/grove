---
title: Release process
description: How a Grove release is cut — conventional commits, the release pull request, trusted publishing with provenance, and how breaking changes are communicated.
---

This page documents the developer workflow for cutting a release of the
`@grove-dev/*` packages. If you maintain a *Grove-powered directory*
(not the framework), see [Governance](/maintainers/governance/) instead.

Releases run in GitHub Actions. Nobody holds a credential that can publish
a Grove package from a laptop, and every published tarball carries a signed
attestation naming the commit and workflow run it came from. The mechanics
are in `.github/workflows/release.yml` and `release-please-config.json`;
the narrative is below.

## TL;DR

```bash
# 1. Land the work with a Conventional Commit subject.
git commit -m "feat(cli): add \`grove update --adopt\`"

# 2. release-please keeps a release pull request open on main.
#    Read its diff, then merge it when the batch is worth shipping.

# 3. Merging tags vX.Y.Z, publishes the GitHub Release,
#    and publishes all four packages to npm with provenance.
```

## The two jobs

`.github/workflows/release.yml` contains both halves of a release, and it
has to: a tag pushed with `GITHUB_TOKEN` does not trigger another workflow,
so a separate tag-triggered publish workflow would sit there and never fire.

**`release-please`** runs on every push to `main`. It reads the Conventional
Commit subjects since the last release, computes the next version, and keeps
a release pull request open containing the version bumps and a generated
`CHANGELOG.md` section. Merging it creates the `vX.Y.Z` tag and the GitHub
Release.

**`publish`** runs in the same workflow run, gated on
`release_created == 'true'`. It checks out the tag, builds, runs both
pre-flight checks, publishes with `pnpm -r publish --provenance`, and then
asserts that provenance actually attached.

## The version-bump model

The four published packages — Core, Astro, CLI, and Starlight — move in
lockstep on a single version line. This keeps the CLI scaffold and its
Core/Astro dependencies on one release line.

release-please is configured with a **single root component**
(`release-please-config.json`), not four linked ones. The private root
`package.json` carries the version; each package manifest is bumped by an
`extra-files` entry pointing at its `$.version`. That is what produces one
`CHANGELOG.md` and one `vX.Y.Z` tag instead of four of each.

`@grove-dev/registry` is deliberately absent: it is `private: true` and
versioned on its own lifecycle. `@grove-dev/ui`, `@grove-dev/svelte`, and
`@grove-dev/nextjs` do not exist in the workspace and have never been
published. If you see a release note that references one of them, it's
stale — file a PR.

The commit subject selects the bump:

- **`fix:`, `perf:`, `refactor:`** → patch (e.g. `0.9.0 → 0.9.1`).
- **`feat:`** → minor (e.g. `0.9.0 → 0.10.0`).
- **`feat!:`** or a `BREAKING CHANGE:` footer → major, with migration notes.

The scope names the affected package, so `feat(cli):` reads as a CLI change
in the generated changelog.

## Authentication: there isn't any

Publishing uses **npm trusted publishing** (OIDC). There is no `NPM_TOKEN`
in the repository, in an environment, or in a maintainer's `~/.npmrc`. Each
package has a trusted publisher configured on npmjs.com:

| Field | Value |
| --- | --- |
| Organization or user | `tortuvshin` |
| Repository | `grove` |
| Workflow filename | `release.yml` |
| Environment | *(blank)* |

Every field is a case-sensitive exact match. **Renaming
`.github/workflows/release.yml` breaks publishing** until all four npmjs.com
configurations are updated; the failure surfaces as a `404`, which reads
like the package does not exist.

Trusted publishing cannot create a package's *first* version. That does not
affect the four existing packages, but a new fifth package would need one
manual publish before its trusted publisher can take over.

## Provenance

Every version from **0.10.0 onward** carries a signed provenance attestation.

```bash
npm view @grove-dev/core@0.10.0 --json | jq '.dist.attestations'
```

Versions up to and including 0.9.0 have none and **cannot be attested
retroactively**. They must not be unpublished either — Open Apps and other
consumers resolve against them.

The publish job checks `dist.attestations` for all four packages and fails
the run if any comes back null. A publish that drops provenance still
reports success, and the usual cause is a one-line mistake: `id-token: write`
must be declared **on the publish job**, not at workflow level where the
`contents: read` default shadows it.

## The CHANGELOG

`CHANGELOG.md` at the repository root is generated from 0.10.0 onward.
release-please writes a new section at the top of the file when the release
pull request is created; the hand-written history below it is untouched.

Entries up to and including 0.9.0 were written by hand in
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) form, with
**Packages** lines calling out which of the four a change affected. Newer
entries carry the same information in the Conventional Commit scope.

There is no `[Unreleased]` section any more. Unreleased work lives in the
open release pull request, where you can read the exact notes that will
ship. If a commit subject was sloppy, edit the section in that pull
request — release-please preserves hand edits to what it generated.

`changelogs/*.md` is unaffected and keeps its role: narrative,
blog-style release write-ups. `CHANGELOG.md` is the mechanical record;
`changelogs/` is where the story goes.

## Breaking changes

A breaking change requires more than a major version bump. It requires
a **migration path**.

1. **The PR that introduces the breaking change** must include a
   `Migration notes` section in the PR description. The template
   (`.github/PULL_REQUEST_TEMPLATE.md`) has a checkbox for this.
2. **The commit subject** carries `!` (e.g. `feat(cli)!:`) or a
   `BREAKING CHANGE:` footer, so release-please selects a major bump and
   surfaces the note in the changelog.
3. **The release notes** for the major version include a `Migration`
   section that pulls the PR's notes together.
4. **A deprecation cycle** is preferred to a hard break. Mark the
   old API as `@deprecated` in the JSDoc, ship it in a minor
   release, remove it in the next major.
5. **A `migration-codemod`** is encouraged for large-scale renames.

## Cadence

There is no fixed cadence. The historical pattern is roughly:

- **Patch releases** ship as needed, when a fix is ready.
- **Minor releases** batch the accumulated features.
- **Major releases** ship when there is a *user-visible* breaking
  change worth the migration.

An open release pull request is not a commitment to release. Leave it
sitting until the batch is worth shipping — the version it proposes updates
itself as more commits land.

## What "ready to release" looks like

Before merging the release pull request:

1. **`main` is green.** All CI checks pass on the commit the release PR is
   based on. A release that ships with a red main branch is a "yank it"
   situation, and yanking is a coordination headache. Don't ship on red.
2. **The diff is only version bumps and `CHANGELOG.md`.** Anything else
   means a misconfigured `extra-files` entry.
3. **The proposed version is the one you expect.** A surprise major usually
   means a stray `!` in a commit subject.
4. **No half-done migrations.** If a deprecation was added in a previous
   release, the code that uses it is updated.
5. **The `Tarball hygiene` job passed** and its `tarballs` artifact contains
   what you expect.

## The pre-flight checks

Both run in PR CI and again in the publish job:

- **`scripts/check-publishable.mjs`** — no published package may
  runtime-depend on a private workspace package, and every published package
  carries its own `LICENSE` plus an explicit `files` array. The first
  invariant is how `@grove-dev/cli` once shipped a hard dependency on the
  unpublished `@grove-dev/registry`. The second is why every tarball up to
  0.9.0 declared `"license": "MIT"` with no license text inside it: npm's
  automatic license inclusion only looks inside the directory being packed,
  never at the monorepo root.
- **`scripts/check-packaging.mjs`** — packs all four packages and inspects
  the tarballs: `LICENSE` present, no test files, no build caches, no
  `workspace:` ranges left unresolved in the shipped manifest. Then
  `publint` and `@arethetypeswrong/cli`, gating on `core` and `cli` and
  advisory on `astro` and `starlight`, which deliberately export raw
  `.ts`/`.astro` source for Vite to compile.

Run them locally with `node scripts/check-publishable.mjs` and
`pnpm packaging:check`. Add `--out packed` to the latter to keep the
tarballs around for inspection.

## Release candidates

`workflow_dispatch` on the Release workflow runs the publish job alone,
against a ref you name:

```bash
git tag -a v0.11.0-rc.1 -m "v0.11.0-rc.1" && git push origin v0.11.0-rc.1
gh workflow run release.yml -f ref=v0.11.0-rc.1 -f dist_tag=next
```

`dist_tag` defaults to `next`. npm publishes to `latest` unless told
otherwise, including for prerelease versions — dispatching a release
candidate with `latest` would hand every `npm install @grove-dev/core` a
release candidate.

## What goes wrong, and what to do

- **A package fails to publish mid-job.** Re-run the job. `pnpm -r publish`
  skips versions already on the registry, so a partial publish resolves
  itself rather than needing manual publishes of the remainder.
- **`404` at the publish step.** The OIDC claim did not match. In order of
  likelihood: the workflow filename on npmjs.com no longer matches this
  file, `id-token: write` is missing from the publish job, or an environment
  name is configured on npmjs.com that the workflow does not set.
- **The provenance assertion fails.** The publish succeeded but nothing was
  attested. Same causes as above; the version is already on npm and cannot
  be re-published, so fix the workflow and ship the next patch.
- **The build fails on a package you didn't expect.** A cross-package change
  broke the build of a package you didn't touch. Fix the regression on
  `main`; the release PR picks it up.
- **A user reports a regression within hours of a release.** The fastest fix
  is a patch release with the regression fix.

## Why release-please and not Changesets

Both were considered. The deciding factor is author friction against what
Grove actually needs.

- **Single version line.** Grove's four packages move together. Changesets
  bumps each package independently by default, producing four diffs and four
  changelogs to reconcile. release-please's single-root-component
  configuration produces one of each.
- **No per-PR ceremony.** Changesets requires a `.changeset/*.md` file in
  every PR that touches a public API. Grove's commit subjects have been
  Conventional Commits from the start, so release-please reads the intent
  that is already there rather than asking for it a second time.
- **One CHANGELOG.md.** The repository publishes one changelog, not
  per-package. That is release-please's default shape here and Changesets'
  non-default one.

This would be re-evaluated if a package split off onto its own release
schedule — `@grove-dev/starlight` is the plausible candidate — since
per-package versions are where Changesets earns its overhead.

## What is not in the release process

- **The docs site (`apps/docs/`)** is built and deployed separately
  (to withgrove.dev) and does not have a version number tied to the
  `@grove-dev/*` packages. A docs change does not require a release.
- **The example application (`apps/example/`)** is not published
  independently; `@grove-dev/cli` bundles it as the init scaffold.
- **`@grove-dev/registry`** is private, versioned independently, and reaches
  consumers through the docs site and the copy baked into the CLI tarball.
- **The CLI itself** does not self-update. A user stays on the
  installed version until they run `pnpm dlx @grove-dev/cli@latest`
  again.
