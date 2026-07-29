---
title: Community submissions
description: Accept new entries through GitHub issues and review them as pull requests before publishing.
---

The scaffold writes the contribution tooling:

- `.github/ISSUE_TEMPLATE/record_submission.md` — the "Submit a
  record" form. Fields mirror the record schema.
- `.github/ISSUE_TEMPLATE/bug_report.md` and
  `.github/ISSUE_TEMPLATE/feature_request.md` — generic feedback
  templates.
- `src/pages/submit.astro` — the on-site submission page that
  generates a record-submission issue and a YAML draft the
  contributor copies into a PR.

The maintainer team triages submissions → turns them into pull
requests against `data/records/<slug>.yml` → `ci.yml` runs
`grove check` + `astro build` in CI → a maintainer merges →
`sync-github.yml` enriches the record with live metadata → the site
redeploys via `deploy.yml`.

Every submission is a file. Every change is reviewable. The bot does
not edit records directly.