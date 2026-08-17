---
title: Sync GitHub metadata
description: What grove sync github does, when it runs, and how to handle a failed or partial sync.
---

`grove sync github` enriches your record files with live data from the GitHub API — stars, forks, language, license, topics, last push date, archive state. The enriched data flows into the auto-derived health block, which is what your site actually renders.

This guide is for site maintainers who run (or schedule) sync. If you're a contributor adding a single record, you don't need to read this — the sync step is run by CI on your PR.

## The basic command

```bash
pnpm exec grove sync github
```

Reads every `.yml` file under `data/records/`, looks up each record's GitHub repo (from `repoUrl` or `links.github`), and writes a `github` block back into the record. Source of truth lives in `packages/cli/src/index.ts` (`command("sync")` at lines 83-186).

Useful flags:

- `--limit <n>` — sync only the first N records. Use this to test a change without hitting the GitHub rate limit on a large directory.
- `--strict` — exit non-zero if any record couldn't be synced. Use this in CI to fail the build on partial data.

Example with both:

```bash
pnpm exec grove sync github --limit 5 --strict
```

## What it writes into each record

The sync step adds (or updates) a `github` block. Before:

```yaml
slug: astro
name: Astro
repoUrl: https://github.com/withastro/astro
```

After a successful sync:

```yaml
slug: astro
name: Astro
repoUrl: https://github.com/withastro/astro
github:
  repository:
    full_name: withastro/astro
    stargazers_count: 49000
    forks_count: 2400
    open_issues_count: 850
    language: TypeScript
    pushed_at: "2025-10-14T12:34:56Z"
    archived: false
    license:
      spdx_id: MIT
      name: MIT License
    topics:
      - astro
      - static-site
  sync:
    syncedAt: "2025-10-15T08:00:00.000Z"
    source: api
```

The `github.sync.syncedAt` timestamp is how you tell when a record was last refreshed. The `source` field is `api` for the normal path and `html` for the fallback (see below).

## Two paths: API and HTML

For each record, the sync step tries the GitHub REST API first (`/repos/{owner}/{repo}`). If that succeeds, it writes the full metadata under `github.repository`. Source: `api`.

If the API call fails — rate limit, 404, network error — the step falls back to scraping the public repo HTML page. The HTML path can only extract license, language, topics, and homepage. It writes those into a `github.html` block instead of a `repository` block. Source: `html`.

If both fail, the record is left untouched and the sync step prints `skipped (api+html error)`. The exit code is zero unless you passed `--strict`.

### When you get HTML-only

`api → html` fallback is normal on shared CI runners. GitHub's REST API allows 60 unauthenticated requests per hour per IP; a 200-record directory will exhaust that in one run. The HTML fallback has no rate limit.

A record with `github.html` only (no `github.repository`) won't have `stargazers_count`, `forks_count`, or `pushed_at` in its data. The health block will show `unknown` for those records. Once a `GITHUB_TOKEN` is set in the environment, the API path succeeds and the data fills in.

## The auth story

`grove sync github` looks for a GitHub token in this order:

1. `GITHUB_TOKEN` environment variable
2. The token resolved by `gh auth token` (if the `gh` CLI is installed and authenticated)

If neither is set, the sync step runs unauthenticated. That's fine for small directories but rate-limits quickly on anything over 50 records.

For local dev, the simplest setup is to install and authenticate the `gh` CLI, then `grove sync github` picks it up automatically.

For CI, set `GITHUB_TOKEN` as a workflow secret. The `sync-github.yml` workflow that ships with the scaffold does this already.

## What "drift" looks like

A record has drifted when its `github.repository.pushed_at` is older than the record's `health.reasons` suggests it should be. Most often, this means:

- The repo was archived upstream and you didn't notice
- The repo was transferred to a new owner
- The repo was deleted and the URL now 404s

The cleanup step (`grove cleanup`, see [Maintain health signals](/content/health-classification/)) flags all of these. If the report has a sudden spike in `archived` or `unavailable` candidates, check the upstream before writing decisions — sometimes it's a transfer, and the new owner is actively maintaining the project.

## Scheduled sync

When you scaffold with `grove init`, the `sync-github.yml` workflow is generated. It runs `grove sync github` on a schedule and commits any changes back to the repo. The exact cadence is set in the workflow file — the default is weekly.

This is the right setup for a community-maintained directory. The schedule catches new stars, archive events, and transfers automatically. The commit cadence keeps the history reviewable: one PR-sized diff per week.

The schedule will pause if the workflow fails repeatedly. Watch the Actions tab; a "Sync GitHub metadata" run that fails three weeks in a row usually means a token expired or a config change broke something.

## Manual sync in CI

If you want a stricter setup, you can run `grove sync github --strict` as a required check on PRs. This forces every PR that touches `data/records/` to also update the GitHub-derived fields. The downside: PRs get slower, and a transient API failure blocks otherwise-good changes.

Most sites do the opposite — schedule sync weekly, accept the lag. The PRs touching record content go through normal review without sync in the loop.

## Handling a failed run

When `grove sync github` fails outright (exit non-zero), the cause is almost always one of:

- **`GITHUB_TOKEN` not set in CI** — the workflow log will show 401s. Add the secret.
- **Network partition in CI** — the log will show ECONNRESET. Re-run.
- **A record's `repoUrl` points at a 404** — the log shows `skipped (api+html error)` for that slug. Either fix the URL or remove the record.
- **A record's `repoUrl` is unparseable** — the log shows `unparseable repoUrl, skipping`. The URL isn't a github.com URL; fix it or set `links.github` instead.

In all cases, the records that *did* sync are still written. The CLI doesn't roll back partial state.

## What it does *not* do

- **It does not invent metadata.** If a record has no `repoUrl` and no `links.github`, the sync step skips it. It will not guess.
- **It does not change the `health` block directly.** The health block is computed at render time from `github.repository.pushed_at`, `archived`, and `stars`. Updating the `github` block changes the next render's health, but the `health` field on the record YAML is not touched.
- **It does not sync contributors.** `grove sync github` only touches `github.repository`, `github.html`, and `github.sync`. Contributor refresh lives in a separate command: `grove sync contributors` (see [CLI reference](/reference/cli/#grove-sync-contributors)).
- **It does not write to `data/health.yml`.** That file is a legacy format the validator no longer parses. The sync step manages `github.repository` on each record, which is the source of truth for the rendered health block.
