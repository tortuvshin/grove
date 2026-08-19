---
title: Cleanup report
description: Surface records that need human review without deleting them.
---

`grove cleanup` reads the current record set, classifies candidates, and writes `data/generated/cleanup-report.json`. **The command never deletes records.** It surfaces a triage list; curators act via the record YAML or `data/decisions.yml`.

## Prerequisites

None. Runs unconditionally.

## Usage

```bash
pnpm exec grove cleanup           # writes the report
pnpm exec grove cleanup --strict  # exits 1 when there are candidates (CI gate)
```

The command prints to stdout:

```text
[cleanup] 4 candidate(s) → data/generated/cleanup-report.json
  - some-slug (archived, 23★)
  - another-slug (stale, 1024★)
  - ...
```

Up to 10 candidates are shown inline. The full set lives in the JSON report.

## What makes a record a candidate

`cleanupStale()` from `packages/core/src/decisions.ts` runs `pickCleanupCandidates()` over the record set. A record is flagged when, in broad terms:

- The repository is **archived** (`github.archived: true`).
- The repository has **no commits in 365 days** and stars under a low threshold.
- The record has been at **experimental tier for 12+ months** without promotion.
- The record's `visibility` is `remove` or `historical` AND there are no other records pointing to it.

The exact thresholds live in `packages/core/src/decisions.ts:pickCleanupCandidates`. They're conservative by default — curators expand the threshold when they want broader sweeps.

## The cleanup-report.json shape

```jsonc
{
  "generatedAt": "2026-04-01T03:00:00.000Z",
  "totalCandidates": 4,
  "candidates": [
    {
      "slug": "some-slug",
      "status": "archived",
      "stars": 23,
      "cleanupCandidate": true,
      "reasons": ["GitHub repo is archived"],
      "lastCommitAt": "2024-01-15T00:00:00.000Z"
    }
  ]
}
```

The full shape is the `CleanupReport` type (`packages/core/src/decisions.ts:CleanupReport`).

## How to act on the report

For each candidate, choose one:

- **Keep as-is.** The report is informational. Do nothing.
- **Edit the record.** Change `visibility: hide` if you want to remove the record from listings but keep the detail page addressable.
- **Override via `data/decisions.yml`.** Add a `decision` entry with a `reason` and (optionally) `reviewedBy` / `reviewedAt`. This is the audit-friendly path.
- **Set `visibility: historical`.** The lens for "historical" surfaces these in a dedicated section; the rest of the site de-emphasizes them.
- **True archival?** Move the record YAML to `data/archive/` (consumer convention) so it's no longer picked up by `generate()`. The framework will not delete the YAML for you.

The cleanup-report is a **read-only** signal. Re-running `grove cleanup` produces the same JSON.

## What this page deliberately doesn't claim

- "Cleanup archives records for you." It does not. There is no `--delete` flag.
- "Cleanup sends PRs." It does not. PRs come from humans or from `grove readme generate`.
- "Cleanup respects decisions.yml." The classification reads `health.*` from the latest sync; a curator-set `visibility: keep` on the record itself is honored when generating the listing view, but the cleanup report still flags the underlying signals.

## See also

- [Health classification](/content/health-classification/) — the `health` block schema.
- [Decisions file](/concepts/decisions/) — the curator override surface.
- [GitHub workflows](/outputs/workflows/) — the monthly `cleanup.yml` schedule.
