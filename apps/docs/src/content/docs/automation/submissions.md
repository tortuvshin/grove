---
title: Community submissions
description: Accept new entries through GitHub issues and review them as pull requests before publishing.
---

The scaffolded `--github public` mode writes the contribution tooling:

- `.github/ISSUE_TEMPLATE/record_submission.md` — the "Submit a record" form. Fields mirror the record schema.
- `.github/ISSUE_TEMPLATE/report-broken-record.md` — report a broken entry.
- `.github/pull_request_template.md` — PR template for record additions.
- `src/pages/submit.astro` — the on-site submission page that generates a record-submission issue.

The maintainer team triages submissions → turns them into pull requests against `data/records/<slug>.yml` → `validate-data.yml` runs in CI → merge → `daily-refresh.yml` syncs metadata → site redeploys.

Every submission is a file. Every change is reviewable. The bot does not edit records directly.