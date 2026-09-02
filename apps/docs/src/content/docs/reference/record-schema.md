---
title: Record schema
description: Every field a record file may carry, its type, its default, and which ones a human writes versus which ones a command fills in.
---

A record is one YAML file under `data/records/`. `grove check` parses it with
the Zod schema in `packages/core/src/schema.ts` and rejects the build if it
does not validate.

The schema is a discriminated union on `kind` with three members —
`project`, `resource`, and `entity`. **Only `kind: project` is usable
today.** `grove init` scaffolds a space whose `blueprint` is
`project-directory`, and `validate.ts` rejects any record whose `kind` does
not match that blueprint, so `resource` and `entity` records cannot be
authored in a real space. Everything below documents `kind: project`.

**One file per record.** The filename without its extension is the slug. If a
record's `slug:` field disagrees with its filename, `grove check` reports
`record slug "…" does not match filename` as a **warning** — the build
continues and the filename wins, because the loader overwrites `slug` with the
filename. Run `grove check --strict` if you want that to fail.

## Shared base fields

These fields come from `resourceBaseSchema` and apply to every record.

### `slug`

**Type:** `string`, min length 1 · **Required**

The unique identifier. It is the URL segment for the detail page, the key
used by `data/decisions.yml` and `data/overrides.yml`, and the id carried
into every generated output. Must equal the filename.

### `addedAt`

**Type:** `string` (ISO date or date-time) · **Optional**

When this record joined the directory. `grove init`'s submission form stamps
it with the current date; `grove import` carries over whatever the source
knows. Write it by hand for a record you add manually.

This is what `sort=recently-added` (and the `new` lens) orders on, what
llms.txt reports as `added:`, and the middle fallback for a record URL's
sitemap `lastmod`.

