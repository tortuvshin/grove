---
title: Health as a derived signal
description: How Grove surfaces records that need attention without ever deleting them.
---

# Health as a derived signal

Health is a derived signal on `project` records. The framework refreshes it from GitHub signals; curators never edit it by hand. The signal drives list ordering, cleanup review, and per-record detail-page warnings.

The framework does **not** delete records based on health. The strongest action is `cleanupCandidate: true`, which surfaces the record in `grove cleanup`'s report.

## What `health` contains

```yaml
health:
  status: active                  # see enum below
  maturity: useful                # experimental | useful | mature | unknown
  tier: listed                    # curated | listed | experimental | hidden
  visibility: keep                # matches DecisionVisibility
  cleanupCandidate: false
  staleReason: null
  confidence: medium              # low | medium | high
  reasons:
    - last-commit-2026-01
    - 5-stars-this-month
```

The block lives on `project` records only. `resource` and `entity` records don't have a `health` block — their visibility decisions live in `data/decisions.yml` or in the record's top-level `visibility:`.

## Status enum

```text
active · mature · stale · inactive · archived · unknown
historical · needs_review · quiet · unavailable
```

`active` and `mature` are the two healthy states. `stale`, `inactive`, and `archived` are signals a curator should pay attention to. `unknown` is the default — meaning "we have no signal yet." `historical` is curator-set (the record belongs to the project but is no longer maintained). `needs_review`, `quiet`, and `unavailable` are operational signals used by the cleanup pipeline.

## Tier

```text
curated · listed · experimental · hidden
```

`curated` means the record is verified and high-quality. `listed` is the default. `experimental` warns the visitor it's early. `hidden` removes the record from listings (overridable via a `decisions.yml` entry).

## What refreshes the health block

`grove sync github` calls `classifyHealth()` from `packages/core/src/health.ts` for each record. The classification uses GitHub signals:

- `archived: true` → `status: archived`.
- No commits in 365 days and `stargazers_count < 10` → `status: stale`, `cleanupCandidate: true`.
- High recent activity + growing stars → `status: active`.
- Below-average docs (no `README` files in common locations) → `confidence: low`.
- And so on. The full rule set lives in `packages/core/src/health.ts:classifyHealth`.

The classifier doesn't pull from any local state; the inputs are the GitHub API + the record's existing YAML.

## `cleanupCandidate: true`

This is the only field a curator should pay attention to immediately. When `cleanupCandidate` flips to `true` on a record:

1. The record surfaces in `data/generated/cleanup-report.json` after the next `grove cleanup` run.
2. The `cleanup` and `cleanup.yml` workflows surface it in PR descriptions and Step Summaries.
3. The curator decides: keep as-is, edit `visibility`/`decisions.yml`, or hide via `curation`.

Grove never deletes a record. The candidate list is a triage inbox, not an action queue.

## Override mechanism

`health` is computed each sync, but the **effective visibility** is the union of `health.visibility` and the record's top-level `visibility` plus any `decisions.yml` entry. The highest-priority signal wins:

1. `data/decisions.yml` (most explicit; curator decision).
2. The record's top-level `visibility`.
3. `health.visibility` (derived from GitHub).

A curator who wants a record visible regardless of GitHub status sets `visibility: keep` on the record. A curator who wants a record hidden regardless of GitHub status sets `visibility: hide` or adds a `decisions.yml` entry.

## How cleanup differs from sync

- `grove sync github` writes `github.*` and `health.*` blocks. It overwrites only the sync surface. Curator additions outside the surface survive a re-run.
- `grove cleanup` doesn't write to records at all. It writes `data/generated/cleanup-report.json` based on a read of the current state. Curators read the report and act via the record YAML or `data/decisions.yml`.

## Why this matters

A directory that's accurate today will rot within months unless someone (or something) keeps watching it. Grove's health signal makes that watching explicit:

- machines fetch the facts (`grove sync github`)
- the framework classifies (`classifyHealth`)
- humans review (`grove cleanup`)
- humans decide (record YAML or `decisions.yml`)

The curator's editorial judgment stays central. Machines don't get to delete your records.

## See also

- [Health classification](/content/health-classification/) — the full schema reference for the `health` block.
- [Cleanup report](/automation/cleanup/) — what `grove cleanup` writes and how to act on it.
- [Sync GitHub metadata](/automation/sync-github/) — the upstream pipeline that classifies.
