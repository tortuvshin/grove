---
title: Cleanup report
description: Surface records whose embedded health signals need human review, without deleting anything.
---

`grove cleanup` reads every record's own `health:` block, filters for the ones that need a human look, and writes `data/generated/cleanup-report.json`. **The command never deletes or edits a record.** It surfaces a triage list; a curator acts on it via the record's YAML or `data/decisions.yml`.

Source: `pickCleanupCandidates()` and `cleanupStale()` in `packages/core/src/decisions.ts`.

## Where the health data comes from — and where it doesn't

`cleanupStale()` reads each record file directly (`recordsFileSchema.parse(...)` per `data/records/*.yml`) and looks at the `health:` field embedded on that record. It does **not** read `data/health.yml`, and it does **not** apply `data/decisions.yml` overrides — that merge only happens in the separate `generate()` build step (`packages/core/src/build-data.ts`), which the cleanup report doesn't go through. So a record with a `keep` decision in `data/decisions.yml` can still show up in the cleanup report if its own `health.cleanupCandidate` is `true`.

`classifyHealth()` (`packages/core/src/health.ts`) is what derives that block from GitHub metadata. `grove sync github` runs it and writes `data/health.yml` when `integrations.github.health` is enabled; otherwise the file is hand-authored. The build merges those entries onto records that carry no inline `health:` block of their own, so both routes end up in the same place. See [Maintain health signals](/content/health-classification/).

## Usage

```bash
pnpm exec grove cleanup           # writes the report
pnpm exec grove cleanup --strict  # exits 1 when there are candidates (CI gate)
```

There's no other flag — no `--delete`, no threshold override on the command line.

The command prints to stdout (`packages/cli/src/index.ts:207-213`):

```
[cleanup] 4 candidate(s) → /absolute/path/to/data/generated/cleanup-report.json
  - some-slug (archived, 23★)
  - another-slug (stale, 1024★)
```

The path in that first line is whatever `join(resolve(cwd, config.paths.generatedDir), "cleanup-report.json")` resolves to — an absolute filesystem path, not the relative `data/generated/...` form. Up to 10 candidates are listed inline (`report.candidates.slice(0, 10)`); the full set is in the JSON file.

## What makes a record a candidate

`pickCleanupCandidates()` is exactly two conditions, checked per record:

```ts
export function pickCleanupCandidates(records: Resource[]): Resource[] {
  return records.filter((r) => {
    const health = (r as { health?: { cleanupCandidate?: boolean; status?: string } }).health;
    if (health?.cleanupCandidate) return true;
    if (health?.status === "unknown" || health?.status === "needs_review") return true;
    return false;
  });
}
```

A record with no `health:` block at all is not a candidate — `health?.cleanupCandidate` and `health?.status` are both `undefined`, and neither condition matches.

When the block *was* produced by `classifyHealth()`, `cleanupCandidate` is `true` for `status: stale`, `status: archived`, or `status: inactive` (`packages/core/src/health.ts:88`); `unknown` and `needs_review` are caught by the second condition directly. The exact GitHub-activity thresholds behind those statuses are documented on [Maintain health signals](/content/health-classification/) — this page only documents what `grove cleanup` itself does with the block once it exists.

## The cleanup-report.json shape

```jsonc
{
  "generatedAt": "2026-04-01T03:00:00.000Z",
  "blueprint": "project-directory",
  "totalCandidates": 1,
  "candidates": [
    {
      "slug": "some-slug",
      "name": "Some Project",
      "url": "https://github.com/example/some-project",
      "status": "archived",
      "tier": "hidden",
      "staleReason": "github_archived",
      "lastCommitAt": "2024-01-15T00:00:00.000Z",
      "stars": 23
    }
  ]
}
```

Every `candidates[]` entry has exactly these eight fields (`CleanupCandidate` in `packages/core/src/decisions.ts:12-21`): `slug`, `name`, `url`, `status`, `tier`, `staleReason`, `lastCommitAt`, `stars`. `name` comes from `record.name`; `url` falls back through `links.github` → `links.website` → `links.source` → `""`; `stars` and `lastCommitAt` come from `record.github.repository.stargazers_count` / `.pushed_at` (`0` / `null` when absent). There's no `reasons` or `cleanupCandidate` field on the report entries — those live only on the source `health:` block, not the report.

## How to act on a candidate

- **Keep as-is.** The report is informational; do nothing.
- **Write a decision.** Add an entry to `data/decisions.yml` with `id`, and `decision: { visibility, reason, reviewedBy?, reviewedAt? }`. `visibility` is one of `highlight`, `keep`, `needs_review`, `hide`, `remove`, `historical` (`decisionVisibilitySchema`, `packages/core/src/schema.ts:55-63`). This is applied at build time via `generate()` — it changes what renders, not what `grove cleanup` reports next run.
- **`hide` or `remove`.** Both are excluded from `data/generated/records.index.json` (the listing payload) and from `public/sitemap.xml` (`packages/core/src/build-data.ts:211-212`, `packages/core/src/sitemap.ts:120`). Both are still present in `data/generated/records.full.json`, which keeps every record "regardless of visibility" (`packages/core/src/build-data.ts:78`).
- **Delete it for good.** There's no archive-directory convention in the framework — `generate()` and `cleanupStale()` only read whatever `.yml` files are inside `paths.recordsDir`. To drop a record entirely, delete or move its YAML file out of that directory.

Re-running `grove cleanup` with no source changes produces the same JSON — it's a read-only report over whatever `health:` data is currently on disk.

## See also

- [Maintain health signals](/content/health-classification/) — how `health:` gets its values, and the `data/health.yml` vs. inline `health:` distinction
- [Decisions file](/concepts/decisions/) — the curator override surface
- [GitHub workflows](/outputs/workflows/) — the scheduled `cleanup.yml` workflow that runs `grove cleanup` and posts the output to a job summary
