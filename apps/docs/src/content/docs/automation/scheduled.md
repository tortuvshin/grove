---
title: Scheduled maintenance
description: The cadence that keeps a Grove site fresh without day-to-day maintainer intervention.
---

# Scheduled maintenance

Grove ships six workflow files under `.github/workflows/` that you can enable right after `grove init`. They keep external facts current, surface stale records for review, and regenerate the README block — without you writing any cron expressions yourself.

For the full inventory, see [GitHub workflows](/outputs/workflows/). This page covers the **cadence** and the lifecycle.

## The cadence

```text
source files
    │
    ▼
sync external facts
    │
    ▼
validate
    │
    ▼
identify unhealthy/stale records
    │
    ▼
human review
    │
    ▼
build
    │
    ▼
deploy
```

The defaults ship:

| Workflow | When | Job |
|---|---|---|
| `sync-github.yml` | weekly (Sunday 03:00 UTC) | Update `github.*` and `health.*` blocks |
| `sync-contributors.yml` | weekly (Sunday 04:00 UTC) | Aggregate contributor counts |
| `readme.yml` | weekly (Sunday 04:00 UTC) | Regenerate the README block |
| `cleanup.yml` | monthly (first Monday 05:00 UTC) | Surface candidates for review |

The first three keep external facts fresh. The fourth identifies records that need a human to look at them. The default gap between facts-refresh (weekly) and cleanup (monthly) gives a week's worth of new GitHub data to inform the triage.

## What machines do

The four workflows above are fully automated:

- They commit back to the same branch via `GITHUB_TOKEN` (no separate secret required).
- They use `workflow_dispatch` so you can re-run any of them on demand.
- They print a Step Summary on each run summarizing what changed (number of records updated, cleanup candidate count).

## What only humans do

- **Curation.** Promotions, demotions, decisions in `data/decisions.yml`, record add/remove. There is no automation that touches visibility without a human in the loop.
- **Conflict resolution.** Two records that should be merged, two collections that overlap — humans decide.
- **Build failures.** When `grove check --strict` returns non-zero, a maintainer investigates.

## See also

- [GitHub workflows](/outputs/workflows/) — the file-by-file inventory.
- [Sync GitHub metadata](/automation/sync-github/) — what `grove sync github` writes.
- [Sync contributors](/automation/sync-contributors/) — what `grove sync contributors` aggregates.
- [Cleanup report](/automation/cleanup/) — what `grove cleanup` surfaces.
- [Generate README](/automation/readme/) — what `grove readme generate` writes.
- [grove check](/automation/check/) — the CI gate.
