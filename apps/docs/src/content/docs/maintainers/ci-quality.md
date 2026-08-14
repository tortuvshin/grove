---
title: CI & quality
description: Continuous integration, observability, and quality gates for Grove contributors.
---

This page covers the CI pipeline for Grove itself — what runs on every PR, what runs on schedule, and what the maintainers monitor.

## On every PR

The `.github/workflows/ci.yml` workflow runs:

| Step | Tool | Status |
|---|---|---|
| Install | `pnpm install` | required |
| Lint | `biome ci .` | planned (currently off in CI) |
| Unit tests | `vitest run --coverage` | required (coverage not enforced) |
| Scaffold test | `pnpm test:scaffold` | required |
| Docs check | `pnpm docs:check` | required |

Lighthouse audit (`.github/workflows/lighthouse-audit.yml`) runs separately when PRs touch `@grove-dev/core`, `@grove-dev/cli`, `@grove-dev/astro`, or `apps/example`.

### Biome in CI

Grove ships `biome.json` at the repo root with formatter, linter, and `organizeImports` configured. The current CI does not run `biome ci .` — this is a known gap tracked under "configured but not enforced." The fix is to add `biomejs/setup-biome@v2` (pinned to match the locally installed Biome version) before the `pnpm install` step.

### Vitest coverage

`vitest.config.ts` declares thresholds (`statements: 58`, `branches: 42`, `functions: 54`, `lines: 60`). The thresholds are calibrated just below the baseline so they don't fail; they are not currently enforced in CI. The fix is to upload `coverage/lcov.info` via `codecov/codecov-action@v5` with `codecov.yml` declaring `coverage.status.project.default: { target: auto, threshold: 1% }` and `coverage.status.patch.default: { target: 80% }`.

### Docs sidebar coverage

`scripts/check-starlight-sidebar.mjs` validates that every slug in the docs `astro.config.mjs` resolves to an existing file. The companion check (every file under `apps/docs/src/content/docs/` is in the sidebar or nav-links) is tracked as a follow-up.

## Scheduled jobs

| Workflow | Schedule | What it does |
|---|---|---|
| `audit.yml` | weekly (Sunday 02:00 UTC) | `pnpm audit` against the lockfile |
| `lighthouse-audit.yml` | weekly + on PR | Builds, runs CLI `audit --runs 1`, posts PR comment |
| `cleanup.yml` (example app) | monthly | Identifies stale records |
| `sync-contributors.yml` (example app) | weekly | Fetches contributor data |
| `sync-github.yml` (example app) | weekly | Refreshes GitHub metadata |
| `readme.yml` (example app) | weekly | Regenerates the README awesome block |

## Dependency management

Neither Dependabot nor Renovate is configured. Renovate is the recommended choice because of better pnpm monorepo support (`enabledManagers: ['pnpm']`, per-package grouping, weekly schedule with auto-merge for non-major updates). A conservative initial `renovate.json`:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "packageRules": [
    {
      "matchDepTypes": ["devDependencies"],
      "matchUpdateTypes": ["minor", "patch"],
      "automerge": true,
      "groupName": "dev-deps"
    },
    {
      "matchUpdateTypes": ["major"],
      "automerge": false,
      "labels": ["major-update"]
    }
  ],
  "lockFileMaintenance": { "enabled": true }
}
```

## Supply-chain security

- **`pnpm audit`** runs weekly and catches known CVEs.
- **`dependency-review-action@v4`** (planned) gates PRs on new vulnerable deps from `pnpm-lock.yaml` diffs.
- **`onlyBuiltDependencies`** in `pnpm-workspace.yaml` (planned) allowlists install scripts.
- **Socket.dev GitHub App** (org-level, free for public repos) catches install-script and typosquat risks.

## Release automation

`scripts/release.mjs` is hand-rolled: builds each package, publishes in order (core → cli → astro → starlight), and writes version tags. The current script does not produce per-package changelogs or coordinate semver bumps across `workspace:*` deps.

[Changesets](https://github.com/changesets/changesets) is the recommended replacement — `pnpm changeset` on every PR, `changesets/action@v1` opens a "Version Packages" PR, and `pnpm version` coordinates the release. The migration is tracked in [Release process](/maintainers/release-process/).

## Related

- [Contributing](/maintainers/contributing/)
- [Security](/maintainers/security/)
- [Release process](/maintainers/release-process/)
- [Roadmap](/roadmap/)