---
title: GitHub workflows
description: Scheduled sync, audit, cleanup, and readme jobs.
---

# GitHub workflows

The default scaffold ships six workflows under `.github/workflows/`. They keep `health.*`, `cleanup-report.json`, contributor data, and `README.md` fresh without human intervention. Every workflow is `workflow_dispatch`-able for on-demand runs.

## The shipped workflows

| Workflow | Trigger | Schedule | What it does |
|---|---|---|---|
| `ci.yml` | push to main, PR | — | `grove check`, Astro build |
| `deploy.yml` | push to main, dispatch | — | build + Pages deploy |
| `sync-github.yml` | dispatch | weekly, Sunday 03:00 UTC | `grove sync github`; auto-commits `github.sync.syncedAt` changes |
| `sync-contributors.yml` | dispatch | weekly, Sunday 04:00 UTC | `grove sync contributors`; auto-commits `data/generated/contributors.json` |
| `cleanup.yml` | dispatch | monthly, first Monday 05:00 UTC | `grove cleanup --strict`; surfaces `cleanup-report.json` in the Step Summary |
| `readme.yml` | dispatch | weekly, Sunday 04:00 UTC | `grove readme generate`; opens a PR with the regenerated README block |

`grove audit` is part of `ci.yml`'s Lighthouse step (`audit.pages[]` from `grove.config.ts`); there is no separate `audit.yml` workflow file.

## How sync workflows commit

`sync-github.yml` and `sync-contributors.yml` use `GITHUB_TOKEN` (provided automatically by `actions/checkout` + a configured `permissions: contents: write`) to commit back to the same branch. The pattern:

```yaml
- uses: actions/checkout@v4
- run: pnpm install --frozen-lockfile
- run: pnpm exec grove sync github
- run: |
    if [[ -n "$(git status --porcelain)" ]]; then
      git config user.name "grove-bot"
      git config user.email "grove-bot@users.noreply.github.com"
      git commit -am "chore: refresh GitHub metadata"
      git push
    fi
```

## Why this shape

- **Weekly cadence** keeps GitHub API usage low even for sites with thousands of records.
- **Sunday 03:00 UTC** is after the GitHub week but before most maintainers' Mondays.
- **`workflow_dispatch`** lets a curator re-run any of these on demand without waiting for the cron.
- **Strict mode** in `cleanup.yml` makes the workflow fail when there are candidates, so triage cadence is enforced by CI.
- **`--check`** is the inverse — fail when content drifts. `readme.yml` could be wired to use `--check` to enforce that PR authors don't leave the README behind.

## What you'll customize

- **Schedule** — the cron expressions in `sync-github.yml`, `sync-contributors.yml`, `cleanup.yml`, `readme.yml` are the only customization most sites need.
- **Token permissions** — Sites that don't want bots committing back can drop the `contents: write` permission and accept stale `github.*` blocks until a human re-runs the sync.
- **Re-run policy** — Add `if: github.event_name == 'schedule'` to the dispatch run, or vice versa, depending on whether dispatch should bypass a maintainer check.

## What this page deliberately does NOT promise

- Real-time sync on every push (the schedule is weekly).
- Per-record sync triggers based on upstream events (the sync reads every record each run).
- Centralized maintenance of multiple Groves from one workflow (each site has its own `apps/example`).
- Larger surfaces (RSS, JSON Feed) — see the roadmap at [Project > Roadmap](/project/roadmap/).

## See also

- [Sync GitHub metadata](/automation/sync-github/) — the `grove sync github` pipeline.
- [Sync contributors](/automation/sync-contributors/) — the contributors aggregator.
- [Cleanup report](/automation/cleanup/) — what the cleanup workflow writes.
- [Scheduled maintenance](/automation/scheduled/) — the broader maintenance cadence.
