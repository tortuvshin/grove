---
title: Decisions and curation
description: Curator overrides — visibility, sort priority, rename, label.
---

# Decisions and curation

Curators shape how a Grove space presents its records through two surfaces:

1. **The record's own YAML** — `curation.{reviewed,reviewedBy,reviewedAt,notes,labels,lenses}`, plus `visibility`, `scores`, and the optional `health` block.
2. **`data/decisions.yml`** — site-level overrides keyed by record id. Each entry changes how one record is presented.

The record-level fields are usually enough. `data/decisions.yml` is for the cases where a curator wants one source of truth across the whole site rather than editing many records.

## Visibility

`visibility` is the canonical signal for "should the visitor see this record?"

| Value | Effect |
|---|---|
| `highlight` | Promote in listings, summary cards, and lens outputs. |
| `keep` | Default. Listed normally. |
| `needs_review` | Listed but flagged. Detail pages show a review banner. |
| `hide` | Excluded from listings and search. Direct links still resolve. |
| `remove` | Excluded from listings, search, and detail pages. The record YAML remains in git. |
| `historical` | Listed but de-emphasized. The lens for "historical" surfaces these in a dedicated section. |

`remove` and `hide` differ in one way: `remove` takes the record out of detail-page URLs too (a direct link resolves but the page renders a tombstone). `hide` keeps the detail page addressable.

## What lives on the record vs in `data/decisions.yml`

Use the record's `visibility:` for the common case — you want a single record hidden or highlighted.

Use `data/decisions.yml` when:

- The override should be visible at a glance, in one file, rather than scattered across records.
- The override includes `reason` plus `reviewedBy` / `reviewedAt`, which the record's `visibility:` doesn't carry.
- The override changes `renameSlug` (used by `routes.item`) or `sortPriority` for a single record without rewriting it.

```yaml
# data/decisions.yml
- id: my-record
  decision:
    visibility: hide
    reason: Archived in 2024; awaiting re-launch announcement.
    reviewedBy: maintainer-name
    reviewedAt: "2026-04-01"
- id: another-record
  decision:
    visibility: highlight
    sortPriority: 1
    renameSlug: feature-record
    reason: Reviewed and re-curated for the 2026 launch.
```

## `data/decisions.yml` shape

```yaml
# data/decisions.yml accepts either a list or { decisions: [...] }
- id: <record-slug>
  decision:
    visibility: <enum>
    reason: <string, ≥1 char>
    reviewedBy: <string, optional>
    reviewedAt: <string, optional ISO timestamp>
```

Each entry must include `id` (matching a record `slug`) and `decision.visibility` plus `decision.reason`. The optional fields identify who reviewed and when.

## Curation labels

`curation.labels` is a curator-applied tagging system that's independent of `tags`. Labels drive lenses:

| Label | Effect |
|---|---|
| `featured` | Surfaces in the `featured` lens. |
| `hot` | Surfaces in the `hot` lens (high recent activity). |
| `new` | Surfaces in the `new` lens. |
| `mature` | Surfaces in the `mature` lens. |

Lenses compose; a single record can carry several labels.

## Scores

`scores.{activity,maturity,learning,contribution,docs,overall}` is a 0-100 scale per axis. The framework uses `overall` as the default ranking when no other sort is selected. The framework also derives a `tier` from these scores in some cases (e.g., `health.tier: curated` requires `overall >= 80`).

## What curators should never do

- Don't edit generated files under `data/generated/`. They are pure output.
- Don't manually set `health.*` — let `grove sync github` write it. You CAN override `health.visibility` via a record-level `visibility:` if the auto-derived value is wrong.
- Don't delete a record to "remove" it. Use `visibility: remove` instead. Git history preserves the record.

## See also

- [Decisions file](/content/decisions/) — file shape and examples.
- [Health classification](/content/health-classification/) — the `health.*` block and `cleanupCandidate: true`.
