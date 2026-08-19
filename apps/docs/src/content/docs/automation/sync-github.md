---
title: Sync GitHub metadata
description: Keep stars, forks, last-pushed dates, license, and language fresh automatically through scheduled GitHub Actions.
---

The GitHub metadata sync enriches each record's `github.repository` block with live data from the GitHub API: stars, forks, watchers, the last-pushed date, license, primary language, topics, and homepage. The sync runs against the canonical `repoUrl` and writes back into the record YAML — reviewable in a pull request.

This guide is for site maintainers who run (or schedule) the sync. If you're a contributor adding a single record, you don't need to read this — the sync step runs in CI on your PR.

## Enable

In `grove.config.ts`:

```ts
integrations: {
  github: {
    metadata: true,        // fetch stars, forks, last commit, etc.
    health: true,          // derive health.status from metadata
  },
},
```

The `metadata` flag controls `grove sync github`. The `health` flag derives `health.status`, `health.tier`, and `health.cleanupCandidate` from the metadata on every render.

## Run it

Locally:

```bash
grove sync github                # enrich every record with live metadata
grove sync github --limit 10     # only the first 10 records (rate-limit guard)
grove sync github --strict       # fail if any record could not be synced
```

In CI, the scaffold writes `.github/workflows/sync-github.yml`, a weekly cron plus `workflow_dispatch` for manual runs. The workflow:

1. Reads every `data/records/*.yml`.
2. For each, fetches `https://api.github.com/repos/<owner>/<repo>`.
3. Writes back a `github.repository` block + `github.sync.{syncedAt, source}`.
4. Opens a PR with the diff if anything changed.

No token is required for public repositories (60 requests/hour/IP). Set `GITHUB_TOKEN` (or `GH_TOKEN`) to raise the limit to 5,000 requests/hour/user.

## Authentication

`grove sync github` looks for a GitHub token in this order:

1. `GITHUB_TOKEN` (or `GH_TOKEN`) environment variable.
2. The token resolved by `gh auth token`, if the `gh` CLI is installed and authenticated.

If neither is set, the sync runs unauthenticated — fine for small directories, but it rate-limits quickly on anything over 50 records.

For local dev, the simplest setup is to install and authenticate the `gh` CLI; `grove sync github` picks up the token automatically. For CI, set `GITHUB_TOKEN` as a workflow secret — the `sync-github.yml` workflow the scaffold generates already does this.

## API → HTML fallback

When the GitHub API rate-limits the sync (5,000/hour is generous but not infinite for large directories), or when the repository is private / behind a firewall, the sync falls back to scraping the public repo page HTML.

```
[sync github] owner/repo ... updated             # API success
[sync github] owner/repo ... html-fallback        # HTML scraping (partial fields)
[sync github] owner/repo ... skipped (no repoUrl) # record has no repoUrl
[sync github] owner/repo ... skipped (api+html error) # both methods failed
```

The HTML fallback is best-effort — it cannot recover `stargazers_count` exactly (it reads the page-visible "12.3k" string), and it does not recover `forks_count` or `pushed_at` at all. It does pick up license, language, topics, and homepage.

When the fallback fires, `github.sync.source` is `"html"`. The renderer treats `"api"` and `"html"` sources identically for display; only `grove check --strict` differentiates (and only when the field set differs from the canonical API shape).

`api → html` fallback is normal on shared CI runners: GitHub's REST API allows 60 unauthenticated requests per hour per IP, and a 200-record directory can exhaust that in one run. The HTML fallback has no rate limit. A record with `github.html` only (no `github.repository`) won't have `stargazers_count`, `forks_count`, or `pushed_at` in its data, so `health.status` shows `unknown` for those fields until a later run succeeds via the API — for example, once a `GITHUB_TOKEN` is set.

## What gets written back

For a successful API sync:

```yaml
github:
  repository:
    full_name: ollama/ollama
    description: Get up and running with large language models.
    stargazers_count: 92000
    forks_count: 6300
    open_issues_count: 412
    pushed_at: "2026-08-10T18:21:33Z"
    updated_at: "2026-08-12T09:14:01Z"
    license:
      spdx_id: MIT
      name: MIT License
    language: Go
    topics: [llm, ollama, ai, local-llm]
    homepage: https://ollama.com
    archived: false
    disabled: false
  sync:
    syncedAt: "2026-08-14T03:11:42.000Z"
    source: api
```

For an HTML fallback, only the visible fields are populated:

```yaml
github:
  html:
    license: MIT
    language: Go
    topics: [llm, ai]
    homepage: https://ollama.com
    starsLabel: "92k"     # page-visible count (imprecise)
  sync:
    syncedAt: "2026-08-14T03:11:42.000Z"
    source: html
```

## Field precedence

When a record already has a `github.repository` block from a previous sync, the sync overwrites it. To preserve a hand-edited field, add it to `data/overrides.yml` instead — overrides win over the sync write.

For `repoUrl`:

- `record.repoUrl` is canonical.
- `record.links.github` is a fallback (used by import).
- If both are set and disagree, `repoUrl` wins and a warning is logged.

## Rate-limit strategies

The default `--limit` is unbounded (every record is synced). For large directories, plan ahead:

| Records | Recommended schedule | Token needed? |
|---|---|---|
| < 100 | Weekly cron | No |
| 100 - 1,000 | Weekly cron | Recommended (`GITHUB_TOKEN` for 5,000/hr) |
| 1,000 - 5,000 | Weekly cron + `--limit 1000` per run, multiple days | Required |
| > 5,000 | Daily cron, `--limit 500` per run, monthly full pass | Required |

