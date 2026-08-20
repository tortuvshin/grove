---
title: Sync contributors
description: Fetch the GitHub contributor list for the site's own repository into data/generated/.
---

`grove sync contributors` fetches the contributor list and repo stats for **one** GitHub repository — the site's own — and writes `data/generated/contributors.json` and `data/generated/repo-stats.json`. The Astro integration reads those files to render the `/contributors/` page.

:::caution[It syncs one repository, not every record's repository]
`syncContributors` (`packages/core/src/contributors.ts`) resolves a single `owner/repo` pair — from the `repoUrl` option passed in, or from `data/generated/site-config.json`'s `repoUrl` (which is generated from `grove.config.ts`'s `site.repoUrl`) — and calls the GitHub contributors API for that one repository only. It does not iterate `data/records/*.yml`, and there's no per-record contributor aggregation anywhere in the function. If `site.repoUrl` (and no explicit `repoUrl` override) is unset, `syncContributors` throws: `` Cannot sync community metadata: <path> has no valid site repository URL. `` — `site.repoUrl` is effectively required for this command to succeed, not optional.
:::

## Prerequisites

- `integrations.github.contributors: true` in `grove.config.ts` (or the umbrella `integrations.github: true`) — otherwise `grove sync contributors` prints `[sync contributors] disabled by integrations.github.contributors — skipping` and exits.
- `site.repoUrl` set to a `github.com/<owner>/<repo>` URL — required, per the caution above.
- A token is optional but recommended: `syncContributors` reads `process.env.GH_TOKEN`, then falls back to `process.env.GITHUB_TOKEN`, then an empty string (unauthenticated).

## What it does

1. Reads `repoUrl` (the passed-in option, or `data/generated/site-config.json`'s `repoUrl` as a fallback) and parses it into `{ owner, repo }`.
2. Calls `GET /repos/<owner>/<repo>/contributors?per_page=100&anon=false&page=<n>`, paginating until a page returns fewer than 100 entries.
3. For each contributor, records `username` (from `login`), `avatarUrl` (from `avatar_url`), `profileUrl` (from `html_url`), and `contributions`. Logins ending in `[bot]` (e.g. `github-actions[bot]`, `dependabot[bot]`) are filtered out before being written.
4. Calls `GET /repos/<owner>/<repo>` once for repo-level stats (stars, forks, subscribers, open issues, default branch, last-pushed date).
5. Sorts contributors by `contributions` descending (ties broken alphabetically by `username`) and writes both output files.

The CLI wraps this with `grove sync contributors`: it checks `integrations.github.contributors`, runs `prepareDirectory()` first (which is what (re)generates `data/generated/site-config.json` from `grove.config.ts`, including `repoUrl`), then calls `syncContributors`.

On success, the CLI prints a line of the form:

```
[sync contributors] 14 contributors from 1 repository → <absolute path>/data/generated/contributors.json
```

The path segment is the absolute, resolved `outputPath` (`resolve(cwd, generatedDir, "contributors.json")`) — not a repo-relative path — because the console message interpolates the resolved path directly. `repositories` in that line is always `1` — `syncContributors`'s return value hardcodes `repositories: 1` (`packages/core/src/contributors.ts`), because it only ever syncs the one configured repo.

## What it writes

- **`data/generated/contributors.json`**
  ```json
  {
    "generatedAt": "2026-08-14T03:11:42.000Z",
    "contributors": [
      { "username": "octocat", "avatarUrl": "https://...", "profileUrl": "https://github.com/octocat", "contributions": 482 }
    ]
  }
  ```
  Each entry is a `Contributor`: `{ username, avatarUrl?, profileUrl?, contributions }`. There is no `login`, `name`, or `repositories` field on this type — `avatarUrl` and `profileUrl` are only present when GitHub returned them.

- **`data/generated/repo-stats.json`**
  ```json
  {
    "repoUrl": "https://github.com/owner/repo",
    "stars": 92000,
    "forks": 6300,
    "watchers": 1200,
    "openIssues": 412,
    "contributors": 14,
    "defaultBranch": "main",
    "pushedAt": "2026-08-10T18:21:33Z"
  }
  ```
  `watchers` comes from the API's `subscribers_count`, not `watchers_count`. There is no `commits`, `lastCommitAt`, or `ageDays` field — `pushedAt` is the only timestamp written.

If the repo-info request (`GET /repos/<owner>/<repo>`) fails, `syncContributors` still writes both files — `repo-stats.json` falls back to zeros/`undefined` for the missing fields, and the result's `failed` count is incremented by one. Contributor pagination failures are not caught the same way: a non-OK, non-204 response from the `/contributors` endpoint throws and aborts the whole command.

## What it does not do

- It does not touch any `data/records/*.yml` file — contributor data lives only in `data/generated/`.
- It does not store contributors' email addresses; `username` (the GitHub `login`) is the identity.
- It does not read a config-level `showContributionCount` setting itself — that flag only affects rendering (see below), not what gets fetched or written.

## Configuration

Two separate `grove.config.ts` settings are involved:

```ts
integrations: {
  github: {
    contributors: true   // gates whether `grove sync contributors` runs at all; default false
  }
},
contributors: {
  showContributionCount: true   // default true — controls the rendered "N contributions" label
}
```

`contributors.showContributionCount` is a top-level config field (`groveConfigSchema.contributors`, not nested under `integrations`). It's read by `getContributorsPageModel` in `packages/astro/src/server/models.ts` and defaults to `true` — set it to `false` for a quieter contributor card that hides the per-user count.

## How often

`apps/example/.github/workflows/sync-contributors.yml` runs on a weekly cron (`0 4 * * 0`, Sunday 04:00 UTC) plus `workflow_dispatch`. Unlike the GitHub-metadata sync, this workflow commits the generated files directly with `stefanzweifel/git-auto-commit-action` — it does not open a pull request.

## See also

- [Sync GitHub metadata](/automation/sync-github/) — the per-record sync for stars/language/topics on `data/records/*.yml`
- [Generated data files](/outputs/generated-data/) — the full shape of everything under `data/generated/`
- [Reference: programmatic API](/reference/api-core/) — `syncContributors`'s options and return type
