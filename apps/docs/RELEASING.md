# Releasing Grove

This is the **operational** release doc. The framing — "what we ship, in what order, and why" — lives in [`vision.md`](./vision.md) and the [Roadmap](/roadmap/) page on the docs site. Come here when you're about to push the button.

## TL;DR

```bash
# 1. Make sure the tree is clean and CI is green on main.
git checkout main && git pull --rebase
git status

# 2. Bump, build, publish.
pnpm release              # patch (0.3.1 -> 0.3.2)
pnpm release --minor      # minor (0.3.1 -> 0.4.0)
pnpm release --major      # major (0.3.1 -> 1.0.0)
pnpm release --bump=2.3.4 # explicit
pnpm release:dry --minor  # verify 0.4.0 packages without changing the tree
```

The release script lives at `scripts/release.mjs`. It does the following in order:

1. Reads the current versions of the four published packages.
2. Computes each new version using the bump flag (`patch` by default; honors `--bump=X.Y.Z`).
3. Writes the new `version` field into `core`, `astro`, `cli`, and `starlight`.
4. **Skips** rewriting `workspace:*` deps — `pnpm publish` does that for us in the tarball. (See "Why we don't rewrite `workspace:*` manually" below.)
5. Runs `pnpm install` to refresh `pnpm-lock.yaml` and the symlinks under `node_modules/`.
6. Runs `pnpm -r build` so the `dist/` for every package matches the new version.
7. For each package, in dependency order, runs `pnpm --filter <name> publish --no-git-checks --access public --dry-run` if `--dry-run` was passed, or the real `publish` otherwise.
8. On a successful dry run, restores every version file and `pnpm-lock.yaml`. A real release leaves the bump ready to commit and tag manually.

**Authentication** comes from `~/.npmrc`. Run `npm login` once per machine.

## Versioning policy

Grove follows **semver**:

- **Patch** — bug fixes, internal refactors, doc fixes, performance. Always safe to upgrade.
- **Minor** — new public API, new CLI subcommand, new framework adapter, deprecations. Includes patch-level fixes for free.
- **Major** — breaking changes to a published package's public API or CLI surface. Reserved for actual breakage — see the list below.

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

## Pre-release checklist

Run through this before you run `pnpm release`:

- [ ] Working tree is clean on `main`. (`git status`)
- [ ] `pnpm -r build` passes.
- [ ] `pnpm -r check` passes.
- [ ] `pnpm test:scaffold` passes — this is the one that catches the "did the tarball rewrite `workspace:*`?" class of bug.
- [ ] CI on `main` is green for the latest commit.
- [ ] `CHANGELOG.md` at the root has a section for the new version, with the user-visible changes filled in.
- [ ] You have npm publish credentials loaded (`npm whoami` should print your username).
- [ ] You have a GitHub personal access token with `repo` and `write:packages` scopes if you plan to push a tag / create a GitHub release (we don't do this automatically yet).

## Running the release

### Dry run first

Always:

```bash
pnpm release:dry
```

This will temporarily:

- Bump versions in every `package.json`.
- Reinstall and rebuild.
- Run `pnpm publish --dry-run` for each package.
- Restore the package versions and lockfile, leaving the working tree unchanged.

If the dry run complains (missing files, unexpected `workspace:*` leaks, registry auth errors), **fix them before the real run**. Don't `--force` your way through a dry-run failure.

### The real thing

```bash
pnpm release
```

The script will print each publish attempt and the npm registry URL it landed on. If any publish fails, the script aborts, leaves `.release-in-progress`, and does not publish later packages. Inspect the registry and working tree before choosing one of these recovery paths:

1. If nothing published, revert the version files, remove `.release-in-progress`, fix the cause, and run again.
2. If some packages published, keep the bumped versions and manually publish the remaining packages with `pnpm --filter <name> publish --no-git-checks --access public`.

### Tagging

The release script does not create git tags automatically (this is deliberate — it doesn't know which bump you wanted if you pass `--bump`). After a successful release, tag manually:

```bash
git tag -a v0.2.3 -m "v0.2.3"
git push origin v0.2.3
```

We use annotated tags so `git describe` is useful.

### GitHub release

After tagging, open a GitHub release from the tag. The release body should be a copy of the corresponding `CHANGELOG.md` section. There's no automation for this yet — see the [Roadmap](/roadmap/) page on the docs site for the backlog.

## Why we don't rewrite `workspace:*` manually

Older versions of `scripts/release.mjs` rewrote every `workspace:*` dep to a real version range _before_ `pnpm install`. This was a footgun: pnpm tried to resolve the new range against the npm registry, found a 404 (the version doesn't exist yet — we hadn't published!), and the install failed.

The fix: `pnpm publish` already rewrites `workspace:*` to the real version when it builds the publishable tarball. Verified by inspecting `grove-dev-cli-0.1.0.tgz` — the dep appeared as the right version in the tarball's `package/package.json` even though the source still had `workspace:*`.

So the rule is: **bump `version`, leave `workspace:*` alone, let publish do the rest**. The release script now skips the rewrite step on purpose. If you see a future commit re-introduce the rewrite, push back.

## After the release

- [ ] The new version appears on npm under `@grove-dev/core` (the canary — it's published first because the others depend on it).
- [ ] The other three packages appear in dependency order: `core` → `astro` → `cli` → `starlight`.
- [ ] Run `pnpm test:scaffold` and build the generated directory using the packed release artifacts.
- [ ] Post a short note in the GitHub Discussions "Announcements" category, or open a discussion if there isn't one yet.
- [ ] Update the [Roadmap](/roadmap/) page — close out the items that the release shipped.

## Emergency hotfix

If you need to ship a fix to an already-released version:

1. `git checkout v0.2.2` (or the relevant tag).
2. `git checkout -b hotfix/0.2.3`.
3. Cherry-pick the fix.
4. Run the normal release flow targeting that branch — `scripts/release.mjs` reads the current version from `@grove-dev/core` and bumps relative to it.
5. Tag, push, and merge the hotfix branch back into `main`.

A hotfix does **not** require a new minor / major bump. The semver discipline is "what did I change?", not "how long since the last release?".

## Rolling back a release

**Don't.** Don't yank, don't force-push, don't rewrite tags. npm allows deprecating a version:

```bash
npm deprecate @grove-dev/core@0.2.3 "broken on Windows; use 0.2.4"
```

If you genuinely shipped something that is unsafe (security), see [`SECURITY.md`](../../SECURITY.md) and coordinate a security advisory instead of a quiet rollback.

## See also

- [`vision.md`](./vision.md) — why Grove exists and the broader direction.
- The [Roadmap](/roadmap/) page on the docs site — what's queued, what shipped, what's deferred.
- [`.ignite/ARCHITECTURE.md`](../../.ignite/ARCHITECTURE.md) — how the packages and private applications fit together.
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — what to expect from a PR.
