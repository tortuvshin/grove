---
title: Scheduled maintenance
description: Keep your directory healthy through scheduled GitHub Actions. Sync metadata, aggregate contributors, and triage stale records.
---

The `--github public` mode writes three scheduled workflows:

- `daily-refresh.yml` — daily. Combines the metadata sync and the cleanup report.
- `sync-github-metadata.yml` — refreshes stars, forks, last-pushed dates, license, language.
- `sync-contributors.yml` — aggregates contributor data across all repositories into `data/generated/contributors.json`.
- `cleanup-stale-records.yml` — produces `data/generated/cleanup-report.json` listing records that need human review (archived repos, missing licenses, stale forks).

Run any of them manually:

```bash
grove sync github
grove sync contributors
grove cleanup
```

Use the cleanup report as the agenda for a monthly triage. Use the decision file (`data/decisions.yml`) to record visibility overrides (`highlight`, `keep`, `needs_review`, `hide`, `remove`, `historical`).

Full guides: **[Maintain health signals](/guides/maintain-health-signals/)** · **[Manage decisions](/guides/manage-decisions/)**