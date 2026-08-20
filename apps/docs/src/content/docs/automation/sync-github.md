---
title: Sync GitHub metadata
description: Keep stars, forks, license, language, and topics fresh by refreshing each record's github block from the GitHub API.
---

`grove sync github` refreshes the `github` block on every `data/records/*.yml` file with live data from the GitHub REST API, writing the result back to the same YAML files so the diff is reviewable in a pull request.

This guide is for site maintainers who run (or schedule) the sync. If you're a contributor adding a single record, you don't need to read this — the scaffolded workflow runs it on a schedule, not on your PR.

## Enable

In `grove.config.ts`:

```ts
integrations: {
  github: {
    metadata: true,       // gates `grove sync github`
    contributors: true,   // gates `grove sync contributors`
    health: true,          // accepted by the schema; see note below
  },
},
```

`integrations.github` can also be a single boolean (`github: true`), which expands to all three sub-flags via `normalizeGithubIntegration`.

:::caution[The `health` flag currently does nothing]
`normalizeGithubIntegration` (`packages/core/src/schema.ts`) resolves `metadata`, `contributors`, and `health` into three booleans, but the `sync` command in `packages/cli/src/index.ts` only reads `githubFlags.metadata` and `githubFlags.contributors`. Nothing in the CLI branches on `githubFlags.health`. Setting `health: false` does not turn off anything today — health classification (`classifyHealth` in `packages/core/src/health.ts`) is a separate function that `grove sync github` never calls.
:::

If `integrations.github.metadata` is `false`, running `grove sync github` prints `[sync github] disabled by integrations.github.metadata — skipping` and exits without reading any files.

## What it does, in order

For each `.yml` file in `config.paths.recordsDir` (default `data/records`, sorted alphabetically, optionally truncated by `--limit`):

1. Parses the file and reads `repoUrl`, falling back to `links.github` if `repoUrl` is unset.
2. If neither is set, logs `[sync github] <file>: no repository, skipped` and moves on.
3. Parses the URL with `parseGithubRepoUrl`. If it doesn't match `https?://github.com/<owner>/<repo>`, logs `[sync github] <file>: invalid GitHub URL, skipped`.
4. Tries `fetchGithubMetadata(ref)` — a `GET /repos/<owner>/<repo>` call, followed by `GET /repos/<owner>/<repo>/releases/latest` for the latest release date. Any thrown error (rate limit, network failure, non-2xx status) is caught silently and falls through to step 5.
5. If the API call didn't produce metadata, tries `enrichFromGithubHtml(repoUrl)` — an unauthenticated fetch of the public `https://github.com/<owner>/<repo>` HTML page.
6. If both sources failed, logs `[sync github] <file>: unavailable` and counts it as failed.
7. On success from either source, merges the result into the record's `github` block and rewrites the file with `stringifyRecordYaml`, logging `[sync github] <file>: api` or `[sync github] <file>: html`.
8. After all files, prints one summary line: `[sync github] <updated> updated (<htmlOnly> HTML fallback), <failed> failed`.

There is no separate command for "which records were skipped" beyond what's printed to stdout during the run — nothing is written to disk for skips.

## Run it

```bash
grove sync github                # sync every record in data/records/
grove sync github --limit 10     # only the first 10 records, sorted by filename
grove sync github --strict       # process.exitCode = 1 if any record ended up "unavailable"
```

`--limit` always takes the **first N files alphabetically** (`files.slice(0, options.limit)`). There is no `--offset` flag and no stored progress between runs — running `--limit 10` twice in a row syncs the same 10 files both times. If you need to bound API usage per run on a large directory, `--limit` caps the ceiling; it does not let you page through the rest of the records on a later run.

`--strict` doesn't stop the loop early — every selected file is still processed. It only flips the process exit code to `1` at the end if `failed > 0`, which is what makes it useful as a CI gate.

## Authentication

`fetchGithubMetadata` reads exactly one source for a token: the `GITHUB_TOKEN` environment variable (`packages/core/src/github.ts`, `token = process.env.GITHUB_TOKEN`). There is no fallback to `gh auth token` or any other CLI — the code never shells out to `gh`.

