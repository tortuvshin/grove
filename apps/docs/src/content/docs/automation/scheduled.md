---
title: Scheduled maintenance
description: Keep your directory healthy through scheduled GitHub Actions. Sync metadata, aggregate contributors, and triage stale records.
---

The scaffold (`grove init`) writes four scheduled GitHub Actions
workflows under `.github/workflows/`:

- `sync-github.yml` — weekly. Refreshes stars, forks, last-pushed
  dates, license, language, and topics for every record.
- `sync-contributors.yml` — weekly. Aggregates contributor data
  across the configured repository and writes
  `data/generated/contributors.json` and `data/generated/repo-stats.json`.
- `cleanup.yml` — monthly. Produces
  `data/generated/cleanup-report.json` listing records that need
  human review (archived repos, missing licenses, stale forks).
- `readme.yml` — weekly. Regenerates the awesome-list README block
  between the `<!-- grove-readme:start -->` and
  `<!-- grove-readme:end -->` sentinels and opens a PR with the
  diff. Disable it if you curate the README by hand.

Run any of them manually:

```bash
grove sync github
grove sync contributors
grove cleanup
grove readme generate --check
```

Use the cleanup report as the agenda for a monthly triage. Use the
decision file (`data/decisions.yml`) to record visibility overrides
(`highlight`, `keep`, `needs_review`, `hide`, `remove`,
`historical`).

Full guides: **[Maintain health signals](/guides/maintain-health-signals/)**
· **[Manage decisions](/guides/manage-decisions/)**
· **[Sync GitHub metadata](/guides/sync-github-metadata/)**