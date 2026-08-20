---
title: GitHub workflows
description: The six workflows grove init scaffolds, what each one actually runs, and how each commits its result back.
---

`grove init` copies six workflows into your space's `.github/workflows/`. Two
are CI and deploy; four are the maintenance cadence that keeps generated data
and the README from drifting. Every scheduled one is also
`workflow_dispatch`-able.

## The shipped workflows

| File | Trigger | What it runs |
|---|---|---|
| `ci.yml` | push to `main`, pull request | `grove check`, then `pnpm build` |
| `deploy.yml` | push to `main`, dispatch | `pnpm build` with `SITE_URL`, then GitHub Pages deploy |
| `sync-github.yml` | `0 3 * * 0` — Sunday 03:00 UTC | `grove sync github` |
| `sync-contributors.yml` | `0 4 * * 0` — Sunday 04:00 UTC | `grove sync contributors` |
| `readme.yml` | `0 4 * * 0` — Sunday 04:00 UTC | `grove readme generate` |
| `cleanup.yml` | `0 5 1 * *` — the 1st of each month, 05:00 UTC | `grove cleanup` |

All six pin `actions/checkout@v4`, `pnpm/action-setup@v4`, and
`actions/setup-node@v4` on Node 24 with pnpm caching, and install with
`pnpm install --frozen-lockfile`.

:::note[Why `cleanup.yml` is not on a "first Monday" cron]
When a cron expression restricts **both** day-of-month and day-of-week, POSIX
cron runs the job when **either** matches, not both — so the obvious-looking
`0 5 1-7 * 1` fires about ten times a month rather than once. If you want a
specific weekday, keep a plain day-of-month cron and add a guard step that
exits unless `date +%u` matches.
:::

:::note[There is no audit workflow in the scaffold]
`grove audit` is not wired into any scaffolded workflow. Run it locally, or
add a step yourself — see [Audit](/automation/audit/).
:::

## How each one commits back

They do not all use the same mechanism, and the difference matters.

**Pull request** — `sync-github.yml` and `readme.yml` both open a PR with
`peter-evans/create-pull-request@v6` rather than pushing to `main`. Record
YAML and `README.md` are files a human should look at before they land.
`readme.yml` checks `git diff --quiet README.md` first and skips the PR step
entirely when nothing changed.

```yaml
- uses: peter-evans/create-pull-request@v6
  with:
    commit-message: "chore(data): sync GitHub metadata"
    title: "Sync GitHub metadata"
    branch: chore/sync-github
    delete-branch: true
```

**Direct commit** — `sync-contributors.yml` pushes straight to the branch
with `stefanzweifel/git-auto-commit-action@v6`, scoped to exactly two paths:

```yaml
- uses: stefanzweifel/git-auto-commit-action@v6
  with:
    commit_message: "chore(data): sync contributors"
    file_pattern: data/generated/contributors.json data/generated/repo-stats.json
```

Contributor data is purely derived, so a review step would only add noise.

**No commit at all** — `cleanup.yml` runs with `permissions: contents: read`.
It pipes the command's console output to a file and appends it to the job
summary, so the report shows up in the Actions UI and nowhere else:

```yaml
- run: pnpm exec grove cleanup | tee cleanup-report.md
- run: cat cleanup-report.md >> "$GITHUB_STEP_SUMMARY"
```

Note that this captures `grove cleanup`'s printed summary, not the
`data/generated/cleanup-report.json` file the command writes.

## Permissions and tokens

`sync-github.yml` and `sync-contributors.yml` pass the built-in
`secrets.GITHUB_TOKEN` as `GH_TOKEN`. That is enough for the GitHub API
calls the sync makes against public repositories.

- `sync-github.yml` and `readme.yml` need `contents: write` and
  `pull-requests: write` to open their PRs.
- `sync-contributors.yml` needs `contents: write` to push.
- `cleanup.yml` needs only `contents: read`.
- `deploy.yml` declares `pages: write` and `id-token: write` at the workflow
  level for the Pages deployment.

## What you will change

- **Cadence.** The cron expressions are the only edit most sites need. Weekly
  keeps API usage low even with thousands of records.
- **`--strict`.** Both `grove sync github` and `grove cleanup` accept
  `--strict`, which sets a non-zero exit code — on failed records and on
  outstanding review candidates respectively. Neither scaffolded workflow
  passes it. Add it when you want the schedule to fail loudly.
- **`grove readme generate --check`.** Exits 1 when the rendered block differs
  from what is committed. Add it as a `ci.yml` step to stop PRs that leave the
  README behind, instead of waiting for the weekly PR.
- **`SITE_URL`.** `deploy.yml` reads it from repository variables
  (`vars.SITE_URL`). Set it, or canonical URLs and OG image paths point at the
  wrong origin.

## Related

- [Scheduled maintenance](/automation/scheduled/) — the cadence in context.
- [Sync GitHub metadata](/automation/sync-github/) — what the sync writes.
- [Sync contributors](/automation/sync-contributors/) — the aggregator.
- [Cleanup report](/automation/cleanup/) — what the report contains.