If `GITHUB_TOKEN` is unset, requests go out unauthenticated with only `Accept`, `X-GitHub-Api-Version`, and `User-Agent: grove` headers. Unauthenticated requests are subject to GitHub's per-IP rate limit, which is tighter than the authenticated one — set `GITHUB_TOKEN` in CI (as the scaffolded workflow already does) to avoid hitting it on directories with more than a handful of records.

`enrichFromGithubHtml` (the HTML fallback) never sends a token — it's a plain unauthenticated `fetch` of the public repo page and, for license only, `img.shields.io`.

## API → HTML fallback

The HTML fallback exists so a scheduled sync stays useful even when the API is rate-limited or a request otherwise fails. It does **not** recover everything the API sync would.

`enrichFromGithubHtml` (`packages/core/src/enrich.ts`) scrapes exactly four fields from the repo's public HTML page:

- `license` — parsed from the "X license" link text, or `img.shields.io/github/license/<owner>/<repo>` if the page doesn't render that text.
- `language` — the primary-language label span.
- `topics` — the topic tag links.
- `homepage` — the "Homepage" link in the sidebar, if present.

:::caution[It does not recover stars, forks, or the last-pushed date]
The HTML path never touches `stargazers_count`, `forks_count`, `open_issues_count`, `pushed_at`, `updated_at`, `archived`, or `default_branch`. Those fields simply aren't scraped — `extractLicense`, `extractLanguage`, `extractTopics`, and `extractHomepage` are the only extractors in `enrich.ts`. A record that fell back to HTML keeps whatever `github.repository` values it already had from a previous API sync (or has none at all if it's never synced successfully via the API).
:::

When the HTML fallback succeeds, the CLI writes the four scraped fields into a **separate** `github.html` block (not into `github.repository`) plus `github.homepage` at the top level if a homepage was found. It does not touch `github.repository` at all on an HTML-fallback run.

## What gets written back

For a successful API sync, `buildGithubSyncPatch` (`packages/core/src/github.ts`) writes these fields into `github.repository`, spread on top of whatever was already there so unrelated custom keys survive:

```yaml
github:
  repository:
    full_name: ollama/ollama
    stargazers_count: 92000
    forks_count: 6300
    open_issues_count: 412
    language: Go
    pushed_at: "2026-08-10T18:21:33Z"
    updated_at: "2026-08-12T09:14:01Z"
    archived: false
    disabled: false
    default_branch: main
    license:
      spdx_id: MIT
      name: MIT
    topics: [llm, ollama, ai, local-llm]
  latestReleaseAt: "2026-07-30T00:00:00Z"   # top-level, only when a release exists
  homepage: https://ollama.com               # top-level, only when set upstream
  sync:
    syncedAt: "2026-08-14T03:11:42.000Z"
    source: api
```

Notes on this shape:

