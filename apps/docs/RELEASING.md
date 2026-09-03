# Releasing Grove

This is the **operational** release doc. The framing — "what we ship, in what order, and why" — lives in [`vision.md`](./vision.md) and the [Roadmap](/roadmap/) page on the docs site. Come here when you're about to push the button.

## TL;DR

There is no button on your machine. Releases happen in CI, and nobody holds a credential that could publish from a laptop.

```bash
# 1. Land your work on main with a Conventional Commit subject.
git commit -m "feat(cli): add \`grove update --adopt\`"

# 2. release-please opens (or updates) a release pull request.
#    Read its diff: version bumps in five package.json files + CHANGELOG.md.

# 3. Merge it. That tags vX.Y.Z, publishes the GitHub Release,
#    and publishes all four packages to npm with provenance.
```

Everything below is what happens inside those three steps and what to do when one of them goes sideways.

## How a release is assembled

`.github/workflows/release.yml` has two jobs.

**`release-please`** runs on every push to `main`. It reads the Conventional Commit subjects since the last release, decides the next version (`fix:` → patch, `feat:` → minor, `!` or `BREAKING CHANGE:` → major), and keeps a release pull request open with:

- the new version written into `package.json` (the private root, which carries the version line) and into `packages/{core,astro,cli,starlight}/package.json` via the `extra-files` entries in `release-please-config.json`;
- a new section at the top of `CHANGELOG.md`, generated from the commit subjects.

Merging that pull request creates the annotated `vX.Y.Z` tag and the GitHub Release, with the same notes as the body.

**`publish`** runs in the *same workflow run*, gated on `release_created == 'true'`. It checks out the tag, builds, runs the two pre-flight checks, publishes, and then verifies provenance actually attached.

The two jobs live in one workflow on purpose: a tag pushed by `GITHUB_TOKEN` does not trigger another workflow, so a separate tag-triggered publish workflow would sit there and never fire.

## Authentication: there isn't any

Publishing uses **npm trusted publishing** (OIDC). There is no `NPM_TOKEN` in the repository, in an environment, or in anyone's `~/.npmrc`. Each of the four packages has a trusted publisher configured on npmjs.com:

| Field | Value |
| --- | --- |
| Organization or user | `tortuvshin` |
| Repository | `grove` |
| Workflow filename | `release.yml` |
| Environment | *(blank)* |

All four fields are case-sensitive exact matches. Two consequences worth internalising:

- **Renaming `.github/workflows/release.yml` breaks publishing** until all four npmjs.com configurations are updated. The error you get is a `404`, which reads like the package does not exist. It does; the OIDC claim just didn't match.
- The runner must be GitHub-hosted. Self-hosted runners cannot mint the OIDC token npm accepts.

Because the packages already exist on npm, the "trusted publishing cannot create a package's first version" limitation does not apply here. It would apply to a brand-new fifth package — publish its `0.0.1` manually once, then configure the trusted publisher.

## Provenance

Every version from **0.10.0 onward** carries a signed provenance attestation linking the tarball to the commit and workflow run that produced it. Check any published version:

```bash
npm view @grove-dev/core@0.10.0 --json | jq '.dist.attestations'
```

Versions up to and including 0.9.0 have none, and **cannot be attested retroactively**. They also must not be unpublished — Open Apps and any other consumer resolve against them.

The publish job asserts this itself and fails the run if `dist.attestations` comes back null. That check exists because a publish that silently drops provenance still reports success, and the usual cause is a one-line mistake: `id-token: write` must be declared **on the publish job**, not at workflow level, where the `contents: read` default would shadow it.

## Versioning policy

Grove follows **semver**, and the commit subject is what selects the bump.

- **Patch** (`fix:`, `perf:`, `refactor:`) — bug fixes, internal refactors, performance. Always safe to upgrade.
- **Minor** (`feat:`) — new public API, new CLI subcommand, new framework adapter, deprecations. Includes patch-level fixes for free.
- **Major** (`feat!:` or a `BREAKING CHANGE:` footer) — breaking changes to a published package's public API or CLI surface. Reserved for actual breakage — see the list below.

### What's a "breaking change" for Grove?

- Renaming or removing a CLI subcommand.
- Changing the shape of `grove.config.ts` in a way that requires user edits.
- Changing the resource YAML schema in a way that makes existing data files fail to validate.
- Renaming or removing a published export from any `@grove-dev/*` package.
- Changing the default scaffold output in a way that breaks an existing space.
- Dropping support for a Node.js, pnpm, or framework version we previously listed as supported in `engines` / `peerDependencies`.

### What's _not_ a breaking change?

- Adding a new optional field to the resource schema.
- Adding a new CLI subcommand or flag.
- Adding a new export to an existing package.
- Internal refactors.
- Bug fixes that change observed behaviour away from a bug.

If a change is borderline, the rule of thumb is: "would a downstream space maintainer have to read a migration note and edit a file?" If yes, it's breaking.

## Cadence

There's no fixed schedule. In practice:

- **Patch** — as needed; can be daily when there's churn, weekly otherwise.
- **Minor** — when the new feature is useful enough to bump the API surface. Usually a few times a year.
- **Major** — announced in an issue / discussion at least **one minor release** before it ships, so downstream spaces can prepare.

The release pull request being open is not a commitment to release. Leave it sitting until the accumulated changes are worth shipping.

## Before merging the release pull request

