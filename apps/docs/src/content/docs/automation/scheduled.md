---
title: Scheduled maintenance
description: The cadence that keeps a Grove site fresh without day-to-day maintainer intervention.
---

Grove's reference app (`apps/example` in the Grove repository) ships six workflow files under `.github/workflows/`: `ci.yml`, `deploy.yml`, `sync-github.yml`, `sync-contributors.yml`, `readme.yml`, and `cleanup.yml`. `grove init` installs the UI registry and config files only — it does not write workflows — so copy these into your own `.github/workflows/` as a starting point.

For the full inventory, see [GitHub workflows](/outputs/workflows/). This page covers what's actually scheduled, how each one delivers its result, and what to check before relying on it.

## What's on a schedule and what isn't

Only four of the six run on a cron. `ci.yml` runs on push to `main` and on pull requests; `deploy.yml` runs on push to `main` (plus `workflow_dispatch`). Neither has a `schedule:` trigger.

| Workflow | Cron | When that is |
|---|---|---|
| `sync-github.yml` | `0 3 * * 0` | Weekly, Sunday 03:00 UTC |
| `sync-contributors.yml` | `0 4 * * 0` | Weekly, Sunday 04:00 UTC |
| `readme.yml` | `0 4 * * 0` | Weekly, Sunday 04:00 UTC |
| `cleanup.yml` | `0 5 1-7 * 1` | See below — not just "first Monday" |

(`sync-contributors.yml` and `readme.yml` share the same time slot — both fire at 04:00 UTC on Sunday.) All four also have `workflow_dispatch:`, so you can re-run any of them on demand from the Actions tab without waiting for the cron.

:::caution[`cleanup.yml`'s cron fires more often than it looks]
`0 5 1-7 * 1` reads like "first Monday of the month," but cron's day-of-month and day-of-week fields are OR'd, not AND'd, whenever both are restricted (the standard POSIX cron rule — GitHub Actions' scheduler follows it too). With `1-7` in the day-of-month field and `1` (Monday) in the day-of-week field, the job actually runs at 05:00 UTC on **every day from the 1st through the 7th of the month, plus every other Monday** — roughly 10–11 runs a month, not one. If you want a true "first Monday only" schedule, add a step that checks the date (e.g. `[[ $(date +%d) -le 7 ]]`) and exits early on the other matching days, or trigger the job on a plain weekly cron and let `grove cleanup` be safely re-run.
:::

## How each one delivers its result

The four scheduled workflows don't all commit the same way:

- **`sync-github.yml`** runs `grove sync github`, then opens a pull request with [`peter-evans/create-pull-request@v6`](https://github.com/peter-evans/create-pull-request) on branch `chore/sync-github`. It does not push straight to `main`.
- **`sync-contributors.yml`** runs `grove sync contributors`, then commits straight to the current branch with [`stefanzweifel/git-auto-commit-action@v6`](https://github.com/stefanzweifel/git-auto-commit-action), scoped to `data/generated/contributors.json` and `data/generated/repo-stats.json`.
- **`readme.yml`** runs `grove readme generate`, diffs `README.md` with `git diff --quiet`, and only if that changed, opens a pull request with `peter-evans/create-pull-request@v6` on branch `chore/readme-regenerate`.
- **`cleanup.yml`** runs `grove cleanup | tee cleanup-report.md` and appends that file to `$GITHUB_STEP_SUMMARY`. It does not commit or open a PR at all — its permissions block is `contents: read`, so there's nothing for it to write back. It's a report for a human to act on, not an automated change.

Both `sync-github.yml` and `sync-contributors.yml` pass `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` to the `grove sync` step for GitHub API calls, and the PR/commit actions use that same automatically-provided token — no separate secret to create. What you do need to check in the repo's Settings → Actions → General: "Workflow permissions" must allow read/write, and if you want the opened PRs to trigger `ci.yml` in turn, "Allow GitHub Actions to create and approve pull requests" needs to be on. Without those, the token GitHub injects is read-only and the write/PR steps fail.

## What a hand-rolled commit-back step looks like

If you write your own scheduled workflow — for example, wiring [`grove readme generate --check`](/automation/readme/) into `ci.yml` instead of relying on the weekly PR — the direct-commit shape already shipped in `sync-contributors.yml` is a safe pattern to copy:

```yaml
permissions:
  contents: write
steps:
  - uses: actions/checkout@v4
  - uses: pnpm/action-setup@v4
  - uses: actions/setup-node@v4
    with:
      node-version: "24"
      cache: pnpm
  - run: pnpm install --frozen-lockfile
  - run: pnpm exec grove sync contributors
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  - uses: stefanzweifel/git-auto-commit-action@v6
    with:
      commit_message: "chore(data): sync contributors"
      file_pattern: data/generated/contributors.json data/generated/repo-stats.json
```

Scope `file_pattern` to exactly what the command writes — an unscoped commit action will pick up any other uncommitted changes in the runner's working tree.

## What only humans do

- **Curation.** Promotions, demotions, decisions recorded in `data/decisions.yml`, record add/remove. None of the scheduled workflows touch visibility.
- **Conflict resolution.** Two records that should be merged, two collections that overlap — humans decide.
- **Build failures.** `ci.yml` runs `grove check` on every push to `main` and every pull request; a non-zero exit blocks that job (add `--strict` yourself if you also want warnings to fail the build — the shipped `ci.yml` doesn't pass it by default).

## See also

- [GitHub workflows](/outputs/workflows/) — the file-by-file inventory.
- [Sync GitHub metadata](/automation/sync-github/) — what `grove sync github` writes.
- [Sync contributors](/automation/sync-contributors/) — what `grove sync contributors` aggregates.
- [Cleanup report](/automation/cleanup/) — what `grove cleanup` surfaces.
- [Generate README](/automation/readme/) — what `grove readme generate` writes, and the sentinel model behind `readme.yml`.
- [grove check](/automation/check/) — the CI gate `ci.yml` runs on every push and PR.