- `license.spdx_id` and `license.name` are both set to the **same** string (whichever GitHub returned — SPDX id preferred, falling back to the license's display name). The API's own `license.name` (which can differ from the SPDX id) is not fetched into a separate field.
- `latestReleaseAt` and `homepage` live at the top level of `github`, not nested inside `repository` — that's deliberate (see the comment on `buildGithubSyncPatch`).
- Fields `fetchGithubMetadata` fetches from the API but that `buildGithubSyncPatch` never writes back: `watchers_count`, `created_at`, `description`, `html_url`, `size`, `visibility`, `fork`, `private`. If you need one of those, it isn't part of the sync's write surface today.

For an HTML-fallback sync:

```yaml
github:
  html:
    license: MIT
    language: Go
    topics: [llm, ai]
  homepage: https://ollama.com   # only if the fallback found one
  sync:
    syncedAt: "2026-08-14T03:11:42.000Z"
    source: html
```

## Field precedence

Within `github.repository`, sync always overwrites the specific fields listed above on every successful API run — there is no per-field opt-out. Anything else already present on the record (other keys under `github`, or the record's other top-level fields) is left untouched by the merge.

`data/overrides.yml` is applied by the **build**, not by the sync. Each entry is `{ id, patch }`, and the patch's top-level keys are merged over the parsed record before validation:

```yaml
overrides:
  - id: some-project
    patch:
      description: A description the upstream README got wrong.
      category: developer-tools
```

Because it runs at build time, an override survives every `grove sync github` run — the sync rewrites `data/records/<slug>.yml`, the override re-applies on top. That makes it the right place to correct an imported record you do not want to hand-edit. It does **not** stop the sync from rewriting the underlying YAML.

For `repoUrl` resolution: `record.repoUrl` is read first, falling back to `record.links.github` if unset. The sync command does not compare the two or warn when they disagree — it just uses whichever one resolves.

## Skipped records

A file is skipped (not counted as failed) when:

- It has neither `repoUrl` nor `links.github` set.
- The value present doesn't match `parseGithubRepoUrl`'s pattern (`https?://github.com/<owner>/<repo>`) — this covers non-GitHub hosts like GitLab or Codeberg, and malformed URLs.

The sync command does not look at `visibility`, `health.visibility`, or any curation field before deciding whether to process a record — every `.yml` file in the records directory is read regardless of its visibility.

## Handling a failed run

`grove sync github` doesn't throw or stop early on a per-record failure — both the API call and the HTML fallback are wrapped in their own `try/catch`, so a bad record just falls through to "unavailable" and the loop continues to the next file. The whole command only exits non-zero if `--strict` is set and at least one record ended up unavailable; records that did sync successfully are written regardless.

If the API returns `403` with an `x-ratelimit-remaining: 0` header, `github.ts` throws `GitHub API rate limit reached. Set GITHUB_TOKEN and rerun analyze.` — that error is caught by the CLI and treated the same as any other API failure (falls through to the HTML fallback).

## CI schedule

The example scaffold (`apps/example/.github/workflows/sync-github.yml`) runs on a weekly cron (`0 3 * * 0`, Sunday 03:00 UTC) plus `workflow_dispatch` for manual runs:

1. `pnpm install --frozen-lockfile`
2. `pnpm exec grove sync github`, with `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` in the environment
3. `peter-evans/create-pull-request@v6` opens a PR (branch `chore/sync-github`) if the run changed any files

`fetchGithubMetadata` resolves its token from `GH_TOKEN` first and `GITHUB_TOKEN` second, so either name works — including a personal access token you set yourself for higher rate limits.

## What is NOT synced

- **Releases** — only `latestReleaseAt` (the single latest release's `published_at`) is written; no release list or notes.
- **Issues / PRs** — `open_issues_count` is written, but no per-issue or per-PR data.
- **Private repositories** — the HTML fallback scrapes a public page, so it won't work on a private repo; the API path needs a token with access.
- **Non-GitHub hosts** — GitLab, Codeberg, Bitbucket, etc. don't match `parseGithubRepoUrl` and are skipped.
- **`health`** — `grove sync github` never calls `classifyHealth` and never writes a record's `health` block. Whatever `health` a record carries has to come from somewhere else.
- **Contributors** — a separate command, [`grove sync contributors`](/automation/sync-contributors/), handles that.

## Programmatic API

```ts
import {
  parseGithubRepoUrl,
  fetchGithubMetadata,
  enrichFromGithubHtml,
  buildGithubSyncPatch,
} from "@grove-dev/core";

const ref = parseGithubRepoUrl("https://github.com/ollama/ollama");
if (ref) {
  const metadata = await fetchGithubMetadata(ref); // reads process.env.GITHUB_TOKEN by default
  if (metadata) {
    const patch = buildGithubSyncPatch(metadata, existingRecord.github);
    // ...merge `patch` into the record and write it back yourself
  } else {
    const enriched = await enrichFromGithubHtml("https://github.com/ollama/ollama");
    // enriched.fields.{license, language, topics, homepage}
  }
}
```

The full programmatic surface is in [Programmatic API](/reference/api-core/).

## Related

- [Record schema](/reference/record-schema/) — every field a record file may carry, including `github.*`
- [Maintain health signals](/content/health-classification/) — why `health.*` is not part of this sync
- [Decisions](/concepts/decisions/) — the curator layer that overrides visibility
- [Cleanup report](/automation/cleanup/) — the command that flags stale/archived records for review
- [Scheduled maintenance](/automation/scheduled/) — the workflow cadence this runs on
- [CLI reference — `grove sync github`](/reference/cli/#grove-sync-github) — flag reference
