---
title: Governance
description: How a Grove-powered directory is run — review cadence, who decides what, how to add or remove a maintainer.
---

This page is for the people who run a Grove-powered directory. The
contributor's perspective is in
[Contributing](/maintainers/contributing/); the release process for
the framework itself is in
[Release process](/maintainers/release-process/).

Grove is a framework, but a Grove-*powered directory* is its own
project. The governance of *your* directory is your decision, not the
framework's. This page describes the model that works well in
practice and that the example directory uses. Adapt to your needs.

## Roles

A typical Grove directory has three roles. They're not enforced by
code — they're conventions.

- **Maintainer** — has write access to the repo. Reviews and merges
  record PRs. Triages the cleanup report. Writes decisions. Tags
  releases of the directory's content.
- **Curator** — has read access to all records, write access to
  `data/decisions.yml` and `data/overrides.yml`. Doesn't merge
  record PRs but can mark records as `keep` / `hide` / `historical`.
- **Contributor** — anyone outside the maintainer team. Submits
  record PRs, opens issues, reviews PRs from other contributors.

Most directories start with 2-3 maintainers and no separate
curators.

## Review cadence

There is no required cadence. The example directory runs:

- **PR review** — within 7 days. A `good first issue` or
  `help wanted` label is the right signal that the maintainer team
  is asking for help.
- **Cleanup triage** — monthly, automated by the `cleanup.yml`
  workflow. The output lands as a workflow artifact; one maintainer
  walks it in a single sitting.
- **Sync review** — weekly, automated. The `sync-github.yml`
  workflow opens a PR (or commits directly to `main`, depending on
  your `integrations.github` setting). Maintainers review the diff
  for unexpected archive events or transfers.
- **Decision audit** — quarterly. One maintainer reads through
  `data/decisions.yml`, checks the dates, and confirms the older
  decisions still make sense.

If your directory is small (under 50 records), the cleanup and
decision-audit steps are mostly noise. The PR review and sync review
are the only ones that matter.

## Who decides what

The decision rights are deliberately narrow. The principle: changes
that affect *data* are content decisions; changes that affect *the
build* are engineering decisions; both are valid but need different
reviewers.

| Change | Who decides | How |
|---|---|---|
| Add a record | Maintainer review | PR review |
| Remove a record | Maintainer review | PR review (with a `remove` decision in the same PR) |
| Edit a record's content fields | Maintainer review | PR review |
| Edit a record's `health` block | **Auto**, not human | Don't — the sync step overwrites |
| Mark a record as `highlight` / `keep` / `hide` | Curator or maintainer | PR to `data/decisions.yml` |
| Add a new `category` | Maintainer review | The second record in a category is the PR that establishes it |
| Edit `grove.config.ts` | Maintainer review | PR review (often needs a second pair of eyes for breaking changes) |
| Edit theme tokens | Maintainer review | PR review |
| Edit the Astro template directly | Maintainer review | The template lives in your repo, so this is just code |
| Add a new maintainer | Existing maintainer team | See below |

## Adding a maintainer

There is no formal on-boarding checklist. The practical steps:

1. **The new maintainer has been a contributor first.** They've
   submitted record PRs, reviewed other PRs, and understand the
   directory's editorial bar. Most directories require at least
   3-6 months of contribution before maintainership is offered.
2. **The existing maintainer team agrees.** A directory with three
   maintainers should add a fourth only when all three agree.
3. **GitHub repo permissions are updated.** Add the new maintainer
   to the `Admin` (or `Maintain`, if your repo tier supports it)
   team. The change happens in the repo's Settings →
   Collaborators and teams.
4. **The new maintainer is added to any external channels** (Discord,
   Slack, mailing list).

The new maintainer should *not* immediately start merging PRs solo.
A 2-4 week shadow period — reviewing PRs with another maintainer,
but not merging — is a common pattern.

## Removing a maintainer

Maintainers leave. The graceful path:

1. **Step down voluntarily** — open an issue titled "Stepping down
   as maintainer". Tag the other maintainers.
2. **Inactive for 6+ months** — the remaining maintainers agree to
   remove the inactive member, with a 2-week notice via the issue
   tracker.
3. **Removed for cause** — a code of conduct violation, a public
   dispute that can't be resolved internally. The removal is
   immediate, governed by the
   [Code of Conduct](https://github.com/tortuvshin/grove/blob/main/CODE_OF_CONDUCT.md).

In all cases, the departing maintainer's write access is removed.
Their record PRs and decisions remain in the git history.

## Conflict resolution

PR review disagreements happen. The escalation path:

1. **In the PR thread.** Two maintainers disagree about whether a
   record belongs. The decision is documented in the PR.
2. **In an issue.** If the disagreement is editorial — "should
   this category exist at all?" — open an issue, link the PRs, and
   let other maintainers weigh in.
3. **In a maintainer meeting.** For directories that have a regular
   sync (a monthly video call, a quarterly retro), persistent
   disagreements go on the agenda.
4. **In a public post.** As a last resort, an editor can write a
   public post explaining a difficult call.

Most disagreements are at level 1.

## What "the framework" does and doesn't do

Grove the framework does not maintain a list of "official" Grove
directories. There is no central registry. A directory is
"official" only in the sense that its maintainers say so.

This means:

- **Your directory's governance is yours.** The framework does not
  impose a structure.
- **The framework's governance is separate.** The `@grove-dev/*`
  packages are maintained by the framework's own maintainer team.
- **Forks are welcome.** If a directory's governance goes in a
  direction you disagree with, fork it. The data is yours to take.
  The license is MIT.

## Tooling the framework does provide

A few governance-adjacent features ship with the framework:

- **The cleanup report**
  (`data/generated/cleanup-report.json`) is a list of records that
  need human review, generated by `grove cleanup`. The report is
  the natural agenda for a monthly triage.
- **The decisions file** (`data/decisions.yml`) is the audit log of
  editorial overrides. It is the natural artifact to share when a
  reader asks "why is this record hidden?".
- **The `pr-` labels** on issues and PRs are the framework's
  convention. The scaffolded `record_submission.md` issue template
  includes the labels the maintainer team is expected to use.

That's it. The framework does not host discussion threads, send
notifications, or do any community-management work.