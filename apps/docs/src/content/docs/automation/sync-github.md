---
title: Sync GitHub metadata
description: Keep stars, forks, license, language, and topics fresh by refreshing each record's GitHub data into the sync cache.
---

`grove sync github` fetches every record's repository from the GitHub REST API and writes the result to the **GitHub sync cache** — one JSON file per record under `paths.githubCache` (default `data/cache/github/<slug>.json`). Record YAML is read, never written: curators own `data/records/`, the sync bot owns the cache, and reviewers own `data/decisions.yml`. A sync pull request only ever touches the cache directory, so its diff is star counts and timestamps, not your curated records.

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

:::note[`health: true` writes `health` into the cache entry]
When `integrations.github.health` is enabled, every record synced via the API path gets a `health` block in its cache entry (derived by `classifyHealth` in `packages/core/src/health.ts`) — one file per record, so two records syncing at once never contend for the same file. `data/health.yml` is only read as a fallback for records with no health in the cache or inline.
:::

If `integrations.github.metadata` is `false`, running `grove sync github` prints `[sync github] disabled by integrations.github.metadata — skipping` and exits without reading any files.

## What it does, in order

For each `.yml` file in `config.paths.recordsDir` (default `data/records`, sorted alphabetically, optionally truncated by `--limit`):

