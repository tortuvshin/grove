---
title: Sync contributors
description: Aggregate per-repository contributor counts into data/generated/.
---

# Sync contributors

`grove sync contributors` aggregates contributor counts across the GitHub repositories your records reference, writing `data/generated/contributors.json` and `data/generated/repo-stats.json`. The Astro integration surfaces the result on the `/contributors/` page.

## Prerequisites

- `integrations.github.contributors: true` in `grove.config.ts` (or set the umbrella `integrations.github: true`).
- A `GITHUB_TOKEN` is **not** required but is strongly recommended — token-free calls hit GitHub's 60 req/h unauthenticated limit and any site with more than a few dozen records will burn that budget quickly.
- `site.repoUrl` set if you want a parent-repo entry in the contributors list (the repo URL the site itself is in).

## Usage

```bash
pnpm exec grove sync contributors
```

The command prints, when it finishes:

```text
[sync contributors] 14 contributors from 6 repository → data/generated/contributors.json
```

And writes:

- `data/generated/contributors.json` — array of `Contributor` records (login, name, avatarUrl, profileUrl, contributions, repositories).
- `data/generated/repo-stats.json` — per-repo aggregates (commits, contributors, lastCommitAt, ageDays).

## What it does

For each record with a `repoUrl` pointing at `github.com/<owner>/<repo>`, the command:

1. Calls `GET /repos/{owner}/{repo}/contributors` (paginated).
2. Records each contributor's `login`, `contributions`, `avatar_url`, `html_url`.
3. Aggregates by `login` across repositories so contributors who span multiple repos appear once.

If `site.repoUrl` is set, the same aggregator includes the parent repo (the repo that hosts the Grove site itself).

## What it does not do

- It does not change any record's YAML. Contributors live in `data/generated/`, not in `data/records/`.
- It does not authenticate. Public API only.
- It does not store email addresses; `login` is the identity.
- It does not enumerate forks explicitly — the GitHub API includes fork contributors when they're merged or has their own commit history.

## Outputs

| File | Shape |
|---|---|
| `data/generated/contributors.json` | Array of `{ login, name, avatarUrl, profileUrl, contributions, repositories }` |
| `data/generated/repo-stats.json` | Array of `{ repo, fullName, commits, contributors, lastCommitAt, ageDays }` |

The exact shape is the `Contributor` and `ContributorSyncResult` types from `@grove-dev/core` (`packages/core/src/contributors.ts`).

## How often

The default `apps/example/` scaffold has `.github/workflows/sync-contributors.yml` scheduled at `0 4 * * 0` (Sunday 04:00 UTC). Adjust as your site grows — daily is reasonable for sites with 100+ records.

## Configuration

Two `grove.config.ts` fields shape the contributor surface:

```ts
integrations: {
  github: {
    contributors: true    // gates the sync; default false
  }
},
contributors: {
  showContributionCount: true   // controls whether each tile shows N contributions
}
```

`showContributionCount: false` produces a quieter contributor card. Useful for directories that curate contributor activity as a side concern.

## See also

- [Sync GitHub metadata](/automation/sync-github/) — the per-record sync for stars/language/topics.
- [Generated data files](/outputs/generated-data/) — exactly what `contributors.json` looks like.
- [Reference: programmatic API](/reference/api-core/) — `syncContributors` signature and types.
