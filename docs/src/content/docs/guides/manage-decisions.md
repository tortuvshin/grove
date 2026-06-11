---
title: Manage decisions
description: How to use data/decisions.yml to override the auto-derived health block, and what each visibility value does.
---

Decisions are the human curation layer. While `grove sync github` derives a record's health from signals, decisions are how you *override* that derivation when editorial judgment and the auto-derived value disagree.

If you're triaging a cleanup report for the first time, read [Maintain health signals](/guides/maintain-health-signals/) first — this page assumes you know what the health block is doing.

## The decisions file

`data/decisions.yml` is a flat list of one decision per record. Each decision has the record's `slug` and a `decision` object with a `visibility`, a `reason`, and optional `reviewedBy` / `reviewedAt` fields.

```yaml
# data/decisions.yml
- id: astro
  decision:
    visibility: highlight
    reason: "Canonical static-site framework; high trust signal for the directory."
    reviewedBy: jane
    reviewedAt: 2025-10-12

- id: old-graphql-server
  decision:
    visibility: historical
    reason: "Project archived upstream; kept for readers referencing the 2020s API."
    reviewedBy: jane
    reviewedAt: 2025-10-15

- id: broken-clone
  decision:
    visibility: remove
    reason: "Repo URL 404s; upstream no longer exists."
    reviewedBy: jane
    reviewedAt: 2025-10-15
```

The schema is `decisionsFileSchema` in `packages/core/src/schema.ts`. The CLI validates this file on every `grove validate` run — typos in the `visibility` enum surface immediately.

## The visibility enum

Six values. The first three keep the record visible; the last three hide it.

### Visible

- **`highlight`** — the record is editorially featured. The Astro template renders it at the top of the index with a chip. Use sparingly — five to ten `highlight`s in a 200-record directory is a lot.
- **`keep`** — the default. The record appears in the index normally. This is what most decisions should set.
- **`needs_review`** — the record is visible but flagged for a future review pass. The template renders a small "needs review" badge. Use this when you're not ready to make a permanent call.

### Hidden

- **`hide`** — the record is excluded from the index but kept in the data. The detail page is still reachable at `/projects/<slug>/` (useful for inbound links), but it does not appear in the index list or facet pages. This is the safe default for "we used to list this but it's not relevant anymore".
- **`remove`** — the record is excluded from the index *and* the detail page returns 404. The data is kept on disk (and in git history). Use this when the record is misleading or the upstream is gone.
- **`historical`** — a special case of "kept for reference". The detail page renders with a banner explaining that the record is kept for historical context. Use for projects that were once relevant but are no longer maintained.

## How decisions interact with the health block

For `project` records, both exist:

- The `health.visibility` field is auto-derived. It defaults to `keep` for active projects and `hide` for archived/inactive ones.
- The decisions file is a separate, editor-set override.

The `grove generate` step merges them: a decision in `decisions.yml` **wins** over the auto-derived `health.visibility`. So if a record has `health.visibility: hide` (because it's archived) and you add a decision with `visibility: historical`, the rendered page will be the `historical` view.

For `resource` and `entity` records, there is no `health` block — the `visibility` field on the record itself is the only signal. Decisions still apply the same way: they override the record's top-level `visibility`.

## When to write a decision vs. when to edit the record

The cleanest mental model:

- **Decisions are about *visibility*** — should this record show up, and if so, how prominently? They are reversible and reviewable in isolation.
- **Record edits are about *content*** — is the description accurate? Is the category right? Did the project change names?

If you find yourself wanting to edit the `health` block in a record YAML to change its status, **don't** — `grove sync github` will overwrite it. Write a decision instead. The two exceptions:

- `health.reasons` is a list of human-readable notes. You can add to it manually; the sync step preserves manual entries.
- `scores.*` is fully manual. Edit the record's `scores` block if you want to nudge a record.

## Workflow: a real triage pass

Say the cleanup report has 30 candidates. You want to resolve them in one sitting.

1. **Open the cleanup report** at `data/generated/cleanup-report.json`. Group candidates by `staleReason`. `github_archived` and `github_unavailable` are usually batchable.

2. **For each group, draft a single reason string.** "Repo archived upstream 2024-Q1; superseded by `<other>`" applies to the whole batch.

3. **Append decisions to `data/decisions.yml` in slug order.** Keep the file sorted by `id` — diff-friendly.

4. **Run `grove validate` to make sure the YAML parses.**

5. **Run `grove generate` to refresh the index payload.** Spot-check `data/generated/records.index.json` — records with `visibility: hide` should not appear in the list.

6. **Run `pnpm dev` and visit the index.** The records you hid should not be in the list. The `highlight`s should be at the top with the chip. The `historical`s should still be reachable at their detail URL but with the banner.

7. **Commit the decisions file and a regenerated `data/generated/cleanup-report.json`** — the report regenerates with zero candidates after your pass, which is the proof the pass worked.

## Auditing decisions later

Decisions are append-only in practice. There's no command to "remove" a decision — instead, you replace it with a new one with a different `visibility`. This is intentional: the diff history is the audit log.

If you want to see who made which call, `data/decisions.yml` is grep-friendly: `grep -A2 "reviewedBy: jane" data/decisions.yml`. The CLI doesn't ship a built-in audit command in V1, but the file format is stable enough to query directly.

## Decisions are not magic

A decision can only set the visibility of an existing record. It can't:

- Bring a record back to life if the upstream is gone
- Add metadata that wasn't there before
- Change a record's `kind`, `category`, or other content fields

For those, edit the record YAML and re-run `grove sync github` to refresh the GitHub-derived fields.