**Not the same as [`curation.reviewedAt`](#curation).** `addedAt`
is when the record appeared; `reviewedAt` is when a human last looked at it.
A record added today and never reviewed has an `addedAt` and no
`reviewedAt`. When `addedAt` is absent the sort falls back to `reviewedAt`,
then to the repository's own creation date, so older records still order
sensibly — but only `addedAt` is actually correct.

### `name`

**Type:** `string`, min length 1 · **Required**

The human-readable name shown in cards, headings, and the browse index.
(Defined on `projectRecordSchema`, not the base — but every project record
needs one.)

### `description`

**Type:** `string` · **Default:** `""`

A short summary. This is the field `grove sync github` treats as
GitHub-sourced prose; see `summary` below for the curator-written
alternative.

### `summary`

**Type:** `string` · **Optional**

A curator-written lead paragraph. When present, the detail page renders
`summary` first and `description` below it as the secondary "from the
project's README" block. Write here when you want your own words without
overwriting what GitHub says the project is.

### `sourceDescription`

**Type:** `string` · **Optional**

The original GitHub-sourced description, preserved separately so a curated
`summary` does not destroy it.

### `category`

**Type:** `string`, min length 1 · **Default:** `"uncategorized"`

A single category string. It is not validated against a fixed list — the
schema only requires a non-empty string. Keep the set consistent by
convention, and mirror it in `data/taxonomy/` if you want category pages.

### `tags`

**Type:** `string[]` · **Default:** `[]`

Free-form labels. Also unvalidated against a list; normalize casing and
hyphenation yourself so filtering behaves.

### `links`

**Type:** object of URL strings · **Default:** `{}`

`github`, `website`, `docs`, and `source` are named keys. Any other key is
allowed through the catchall — but **every value must parse as a URL**,
including the extra ones. A non-URL value fails validation.

### `content`

**Type:** `string` · **Optional**

Path to a Markdown body for this record, relative to `paths.bodiesDir`
(default `content/records`). The detail page renders the body beneath the
record header.

### `source`

**Type:** object · **Default:** `{ type: "manual" }`

Provenance, mostly written by `grove import`.

| Field | Type | Default |
|---|---|---|
| `type` | `"manual"` \| `"github-topic"` \| `"awesome-list"` \| `"submit"` \| `"import"` | `"manual"` |
| `file` | `string` | — |
| `url` | `string` | — |
| `provider` | `string` | — |
| `owner` | `string` | — |
| `repo` | `string` | — |

Note that `source.url` here is a plain string, not a validated URL.

### `curation`

**Type:** object · **Default:** `{ reviewed: false, labels: [], lenses: [] }`

Curator metadata, written by hand.

| Field | Type | Default |
|---|---|---|
| `reviewed` | `boolean` | `false` |
| `reviewedBy` | `string` | — |
| `reviewedAt` | `string` | — |
| `notes` | `string` | — |
| `labels` | array of `"new"` \| `"hot"` \| `"mature"` \| `"featured"` | `[]` |
| `lenses` | `string[]` | `[]` |

`labels` is a closed enum — exactly those four values. `lenses` is an open
string array.

### `scores`

**Type:** object · **Default:** `{}`

Every key is optional and constrained to `0`–`100`: `activity`, `maturity`,
`learning`, `contribution`, `docs`, `overall`. Nothing in the build computes
these; they are yours to fill in and yours to use.

### `visibility`

**Type:** `"highlight"` \| `"keep"` \| `"needs_review"` \| `"hide"` \|
`"remove"` \| `"historical"` · **Default:** `"keep"`

For project records the signal that actually drives the index is
`health.visibility`, not this field. This top-level `visibility` exists on
the base schema for the kinds that have no `health` block.

## Project fields

```yaml
kind: project
slug: cal-com
name: Cal.com
description: Open-source scheduling infrastructure for teams and platforms.
category: productivity
tags: [scheduling, calendar, saas]
links:
  github: https://github.com/calcom/cal.com
  website: https://cal.com
repoUrl: https://github.com/calcom/cal.com
stack: Next.js
stacks: [Next.js, TypeScript, Prisma, tRPC]
platforms: [Web, Self-hosted]
licenses: [mit]
projectType: production
difficulty: intermediate
codebaseSize: large
bestFor:
  - Adding scheduling to SaaS products
whyListed:
  - Active, well-maintained open-source project
caveats:
  - Requires Postgres for self-hosted setups
distribution:
  channels:
    - type: docker
      label: Docker image
      url: https://hub.docker.com/r/calcom/cal.com
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `kind` | literal `"project"` | — | Required discriminator |
| `name` | `string` min 1 | — | Required |
| `projectType` | `real-app` \| `production` \| `reference` \| `library` \| `tool` \| `demo` \| `template` \| `historical` | — | Optional |
| `stack` | `string` | — | The single primary technology |
| `stacks` | `string[]` | `[]` | Full stack list |
| `platforms` | `string[]` | `[]` | Free-form |
| `licenses` | `string[]` | `[]` | SPDX identifiers, e.g. `[mit]`, `[apache-2.0]` |
| `difficulty` | `beginner` \| `intermediate` \| `advanced` | — | Optional |
| `codebaseSize` | `small` \| `medium` \| `large` \| `huge` | — | Optional |
| `repoUrl` | URL | — | Canonical repo. `grove sync github` reads `repoUrl` first and falls back to `links.github` |
| `logoUrl` | URL | — | Falls back to the GitHub owner avatar, then to initials |
| `screenshots` | array | `[]` | Each entry needs `src` (URL) and `alt` (min 1); `source`, `width`, `height` optional |
| `bestFor` | `string[]` | `[]` | Curator bullets |
| `whyListed` | `string[]` | `[]` | Curator bullets |
| `caveats` | `string[]` | `[]` | Curator bullets |
| `distribution.channels` | array | `[]` | Each channel **requires** `type` and a valid `url`; `platform`, `label`, `verified`, `notes` optional |
| `github` | object | — | Written by `grove sync github` — do not hand-edit |
| `health` | object | — | See below |

:::caution[`distribution.channels[].url` is required]
A channel entry without a valid `url` fails validation. `{ type: docker,
platform: linux }` alone will not parse.
:::

## The `github` block

`grove sync github` owns this block and rewrites it in place. It merges
rather than replaces, so anything you add outside the fields sync writes
survives a re-run.

- `github.repository` — the raw GitHub REST repository object
  (`full_name`, `stargazers_count`, `pushed_at`, `license`, `topics`, and
  the rest). Passthrough, so unknown keys are kept.
- `github.languages`, `github.activity` — optional records written by
  sync.
- `github.sync` — `{ syncedAt, source }`, where `source` is `"api"` or
  `"html"`.
- `github.html` and `github.homepage` — written only when the API path
  failed and the token-free HTML fallback succeeded.

## The `health` block

`health` describes how fresh and relevant a record is. It is optional, and
its shape is:

| Field | Type | Default |
|---|---|---|
| `status` | `active` \| `mature` \| `stale` \| `inactive` \| `archived` \| `unknown` \| `historical` \| `needs_review` \| `quiet` \| `unavailable` | `"unknown"` |
| `maturity` | `experimental` \| `useful` \| `mature` \| `unknown` | `"unknown"` |
| `tier` | `curated` \| `listed` \| `experimental` \| `hidden` | `"experimental"` |
| `visibility` | same enum as top-level `visibility` | `"keep"` |
| `cleanupCandidate` | `boolean` | `false` |
| `staleReason` | `string \| null` | — |
| `confidence` | `low` \| `medium` \| `high` | `"medium"` |
| `reasons` | `string[]` | `[]` |

:::note[Health is written inline on the record]
`grove sync github` writes `health:` directly onto each record it syncs
when `integrations.github.health` is enabled — one file write per
record, so two records syncing at once never touch the same file. An
inline `health:` block always wins over `data/health.yml`, which is
kept only as a fallback for records synced before this change (or
hand-authored). When a record has no inline block, the build looks up
its slug there instead.

`classifyHealth` in `packages/core/src/health.ts` is the derivation, and
it is exported from `@grove-dev/core` if you would rather drive it from
your own script.
:::

### How `classifyHealth` derives each field

With no GitHub metadata at all it returns `status: unknown`,
`tier: experimental`, `confidence: low`. Otherwise, from `pushedAt`:

| Days since last push | `status` |
|---|---|
| repo is archived on GitHub | `archived` |
| ≤ 183 | `active` |
| 184 – 548 | `stale` |
| 549 – 730 | `needs_review` |
| > 730 | `inactive` |

Then, with `popular` meaning ≥ 500 stars and `maintainedSignals` meaning
pushed within 183 days **and** (a release within 365 days **or** a license
that is not `NOASSERTION`):

- `maturity` is `unknown` when archived or inactive; `mature` when
  `popular && maintainedSignals`; `useful` at ≥ 50 stars or with
  maintained signals; `experimental` otherwise.
- An `active` record that reaches `mature` maturity has its `status`
  promoted to `mature` as well.
- `tier` is `hidden` when archived or inactive, else `curated` at ≥ 500
  stars, `listed` at ≥ 50, `experimental` below that.
- `visibility` is `hide` when `tier` is `hidden`, otherwise `keep`.
- `cleanupCandidate` is `true` for `stale`, `archived`, and `inactive`.
- `staleReason` is `no_commits_365_days` (stale), `no_commits_24_months`
  (inactive), `github_archived` (archived), or `null`.
- `confidence` is `high` when `github.fullName` is present, `medium` when
  it is not, and `low` only in the no-metadata case above.

`quiet`, `unavailable`, and `historical` are valid `status` values in the
schema but the classifier never produces them — set them by hand.

Health is a review signal, not a ranking. `grove cleanup` reads
`health.cleanupCandidate` to surface records for a human to look at; the
curator decides what happens next in `data/decisions.yml`.

## `kind: resource` and `kind: entity`

`resourceRecordSchema` and `entityRecordSchema` exist in the schema file and
add their own fields (`title`/`type`/`topic`/`related` and
`name`/`type`/`founded`/`parent` respectively). Neither is reachable:
`grove init` does not scaffold a space that accepts them, and validation
rejects records whose `kind` does not match the space's blueprint. Treat
them as schema-only.

## Related

- [Author a record](/content/author-a-record/) — the editorial workflow.
- [grove.config.ts](/reference/config/) — `paths.recordsDir`,
  `paths.bodiesDir`, and the rest of the site config.
- [CLI](/reference/cli/) — `grove check` validates against this schema.