For very large directories, run the sync in batches:

```bash
grove sync github --limit 500   # sync the first 500 records
git diff data/records/           # review the changes
git add data/records/ && git commit -m "sync github metadata (batch 1)"
grove sync github --limit 1000 --offset 500
```

The CLI does not currently expose `--offset`; this is a hand-rolled pattern until V1.1 ships pagination.

## Sync strategy: scheduled vs. per-PR

The default — and the right setup for most community-maintained directories — is the scaffolded `sync-github.yml` schedule: it runs weekly, catches new stars, archive events, and transfers automatically, and keeps the commit history reviewable at one PR-sized diff per week. Watch the Actions tab; a "Sync GitHub metadata" run that fails three weeks in a row usually means a token expired or a config change broke something.

For a stricter setup, run `grove sync github --strict` as a required check on PRs instead, so every PR touching `data/records/` also updates the GitHub-derived fields. The trade-off: PRs get slower, and a transient API failure blocks otherwise-good changes. Most sites do the opposite — schedule sync weekly and accept the lag, so record-content PRs go through normal review without sync in the loop.

## Skipped records

Records are skipped (not failed) when:

- `repoUrl` is missing.
- `repoUrl` does not parse as a GitHub URL (`parseGithubRepoUrl` returns `null`).
- The owner or repo name contains invalid characters.
- The record is `visibility: remove` or `visibility: hide`.

Skipped records are printed to stdout; the command exit code is `0` unless `--strict` is set and any record failed.

## What "drift" looks like

A record has drifted when its `github.repository.pushed_at` is older than the record's `health.reasons` suggests it should be. Most often, this means:

- The repo was archived upstream and you didn't notice.
- The repo was transferred to a new owner.
- The repo was deleted and the URL now 404s.

The cleanup step (`grove cleanup`, see [Health classification](/content/health-classification/)) flags all of these. If the report has a sudden spike in `archived` or `unavailable` candidates, check the upstream before writing decisions — sometimes it's a transfer, and the new owner is actively maintaining the project.

## Handling a failed run

When `grove sync github` fails outright (exit non-zero), the cause is almost always one of:

- **`GITHUB_TOKEN` not set in CI** — the workflow log shows 401s. Add the secret.
- **Network partition in CI** — the log shows `ECONNRESET`. Re-run.
- **A record's `repoUrl` points at a 404** — the log shows `skipped (api+html error)` for that slug. Either fix the URL or remove the record.
- **A record's `repoUrl` is unparseable** — the log shows `unparseable repoUrl, skipping`. The URL isn't a github.com URL; fix it or set `links.github` instead.

In all cases, the records that *did* sync are still written — the CLI doesn't roll back partial state.

## What is NOT synced

- **Releases** — `github.repository` does not include releases. To track release dates, use `decisions.yml` to add a curator note.
- **Issues / PRs** — the public API exposes counts; Grove does not sync these (they're not in `IndexRecord`).
- **Private repositories** — the HTML fallback won't work on private repos. The API requires a token with `repo` scope.
- **Non-GitHub hosts** — `gitlab.com`, `codeberg.org`, `bitbucket.org` are unparseable and skipped. Use the record's `links.homepage` and `links.source` for non-GitHub projects.
- **Contributors** — `grove sync github` only touches `github.repository`, `github.html`, and `github.sync`. Contributor refresh is a separate command, `grove sync contributors` (see [CLI reference](/reference/cli/#grove-sync-contributors)).
- **The `health` block directly** — it's computed at render time from `github.repository.pushed_at`, `archived`, and stars. Updating the `github` block changes what the next render computes, but the sync step doesn't touch `health` on the record YAML itself.
- **`data/health.yml`** — that file is a legacy format the validator no longer parses. `github.repository` on each record is the source of truth for the rendered health block.

## Programmatic API

```ts
import {
  parseGithubRepoUrl,
  fetchGithubMetadata,
  enrichFromGithubHtml,
  buildGithubSyncPatch,
  syncContributors,
} from "@grove-dev/core";

const { owner, repo } = parseGithubRepoUrl("https://github.com/ollama/ollama");
const metadata = await fetchGithubMetadata(owner, repo, {
  auth: process.env.GITHUB_TOKEN,
});
const html = await fetch(`https://github.com/${owner}/${repo}`).then(r => r.text());
const enriched = enrichFromGithubHtml(html);
const patch = buildGithubSyncPatch(metadata, enriched);
await syncContributors(records, { auth: process.env.GITHUB_TOKEN });
```

The full programmatic surface is in [Programmatic API](/reference/api-core/).

## Verifying the sync

After a sync, check:

1. **`github.sync.syncedAt`** is recent.
2. **`github.sync.source`** is `"api"` (good) or `"html"` (acceptable for failed API).
3. **`health.status`** is `active` for records with recent commits, `stale` for old ones.
4. **`health.tier`** matches expectations — `curated` for ≥500★, `listed` for ≥50★, `experimental` otherwise.

```bash
grove check --strict    # verify the syncs wrote valid YAML
pnpm dev                # inspect the record detail pages
```

## Related

- [Health classification](/content/health-classification/) — what `health.status` means and how it's derived
- [Decisions](/concepts/decisions/) — overriding auto-derived health signals
- [Scheduled maintenance](/automation/scheduled/) — the workflow that runs this on a cron
- [CLI reference — `grove sync github`](/reference/cli/#grove-sync-github) — full flag reference