1. Parses the file and reads `repoUrl`, falling back to `links.github` if `repoUrl` is unset.
2. If neither is set, logs `[sync github] <file>: no repository, skipped` and moves on.
3. Parses the URL with `parseGithubRepoUrl`. If it doesn't match `https?://github.com/<owner>/<repo>`, logs `[sync github] <file>: invalid GitHub URL, skipped`.
4. Tries `fetchGithubMetadata(ref)` — a `GET /repos/<owner>/<repo>` call, followed by `GET /repos/<owner>/<repo>/releases/latest` for the latest release date. Any thrown error (rate limit, network failure, non-2xx status) is caught, its message is kept as the record's reason, and the run falls through to step 5.
5. If the API call didn't produce metadata, tries `enrichFromGithubHtml(repoUrl)` — an unauthenticated fetch of the public `https://github.com/<owner>/<repo>` HTML page.
6. If both sources failed, logs `[sync github] <file>: unavailable` and counts it as failed. The cache entry keeps its previous `github` and `health` and gains a `partialFailures` entry for each failed source; `lastSuccessAt` does not move.
7. On success from either source, merges the result into the previous `github` block (from the cache entry, or — before [migration](#migrating-from-inline-blocks) — from the record's inline block) and writes `data/cache/github/<slug>.json`, logging `[sync github] <file>: api` or `[sync github] <file>: html`.
8. After all files, prints the [end-of-run summary](#end-of-run-summary): a totals line, then one row per record that fell back to HTML or failed. If any record still carries an inline `github`/`health` block, it also prints how many and points at `grove migrate github-cache`.

Skipped records (no repository, invalid URL) are only reported by their per-file log line — they are not counted as failures and don't appear in the summary. Nothing is written to disk for skips.

## The cache file

One file per record, `<paths.githubCache>/<slug>.json`:

```json
{
  "schemaVersion": 1,
  "slug": "ollama",
  "repoUrl": "https://github.com/ollama/ollama",
  "source": "api",
  "lastSuccessAt": "2026-08-14T03:11:42.000Z",
  "partialFailures": [
    { "at": "2026-08-07T03:10:58.000Z", "source": "api", "reason": "GitHub API 502 Bad Gateway" }
  ],
  "sourceDescription": "Get up and running with large language models.",
  "github": { "repository": { "stargazers_count": 92000 }, "sync": { "syncedAt": "2026-08-14T03:11:42.000Z", "source": "api" } },
  "health": { "status": "active", "tier": "curated", "visibility": "keep" }
}
```

| Field | Meaning |
| --- | --- |
| `source` | Which fetch path delivered the data now in `github`: `api` or `html`. |
| `lastSuccessAt` | When the GitHub API last delivered a full refresh. An HTML fallback or a failure never moves it. `null` when the API has never succeeded for this record. |
| `partialFailures` | The last 5 failed fetches, oldest first: `{ at, source, reason }`. Kept after a later success, so the history stays visible. |
| `sourceDescription` | The repository description GitHub reports. Stored for curators and tools; the build does not merge it into the record. |
| `github` | The block the build uses as the record's `github` — same shape as [before](#what-gets-written-back). |
| `health` | The block the build uses as the record's `health`, when `integrations.github.health` is on. |

The writer is deterministic: fixed top-level key order, nested blocks in the order sync builds them, two-space indent and a trailing newline. A file whose bytes would not change is not rewritten, and a re-run on unchanged upstream data only changes the timestamps.

### Staleness

A failed or partial sync keeps the previous data rather than blanking it — but it does not pretend the data is fresh. When the newest `partialFailures[].at` is later than `lastSuccessAt`, the entry is stale: the values are from `lastSuccessAt`, and the failure says why nothing newer arrived. An entry is also stale when `lastSuccessAt` is missing or older than `sync.github.maxAgeDays` (default 14 days) — a sync that stopped running fails no fetch, but its data still ages.

Readers act on it: `resolveRecordGithub` (with the options from `githubSyncFreshnessOptions(config)`) resolves a stale entry's health as `status: unknown` with `staleReason: sync_stale`, keeping `tier` and `visibility`. `grove check` reports every such record in a single `github_sync_stale` warning. The file on disk is untouched — `githubSyncFreshness(entry)` tells you why it is stale.

### Precedence and conflicts

Every reader — the build (`generate`), `grove check`, `grove cleanup` and `grove readme generate` — takes its records from the same normalizer (`loadNormalizedRecords`), which resolves a record's `github` and `health` through `resolveRecordGithub`:

1. the cache entry, for each block it carries;
2. the record's own inline block (written by Grove 0.12 and earlier);
3. for `health` only, the record's entry in `paths.health` (`data/health.yml`).

When a record carries an inline block **and** the cache has one that disagrees (stars, forks, `pushed_at`, `archived`, license; or health `status`, `tier`, `visibility`), `grove check` emits a `github_cache_mismatch` warning naming the fields. The cache still wins. Other cache checks: `github_cache_invalid` (error — a file that is not valid JSON or not a cache entry; the build skips it and falls back to inline) and `github_cache_orphan` (warning — a cache file with no matching record, e.g. after a record was deleted).

### Committing the cache

The cache is committed, not gitignored: it is observed network state that a build cannot recreate offline, which is why it lives under `data/cache/` and not in `paths.generatedDir` (which consumers gitignore and may delete as a build artefact). No `.gitignore` change is needed with the default path. If you point `paths.githubCache` inside an ignored directory, add a negation such as `!data/generated/github/`.

## Migrating from inline blocks

Records synced by Grove 0.12 or earlier carry `github:` and `health:` inline. Move them into the cache once:

```bash
grove migrate github-cache --check   # exit 1 if any record still carries an inline block; writes nothing
grove migrate github-cache           # move them
```

For each record with an inline block, the migration writes the cache entry first and then strips the two top-level keys from the YAML. Every other line of the record — comments, quoting, key order — is left byte-for-byte as it was. `lastSuccessAt` is seeded from the inline `github.sync.syncedAt` when that sync came from the API. If a cache entry already exists (a sync ran before the migration), the cache entry is kept and the inline copy only fills blocks it lacks; any disagreement is printed. Running it again is a no-op.

Until you migrate, nothing breaks: the build reads inline blocks as a fallback, and the first sync seeds its merge from them.

## End-of-run summary

A clean run ends with one line:

```text
[sync github] 42 updated (0 HTML fallback), 0 failed
```

When any record fell back to HTML or failed, a table follows with the record slug, the outcome, and a short reason — the API error (HTTP status or network message) and, for failures, why the HTML fallback didn't work either. Rows are sorted by slug so the output is the same from run to run:

```text
[sync github] 41 updated (1 HTML fallback), 1 failed
  slug       outcome        reason
  dead-repo  failed         API: repository not found; HTML: not found
  ollama     html fallback  API: GitHub API rate limit reached. Set GITHUB_TOKEN and rerun analyze.
```

Records synced through the API with no problem are left out of the table. Reasons are single-line and truncated to 160 characters; they come from HTTP status lines and `fetch` errors, never from request headers, so the token doesn't leak into logs.

### GitHub Actions job summary

When `GITHUB_STEP_SUMMARY` is set — GitHub Actions sets it for every step — the same summary is **appended** to that file as Markdown, so it shows on the workflow run's summary page:

```md
### grove sync github

**41 updated (1 HTML fallback), 1 failed**

| Record | Outcome | Reason |
| --- | --- | --- |
| `dead-repo` | failed | API: repository not found; HTML: not found |
| `ollama` | html fallback | API: GitHub API rate limit reached. Set GITHUB_TOKEN and rerun analyze. |
```

The file is only ever appended to, never truncated, so summaries from earlier steps in the same job survive. Outside Actions (the variable is unset) nothing is written.

## Run it

```bash
grove sync github                # sync every record in data/records/
grove sync github --limit 10     # only the first 10 records, sorted by filename
grove sync github --strict       # exit code 1 if any record ended up "unavailable"
```

`--limit` always takes the **first N files alphabetically** (`files.slice(0, options.limit)`). There is no `--offset` flag and no stored progress between runs — running `--limit 10` twice in a row syncs the same 10 files both times. If you need to bound API usage per run on a large directory, `--limit` caps the ceiling; it does not let you page through the rest of the records on a later run.

`--strict` doesn't stop the loop early — every selected file is still processed and the summary is still printed (and appended to the job summary). It only flips the process exit code to `1` at the end if at least one record failed, which is what makes it useful as a CI gate. An HTML fallback counts as a successful refresh, not a failure. Without `--strict` the command exits `0` even when records failed — read the summary to see which ones.

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

For a successful API sync, `buildGithubSyncPatch` (`packages/core/src/github.ts`) writes these fields into the cache entry's `github.repository`, spread on top of whatever was already there so unrelated custom keys survive. Shown here as YAML for readability; the cache stores the same structure as JSON:

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
health:                                      # the entry's health block, when enabled
  status: active
  maturity: mature
  tier: curated
  visibility: keep
  cleanupCandidate: false
  confidence: high
  reasons: [active-development]
```

Notes on this shape:

- `license.spdx_id` and `license.name` are both set to the **same** string (whichever GitHub returned — SPDX id preferred, falling back to the license's display name). The API's own `license.name` (which can differ from the SPDX id) is not fetched into a separate field.
- `latestReleaseAt` and `homepage` live at the top level of `github`, not nested inside `repository` — that's deliberate (see the comment on `buildGithubSyncPatch`).
- Fields `fetchGithubMetadata` fetches from the API but that `buildGithubSyncPatch` never writes back: `watchers_count`, `created_at`, `description`, `html_url`, `size`, `visibility`, `fork`, `private`. If you need one of those, it isn't part of the sync's write surface today.
- A sync also drops `github.latestRelease`, `github.files`, and `github.labels` if they're present — leftover full-blob fields an older sync version wrote that nothing reads today. `github.languages` and `github.activity` are kept; they're read by the record page.

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

Within `github.repository`, sync always overwrites the specific fields listed above on every successful API run — there is no per-field opt-out. Anything else already present in the previous `github` block is carried forward by the merge, and the record file itself is never touched.

`data/overrides.yml` is applied by the record normalizer, not by the sync, so the build, `grove check`, `grove cleanup` and `grove readme generate` all see the patched record. Each entry is `{ id, patch }`, and the patch's top-level keys are merged over the record (after the cache) before schema validation:

```yaml
overrides:
  - id: some-project
    patch:
      description: A description the upstream README got wrong.
      category: developer-tools
```

Because it runs at build time, an override survives every `grove sync github` run — the sync rewrites the cache entry, the override re-applies on top. That makes it the right place to correct an imported record you do not want to hand-edit, including a `github` or `health` value the cache would otherwise supply.

For `repoUrl` resolution: `record.repoUrl` is read first, falling back to `record.links.github` if unset. The sync command does not compare the two or warn when they disagree — it just uses whichever one resolves.

## Skipped records

A file is skipped (not counted as failed) when:

- It has neither `repoUrl` nor `links.github` set.
- The value present doesn't match `parseGithubRepoUrl`'s pattern (`https?://github.com/<owner>/<repo>`) — this covers non-GitHub hosts like GitLab or Codeberg, and malformed URLs.

The sync command does not look at `visibility`, `health.visibility`, or any curation field before deciding whether to process a record. Every record is read regardless of its visibility: each `.yml` file in `paths.recordsDir` and each Markdown record in `paths.bodiesDir`, discovered by the same `readRecordSources` the build uses. Record files of either format are never written.

## Handling a failed run

`grove sync github` doesn't throw or stop early on a per-record failure — both the API call and the HTML fallback are wrapped in their own `try/catch`, so a bad record just falls through to "unavailable" and the loop continues to the next file. A failed record keeps its previous `github` block in the cache, with the failure appended to `partialFailures`, which is why the [end-of-run summary](#end-of-run-summary) names every failed record and its reason. The whole command only exits non-zero if `--strict` is set and at least one record ended up unavailable; records that did sync successfully are written regardless.

If the API returns `403` with an `x-ratelimit-remaining: 0` header, `github.ts` throws `GitHub API rate limit reached. Set GITHUB_TOKEN and rerun analyze.` — that error is caught by the CLI and treated the same as any other API failure (falls through to the HTML fallback).

## CI schedule

The example scaffold (`apps/example/.github/workflows/sync-github.yml`) runs on a weekly cron (`0 3 * * 0`, Sunday 03:00 UTC) plus `workflow_dispatch` for manual runs:

1. `pnpm install --frozen-lockfile`
2. `pnpm exec grove sync github`, with `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` in the environment — the fallback/failure table lands on the run's summary page via `GITHUB_STEP_SUMMARY`
3. `peter-evans/create-pull-request@v6` opens a PR (branch `chore/sync-github`) if the run changed any files, with `add-paths: data/cache/github/**` so the PR can only ever contain cache files

`fetchGithubMetadata` resolves its token from `GH_TOKEN` first and `GITHUB_TOKEN` second, so either name works — including a personal access token you set yourself for higher rate limits.

## Channel and media candidates

With `integrations.github: { metadata: true, candidates: true }`,
`grove sync github` also looks for review material for each record it
refreshed. The results go into the record's cache entry under
`candidates`:

- **Channels** — each channel is shaped like a `distribution.channels[]` entry, with `facts` and `provenance` added:
  - F-Droid, when an Android app module's Gradle `applicationId` is in F-Droid's package API.
  - Flathub, when an AppStream metainfo file in the repository names an app id that Flathub has. Without metainfo, a Flathub search result counts only when its AppStream URLs point back at the repository.
  - Repology packages: Homebrew, AUR, Arch, Nixpkgs, Scoop, winget, Chocolatey, Snapcraft, Flathub and F-Droid. Repology projects are matched by name only, so `facts.versionMatchesRelease` says whether a package version equals the latest release tag.
  - GitHub Releases whose latest release ships installable assets, one entry per platform.
- **Logos:**
  - fastlane `images/icon.png`
  - AppStream `<icon type="remote">`
  - the best icon of a web app manifest
  - `logo*` / `icon*` files in asset directories
- **Screenshots** — fastlane `phoneScreenshots/`, in one locale with en-US first, and AppStream `<screenshots>`.

The following are never picked:

- README images
- anything under `node_modules`, `vendor`, `Pods`, `docs`, `.github`, tests or examples
- banners, social cards, splash screens and previews
- a file name repeated across three or more packages (plugin icons)
- raster files under 128 px

Every candidate carries `provenance: { source, url, fetchedAt }`. Files in the repository are pinned to a commit permalink and carry their `blobSha`, byte size and, from a 16 KB range request, their format and pixel size. Git LFS pointers are followed to `media.githubusercontent.com`. Nothing is downloaded in full, and nothing is hotlinked: a reviewer copies an approved file into the site.

**Bounded and never fatal:**

- Each record may make at most `CANDIDATE_REQUESTS_PER_RECORD` (24) requests.
- A host that answers 429, or fails twice in a row, is skipped for the rest of the run.
- Repology is asked at most once per second, with a `grove/<version>` User-Agent.
- A failed lookup is written to `partialFailures` with `source: candidates`. It never makes the entry stale and never fails the record.
- The candidates a failed source found last time are kept.
- An unchanged candidate keeps its previous `fetchedAt`, and a repository file keeps its permalink while its blob is unchanged, so a re-run does not rewrite the cache.

**Review.** Run [`grove candidates`](/reference/cli/#grove-candidates) to list pending candidates. Approve or reject one in `paths.decisions`:

```yaml
candidates:
  - id: immich            # record slug
    kind: logo            # channel | logo | screenshot
    url: https://github.com/immich-app/immich/blob/<commit>/mobile/android/fastlane/metadata/android/en-US/images/icon.png
    verdict: approved     # approved | rejected
    reason: The app's own launcher icon, as shipped to F-Droid.
    reviewedBy: maintainer
    reviewedAt: 2026-09-26
    provenance: { source: fastlane, url: <as listed>, fetchedAt: <as listed> }
```

`grove check` reports a verdict whose `id` matches no record
(`unknown_candidate_review_record`). Approval never edits the record; copying the channel or file into it stays a curator's change.

## What is NOT synced

- **Releases** — only `latestReleaseAt` (the single latest release's `published_at`) is written; no release list or notes.
- **Issues / PRs** — `open_issues_count` is written, but no per-issue or per-PR data.
- **Private repositories** — the HTML fallback scrapes a public page, so it won't work on a private repo; the API path needs a token with access.
- **Non-GitHub hosts** — GitLab, Codeberg, Bitbucket, etc. don't match `parseGithubRepoUrl` and are skipped.
- **Health when the flag is off** — with `integrations.github.health` disabled (or unset), `grove sync github` never calls `classifyHealth`. The cache entry keeps whatever `health` it already had; otherwise it has to come from somewhere else.
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
    const patch = buildGithubSyncPatch(metadata, previousEntry.github);
    // ...fold it into a cache entry with nextGithubCacheEntry and
    // write it with writeGithubCacheEntry
  } else {
    const enriched = await enrichFromGithubHtml("https://github.com/ollama/ollama");
    // enriched.fields.{license, language, topics, homepage}
  }
}
```

The full programmatic surface is in [Programmatic API](/reference/api-core/).

## Related

- [Record schema](/reference/record-schema/) — every field a record file may carry, including the legacy inline `github.*`
- [Maintain health signals](/content/health-classification/) — how `health.*` is derived and where it lands when the `health` flag is on or off
- [Decisions](/concepts/decisions/) — the curator layer that overrides visibility
- [Cleanup report](/automation/cleanup/) — the command that flags stale/archived records for review
- [Scheduled maintenance](/automation/scheduled/) — the workflow cadence this runs on
- [CLI reference — `grove sync github`](/reference/cli/#grove-sync-github) — flag reference
