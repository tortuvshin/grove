---
title: CI & quality
description: What actually runs on every Grove pull request, what runs on a schedule, and what is configured but not yet enforced.
---

This page covers the CI pipeline for Grove itself — the `@grove-dev/*` packages, the CLI, and this docs site's contract with the implementation. It does not cover the gate a *record* PR runs (that's `grove check --strict`; see [Contributing](/maintainers/contributing/)), and it does not cover the six workflows a scaffolded space ships with (`apps/example`'s own CI, sync, and cleanup jobs) — see [Scheduled automation](/automation/scheduled/) for those.

## On every PR

`.github/workflows/ci.yml` runs four jobs on every push to `main` and every pull request against `main`:

| Job | What it runs |
|---|---|
| **Build & type-check** | `pnpm install --frozen-lockfile`, `pnpm -r build`, `pnpm -r check` |
| **Scaffold smoke test** | rebuilds, then `pnpm test:scaffold` (needs Build) |
| **Unit tests (vitest)** | rebuilds, then `pnpm test` — the Vitest 4 `projects` suite across `@grove-dev/{core,astro,cli,starlight}` (needs Build) |
| **Repo hygiene** | four checks, listed below |

The "Repo hygiene" job (`lint` in the workflow file) runs:

1. Fails if any `.DS_Store` file is committed.
2. Fails if `"workspace:*"` appears anywhere outside a `peerDependencies`/`peerDependenciesMeta` block in `packages/*/package.json` or the root `package.json`.
3. `pnpm docs:check` — see below.
4. `pnpm icons:check` — asserts the committed icon SVGs are byte-for-byte what `scripts/sync-icons.mjs` regenerates from `scripts/icons.config.mjs`.

`.github/workflows/lighthouse-audit.yml` runs separately from `ci.yml`, but also on every pull request and push to `main` when the change touches `packages/core/**`, `packages/cli/**`, `packages/astro/**`, `apps/example/**`, or the workflow file itself (plus a weekly cron). It builds `apps/example`, boots `astro preview`, and runs `node packages/cli/dist/index.js audit --runs 3 --json ... --junit ...`, which exits non-zero on any Lighthouse budget violation. The workflow's own comment notes that turning a regression into a hard merge block additionally requires this workflow to be added to the repository's branch-protection required-checks — that setting lives in GitHub's repo configuration, not in this codebase, so this page can't confirm whether it's on.

### Biome — configured, not run in CI

`biome.json` at the repo root configures a formatter and a linter (`pnpm lint`, `pnpm lint:fix`, `pnpm format`, and `pnpm format:check` all exist as root scripts). No workflow invokes `biome` anywhere in this repository — it is not part of the "Repo hygiene" job or any other job. A contributor's local `pnpm lint` result has no effect on CI today.

### Vitest coverage — configured, not enforced in CI

`vitest.config.ts` declares coverage thresholds (`statements: 58`, `branches: 42`, `functions: 54`, `lines: 60`), calibrated just under the measured baseline at the time. The "Unit tests" job runs plain `pnpm test` (`vitest run`, no `--coverage`), so those thresholds never evaluate in CI — the coverage report only appears when a contributor runs `pnpm test:coverage` locally.

### Docs contract checks

`pnpm docs:check` runs three scripts in order:

1. **`scripts/check-docs-contract.mjs`** — cross-references the documented surface against the implementation: every CLI command registered in `packages/cli/src/index.ts` / `*-cli.ts` must be mentioned somewhere under `apps/docs/src/content/docs/`; every named export from `packages/core/src/index.ts` and `packages/astro/src/index.ts` must appear in `reference/api-core.md`, `reference/components.mdx`, or another docs page; every top-level field of `groveConfigSchema` must appear in `reference/config.md` or elsewhere.
2. **`scripts/check-starlight-sidebar.mjs --check-orphans`** — every slug referenced in `astro.config.mjs`'s sidebar must resolve to a real file, and every file under `apps/docs/src/content/docs/` must be reachable from the sidebar or `navLinks` (no orphan pages).
3. **`scripts/check-starlight-internal-links.mjs`** — every `/path/` link found in the docs content resolves to a real `.md`/`.mdx` file.

## Scheduled jobs (Grove's own)

| Workflow | Schedule | What it does |
|---|---|---|
| `audit.yml` | weekly, Monday 06:00 UTC — plus PRs/pushes touching `package.json`, `pnpm-lock.yaml`, or a package manifest | `pnpm audit --prod --audit-level=high --ignore GHSA-jmr9-qjv8-65gv`; a separate dev-deps audit step runs with `continue-on-error: true` and can't fail the job. |
| `lighthouse-audit.yml` | weekly, Monday 06:37 UTC — plus the path-scoped PR/push trigger above | Builds `apps/example`, runs `grove audit --runs 3`, uploads the JSON/JUnit report as a workflow artifact, and posts (or updates) a scorecard comment on the triggering PR. |

## Dependency management

`.github/dependabot.yml` is configured — weekly, Mondays, two ecosystems: `npm` at the repo root (with a `grove-internal` dependency group for `@grove-dev/*`, which is then explicitly `ignore`-d, since the release script owns `workspace:*` rewrites) and `github-actions`. Renovate is not configured.

## Supply-chain security

The supply-chain automation that actually runs is **`pnpm audit`** in `audit.yml` (above) and Dependabot's weekly update PRs. There is no `dependency-review-action`, no `pnpm.onlyBuiltDependencies` allowlist, and no third-party dependency-scanning app configured in this repository.

## Release automation

`scripts/release.mjs` is a hand-rolled script, not a CI workflow — no GitHub Actions job publishes a release. It builds every package, bumps the four published package manifests together, and publishes them in dependency order: `core → astro → cli → starlight`. See [Release process](/maintainers/release-process/) for the full mechanics, and for why Grove hasn't (yet) adopted Changesets.

## Related

- [Contributing](/maintainers/contributing/)
- [Security](/maintainers/security/)
- [Release process](/maintainers/release-process/)
- [Roadmap](/project/roadmap/)
