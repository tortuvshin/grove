---
title: Sync GitHub metadata
description: Keep stars, forks, last-pushed dates, license, and language fresh automatically through scheduled GitHub Actions.
---

The GitHub metadata sync enriches each record's `github.repository` block with live data from the GitHub API: stars, forks, watchers, the last-pushed date, license, primary language, topics, and homepage. The sync runs against the canonical `repoUrl` and writes back into the record YAML — reviewable in a pull request.

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

## API → HTML fallback

When the GitHub API rate-limits the sync (5,000/hour is generous but not infinite for large directories), or when the repository is private / behind a firewall, the sync falls back to scraping the public repo page HTML.

```
[sync github] owner/repo ... updated             # API success
[sync github] owner/repo ... html-fallback        # HTML scraping (partial fields)
[sync github] owner/repo ... skipped (no repoUrl) # record has no repoUrl
[sync github] owner/repo ... skipped (api+html error) # both methods failed
```

The HTML fallback is best-effort — it cannot recover the `stargazers_count` exactly (it reads the page-visible "12.3k" string) but it does pick up license, language, topics, homepage, and the last-pushed date.

When the fallback fires, `github.sync.source` is `"html"`. The renderer treats `"api"` and `"html"` sources identically for display; only `grove check --strict` differentiates (and only when the field set differs from the canonical API shape).

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

## Skipped records

Records are skipped (not failed) when:

- `repoUrl` is missing.
- `repoUrl` does not parse as a GitHub URL (`parseGithubRepoUrl` returns `null`).
- The owner or repo name contains invalid characters.
- The record is `visibility: remove` or `visibility: hide`.

Skipped records are printed to stdout; the command exit code is `0` unless `--strict` is set and any record failed.

## What is NOT synced

- **Releases** — `github.repository` does not include releases. To track release dates, use `decisions.yml` to add a curator note.
- **Issues / PRs** — the public API exposes counts; Grove does not sync these (they're not in `IndexRecord`).
- **Private repositories** — the HTML fallback won't work on private repos. The API requires a token with `repo` scope.
- **Non-GitHub hosts** — `gitlab.com`, `codeberg.org`, `bitbucket.org` are unparseable and skipped. Use the record's `links.homepage` and `links.source` for non-GitHub projects.

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

- [Health classification](/sources/health-classification/) — what `health.status` means and how it's derived
- [Decisions](/sources/decisions/) — overriding auto-derived health signals
- [Scheduled maintenance](/automation/scheduled/) — the workflow that runs this on a cron
- [CLI reference — `grove sync github`](/reference/cli/#grove-sync-github) — full flag reference