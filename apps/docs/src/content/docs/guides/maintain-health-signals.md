---
title: Maintain health signals
description: How to triage stale, archived, and unknown records, and what each health status means.
---

Health signals answer one question for the visitor of your directory: **"Should I trust this entry?"** A record with `status: active` and `tier: curated` says "yes, this is current and well-maintained". A record with `status: archived` says "the maintainer archived the upstream repo". A record with `status: unknown` says "we have no GitHub data — proceed with caution".

This guide is for site maintainers triaging the periodic cleanup report. If you're a contributor adding a single record, see [Author a record](/guides/author-a-record/).

## Where the health data comes from

There is one place health data lives:

1. **The record's `health` block** — auto-populated when `grove sync github` runs. Contains `status`, `maturity`, `tier`, `visibility`, `cleanupCandidate`, `staleReason`, `confidence`, and `reasons`.

The health block in the record is the source of truth at render
time. Don't hand-edit it — `grove sync github` will overwrite any
manual changes on its next run. If you want to *override* the
auto-derived value, write a [decision](/guides/manage-decisions/).
(`data/health.yml` is a legacy format the validator no longer parses.)

## The status enum

Ten enum values; six are derived from GitHub metadata, four are editor-only. The implementation is `packages/core/src/health.ts::classifyHealth` (the single source of truth).

| Status | When | Source | Action |
|---|---|---|---|
| `active` | Repo pushed within the last 183 days | derived | Leave alone |
| `mature` | `active` + ≥ 500 stars + recent release or clear license | derived | Promote to `featured` via curation labels if not already |
| `stale` | Last commit 184–548 days ago (6–18 months) | derived | Decide: still relevant? |
| `inactive` | Last commit > 730 days ago (24+ months) | derived | Add a `historical` or `remove` decision |
| `archived` | GitHub repo is archived | derived | Add a `hide` or `historical` decision |
| `unknown` | No GitHub metadata at all (e.g., the project is not on GitHub) | derived (no-data fallback) | Add metadata or write a decision explaining why we list it |
| `historical` | Editor-set; record is kept for reference, not promotion | decision-only | — |
| `needs_review` | Editor-set; human review pending | decision-only | — |
| `quiet` | Editor-set; "watch this one" | decision-only | — |
| `unavailable` | Editor-set; the upstream record could not be refreshed (404 / rate-limit / private) | decision-only | Treat like `archived` for visibility |

The four decision-only values (`historical`, `needs_review`, `quiet`, `unavailable`) are not produced by `grove sync github`. If you see them in a record's `health.status`, it means someone wrote a `decisions.yml` entry that set it. See [Manage decisions](/guides/manage-decisions/).

## The tier enum

Four values, derived from stars and `status`.

- `curated` — ≥ 500 stars. The record goes to the top of the index. The only signal that triggers `curated` is star count — there is no "active months" rule in the code.
- `listed` — ≥ 50 stars. The default tier for established projects.
- `experimental` — fewer than 50 stars. Not a punishment — it means "we don't have enough data to vouch for this yet".
- `hidden` — status is `archived` or `inactive`. The record is still in the data, but the index does not list it. (Not `archived/unavailable` — `unavailable` is an editor-only status and does not drive `hidden` on its own.)

`curated` vs `listed` is purely a function of stars. Promotion isn't an editor decision; it's a function of the project's adoption. If you want to *override* the tier, use a decision.

## The cleanupCandidate flag

`cleanupCandidate: true` is the "this record needs a human look" flag. It's `true` when:

- `status` is `stale`, `archived`, `inactive`, or `unavailable`, **or**
- `status` is `unknown` and the record has no GitHub data

The `grove cleanup` command filters by this flag and writes a report. The `cleanup.yml` workflow runs this on a monthly cron and posts the report as a workflow artifact. Pull the artifact, walk the list, write decisions for the records that need an explicit verdict.

## A triage session

When the cleanup report lands, work through it in this order. Don't try to handle all 200 candidates in one PR — break it into batches of 10-20.

1. **Open `data/generated/cleanup-report.json`.** Sort by `staleReason`. `github_archived` and `github_unavailable` records are usually batchable — they all need a `hide` or `remove` decision with the same justification.

2. **For each `archived` candidate**: visit the live site to confirm the archive notice is there. If the project is *also* superseded by something in your directory, add a `historical` decision and a `seeAlso` link. If it's just dead, add `remove`.

3. **For each `stale` candidate**: read the last commit. If the project is feature-complete (a library that hit 1.0 and stopped), mark it `mature` in your editorial review and add a `keep` decision. If the project was abandoned without an archive, this is a judgment call — `hide` is the safe default; `remove` if the GitHub repo is also gone.

4. **For each `unknown` candidate**: usually means the project is not on GitHub. Either add the correct `repoUrl`, or write a decision noting the project lives elsewhere (e.g., a private registry, a self-hosted repo).

5. **Run `grove check` after each batch** to make sure your decisions file parses.

6. **Run `grove check` to refresh the index**, then `pnpm dev` to spot-check that the records still render correctly. The `health.visibility` field controls the index list, so a typo here can hide 20 records at once.

## When signals lie

The signals are heuristics. Three common cases where they get it wrong:

- **"No commits in 18 months" but the project is feature-complete.** A library at 1.0 with a stable API has every right to be quiet. Don't auto-`hide` these. Mark them `mature` in `scores.maturity` and write a `keep` decision.
- **"Fewer than 50 stars" but it's a brand-new launch.** `experimental` is correct — the tier reflects "we don't have adoption data yet", not "this is bad". Don't write a decision to override the tier; let it climb as stars arrive.
- **"The GitHub repo was transferred"**. The sync step will see the new owner and the new push dates. If the project is the same project under new stewardship, just let it sync. If the new owner is unrelated, treat it as `unavailable` and remove.

## Confidence

`confidence` is `low`, `medium`, or `high`. It's `low` when there's no GitHub metadata at all. It's `medium` when GitHub metadata exists but the record is missing other signals (e.g., a license). It's `high` when the GitHub data is complete (full name, license, recent activity).

Low confidence doesn't mean the record is bad — it means "we're guessing, not measuring". A `low`-confidence record that's been around for two years and still has community traction is fine; the heuristic just can't see it.

## What "fixing" a record looks like

If you want a record to surface better in the index:

- **Stars are below 50, but you think it deserves `listed`?** You can't promote by hand. The tier is a function of signals. Either wait for the project to grow, or — and this is the only legitimate override — use a decision to set a custom `visibility: highlight` so the record gets editorially featured. The tier stays `experimental`; visibility is a separate axis.
- **Stars are above 500 but the record is `experimental`?** The sync step ran before the stars crossed the threshold. Run `grove sync github` again, or wait for the next scheduled run. The threshold is checked every time.
- **The record is `hidden` but you want it back?** It got `hidden` because `status` is `archived` or `inactive`. Resolve the underlying status first (most often: the upstream repo came back to life). The next sync will reclassify it.

See [Sync GitHub metadata](/guides/sync-github-metadata/) for the upstream data the signals are computed from.