- [ ] CI is green on `main` for the commit the release PR is based on.
- [ ] The release PR's diff is *only* version bumps and `CHANGELOG.md`. Anything else means a misconfigured `extra-files` entry.
- [ ] The proposed version matches what you expect from the commits. A surprise major usually means a stray `!` in a subject.
- [ ] The generated `CHANGELOG.md` section reads correctly. Edit it in the release PR if a commit subject was sloppy — release-please preserves hand edits to the section it generated.
- [ ] The `Tarball hygiene` CI job passed, and its `tarballs` artifact contains what you expect. That job runs `scripts/check-packaging.mjs` against real `pnpm pack` output.

## What the publish job checks before it publishes

Both of these also run in PR CI, so a failure here should be impossible by the time you merge:

- **`scripts/check-publishable.mjs`** — no published package may runtime-depend on a private workspace package, and every published package carries its own `LICENSE` plus an explicit `files` array. The first invariant is how `@grove-dev/cli` once shipped a hard dependency on the unpublished `@grove-dev/registry`; the second is why every tarball up to 0.9.0 declared `"license": "MIT"` with no license text in it.
- **`scripts/check-packaging.mjs`** — packs all four packages and inspects the tarballs: `LICENSE` present, no test files, no build caches, no `workspace:` ranges left unresolved in the shipped manifest. Then `publint` and `@arethetypeswrong/cli`, gating on `core` and `cli` and advisory on `astro` and `starlight` (both deliberately export raw `.ts`/`.astro` for Vite to compile, which both tools report as a defect).

Run either locally at any time:

```bash
node scripts/check-publishable.mjs
pnpm packaging:check                     # inspect only
node scripts/check-packaging.mjs --out packed   # ...and keep the tarballs
```

## Why we don't rewrite `workspace:*` manually

An early release script rewrote every `workspace:*` dep to a real version range _before_ `pnpm install`. This was a footgun: pnpm tried to resolve the new range against the npm registry, found a 404 (the version doesn't exist yet — we hadn't published!), and the install failed.

`pnpm publish` and `pnpm pack` both resolve `workspace:*` to the concrete version when they build the tarball, via `createExportableManifest`. `scripts/check-packaging.mjs` asserts the result rather than trusting it.

So the rule is: **bump `version`, leave `workspace:*` alone, let publish do the rest.** If you see a future commit re-introduce the rewrite, push back.

## Publishing a release candidate

`workflow_dispatch` on the Release workflow runs the publish job on its own, against a ref you name:

```bash
git tag -a v0.11.0-rc.1 -m "v0.11.0-rc.1" && git push origin v0.11.0-rc.1
gh workflow run release.yml -f ref=v0.11.0-rc.1 -f dist_tag=next
```

`dist_tag` defaults to `next`. Never dispatch a prerelease with `latest` — npm would hand every `npm install @grove-dev/core` a release candidate.

## When publishing fails

`pnpm -r publish` skips versions already on the registry, so **re-running the job is safe** and is the first thing to try. A partial publish leaves the remaining packages to a re-run rather than to manual intervention.

If it fails at the auth step with a `404`, the OIDC claim did not match. In order of likelihood: the workflow filename on npmjs.com no longer matches this file, `id-token: write` is missing from the publish job, or an environment name was configured on npmjs.com that this workflow does not set.

If `pnpm publish` itself turns out to be the problem, the escape hatch is to take pnpm out of the auth path entirely — `pnpm pack` already produces a publishable tarball with `workspace:*` resolved, so `npm publish <tarball> --provenance` (npm ≥ 11.5.1) does the same job.

## Emergency hotfix

1. `git checkout v0.9.0` (or the relevant tag).
2. `git checkout -b hotfix/0.9.1`.
3. Cherry-pick the fix with a `fix:` subject.
4. Open a PR into `main`. The hotfix ships through the normal release flow.

If the fix genuinely cannot wait for `main`, tag the hotfix branch by hand and `workflow_dispatch` the publish job at that tag with `dist_tag=latest`, then reconcile `main` and `.release-please-manifest.json` immediately afterwards so release-please's idea of the current version is not stale.

A hotfix does **not** require a new minor / major bump. The semver discipline is "what did I change?", not "how long since the last release?".

## Rolling back a release

**Don't.** Don't yank, don't force-push, don't rewrite tags. npm allows deprecating a version:

```bash
npm deprecate @grove-dev/core@0.2.3 "broken on Windows; use 0.2.4"
```

If you genuinely shipped something that is unsafe (security), see [`SECURITY.md`](../../SECURITY.md) and coordinate a security advisory instead of a quiet rollback.

## After the release

- [ ] All four packages are on npm at the new version, and each shows a provenance badge on its npmjs.com page.
- [ ] `npm install -g @grove-dev/cli@<version>` in a clean directory, then `grove init` end to end.
- [ ] Bump [Open Apps](https://github.com/tortuvshin/open-apps) to the new version — it pins exact versions on purpose, so it is the reproducibility canary.
- [ ] Write the narrative release post in `changelogs/` if the release deserves one. `CHANGELOG.md` is now the mechanical record; `changelogs/` is where the story goes.
- [ ] Post a short note in the GitHub Discussions "Announcements" category.
- [ ] Update the [Roadmap](/roadmap/) page — close out the items that the release shipped.

## See also

- [`vision.md`](./vision.md) — why Grove exists and the broader direction.
- The [Roadmap](/roadmap/) page on the docs site — what's queued, what shipped, what's deferred.
- [`.ignite/ARCHITECTURE.md`](../../.ignite/ARCHITECTURE.md) — how the packages and private applications fit together.
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — what to expect from a PR.
