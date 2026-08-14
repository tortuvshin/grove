---
title: Scheduled maintenance
description: Keep your directory healthy through scheduled GitHub Actions. Sync metadata, aggregate contributors, and triage stale records.
---

`grove init` writes four scheduled GitHub Actions workflows under `.github/workflows/`. Together they keep a directory fresh without maintainer intervention: stars stay current, contributors are aggregated, stale records are flagged, and the README is regenerated.

## The four workflows

### `sync-github.yml` — weekly

Refreshes GitHub metadata for every record:

```yaml
on:
  schedule:
    - cron: "0 3 * * 1"      # Monday 03:00 UTC
  workflow_dispatch:        # manual trigger
```

The workflow runs `grove sync github`, which fetches `https://api.github.com/repos/<owner>/<repo>` for each record, writes back the `github.repository` block, and opens a PR with the diff if anything changed.

For very large directories (>5,000 records), schedule the workflow daily and use `--limit` to batch:

```bash
grove sync github --limit 500   # in the workflow
```

Set `GITHUB_TOKEN` (or `GH_TOKEN`) as a repository secret to raise the rate limit from 60 to 5,000 requests/hour.

### `sync-contributors.yml` — weekly

Aggregates contributor data across the configured repository:

```yaml
on:
  schedule:
    - cron: "0 4 * * 0"      # Sunday 04:00 UTC
  workflow_dispatch:
```

The workflow runs `grove sync contributors`, which calls `site.repoUrl`'s contributors endpoint and writes:

- `data/generated/contributors.json` — array of `{ login, name, avatarUrl, count }`.
- `data/generated/repo-stats.json` — aggregate stats (total contributors, top contributors, contribution timeline).

The scaffold's `src/pages/contributors.astro` page reads `contributors.json` and renders a contributors wall. Disable the page in `src/pages/` if you don't want it.

### `cleanup.yml` — monthly

Produces a triage report for human review:

```yaml
on:
  schedule:
    - cron: "0 5 1 * *"      # 1st of the month, 05:00 UTC
  workflow_dispatch:
```

The workflow runs `grove cleanup`, which writes `data/generated/cleanup-report.json`:

```json
[
  {
    "slug": "old-tool",
    "reason": "inactive",
    "stars": 12,
    "lastCommit": "2024-03-01",
    "suggestion": "Decide: keep, hide, or remove via decisions.yml"
  },
  ...
]
```

The criteria for "needs review":

- `health.status` is `stale`, `archived`, or `inactive`.
- `health.cleanupCandidate` is `true`.
- License is missing or non-standard.
- Repo URL no longer resolves (verified by `grove sync github` HTML fallback).

The CLI does not delete or hide records — that's a curator's call, made via `decisions.yml`. The workflow opens a PR with the report; the maintainer reviews and acts.

### `readme.yml` — weekly

Regenerates the awesome-list README block:

```yaml
on:
  schedule:
    - cron: "0 6 * * 2"      # Tuesday 06:00 UTC
  workflow_dispatch:
```

The workflow runs `grove readme generate`, which renders the block between the `<!-- grove-readme:start -->` and `<!-- grove-readme:end -->` sentinels in `README.md`. If anything changed, the workflow opens a PR with the diff.

Disable this workflow if you curate the README by hand. The bot regenerates from records, so it overwrites hand-edited content inside the sentinels (content outside the sentinels is preserved).

## Manual triggers

Every workflow supports `workflow_dispatch`. To run one manually:

1. Go to the repository's **Actions** tab.
2. Select the workflow from the left sidebar.
3. Click **Run workflow** → **Run workflow**.

Or locally:

```bash
grove sync github                # enrich every record with live metadata
grove sync contributors          # aggregate contributor data
grove cleanup                    # produce the triage report
grove readme generate --check    # verify the README is up to date (no write)
```

## Sizing the workflows

The default schedules are designed for directories with < 1,000 records and a single maintainer. For larger directories:

| Records | Recommended cron | Token required |
|---|---|---|
| < 100 | Weekly (default) | No |
| 100 - 1,000 | Weekly + `--limit 1000` per run | Recommended |
| 1,000 - 5,000 | Daily + `--limit 500` per run | Required |
| > 5,000 | Daily + batched runs across the week | Required |

For very active directories, the contributors sync may want a daily cadence too — adjust the cron:

```yaml
on:
  schedule:
    - cron: "0 4 * * *"      # daily at 04:00 UTC
```

## Branching strategy

The workflows auto-commit back to a branch. The default is to commit directly to `main` if the change is small, or open a PR otherwise. To force PRs always:

```yaml
# .github/workflows/sync-github.yml
permissions:
  contents: write
  pull-requests: write
steps:
  - ...
  - run: git checkout -b chore/sync-github-$(date +%Y%m%d)
  - run: grove sync github
  - run: |
      git add data/records/
      git diff --staged --quiet || git commit -m "chore: sync github metadata"
      git push origin HEAD
      gh pr create --title "chore: sync github metadata" --body "Weekly sync run." --base main
```

This pattern works for both individual repos and org-wide directories.

## Token permissions

The workflows need:

- `contents: write` — to push the auto-commit.
- `pull-requests: write` — to open the PR.

For the GitHub sync, `GITHUB_TOKEN` is provided automatically by Actions. The default `GITHUB_TOKEN` has read access to public repos; for private repos, configure a PAT or GitHub App with `repo` scope.

For the contributors sync, `GH_TOKEN` or `GITHUB_TOKEN` is required.

For the cleanup and readme workflows, no token is needed — they operate on local files.

## Failure handling

The workflows don't auto-retry on failure. If a sync fails (rate limit, network error), the next scheduled run will retry. The workflow's failure appears in the Actions tab; the maintainer can re-run it manually.

For noisy transient failures (rate limits), use `grove sync github --limit` to keep each run under the rate limit:

```bash
# .github/workflows/sync-github.yml
- run: grove sync github --limit 800    # safe margin under 5000/hr
```

## Disabling workflows

To disable a workflow you don't need:

1. Delete the file under `.github/workflows/`, or
2. Add a conditional:

```yaml
on:
  schedule:
    - cron: "0 3 * * 1"
  workflow_dispatch:
  # Manually disable via the Actions tab if not needed.
```

For directories that don't need the README workflow (because the README is curated by hand), delete `.github/workflows/readme.yml` outright.

## Maintenance checklist

| Cadence | Task | Tool |
|---|---|---|
| Weekly | Sync GitHub metadata | `sync-github.yml` |
| Weekly | Aggregate contributors | `sync-contributors.yml` |
| Monthly | Triage cleanup report | `cleanup.yml` + reviewer |
| Quarterly | Review taxonomy for orphans | `grove check --strict` |
| Quarterly | Check decisions for stale `hide` | manual |
| Annually | Audit `integrations.github` token | manual |

The first three are automated. The last three are human work.

## Related

- [GitHub metadata sync](/automation/github-metadata/) — what `grove sync github` does in detail
- [Validation](/automation/validation/) — what `grove check` enforces
- [Community submissions](/automation/submissions/) — the PR-driven ingestion flow
- [Maintainers — CI quality](/maintainers/ci-quality/) — Biome, lychee, Codecov, Lighthouse, Renovate