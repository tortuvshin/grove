---
title: "Walkthrough: sync GitHub metadata"
description: Enrich every record with live stars, forks, language, topics, and the auto-derived health block, end-to-end.
---

By the end of this walkthrough every record that has a `repoUrl` will have a populated `github.*` block and a derived `health.*` block. The walkthrough assumes you have at least one record with `repoUrl` set. If not, complete [Walkthrough: add your first record](/guides/walkthrough-add-record/) first.

> **Heads up:** this walkthrough requires a GitHub personal access token (PAT). Without one, the sync command fails with a clear auth error. You can complete the rest of the walkthrough up to step 3 with no token; step 4 onwards requires one.

## 1. Create a GitHub token

Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**. Create a token with:

- **Resource owner:** your own user (or the org that owns the repos)
- **Repository access:** "Public Repositories (read-only)"
- **Permissions:**
  - `Metadata: Read-only`
  - `Contents: Read-only`

The minimum scopes are `public_repo` (classic token) or the fine-grained equivalents above.

## 2. Add the token to `.env`

```bash
echo 'GITHUB_TOKEN=ghp_…' >> .env
```

Grove reads `.env` automatically via the Astro integration. **Do not commit it.** Add `.env` to your `.gitignore` if it isn't there.

```bash
git status .env   # confirm it's ignored
```

## 3. Enable the GitHub integration

Open `grove.config.ts` and enable the GitHub integration:

```ts
integrations: {
  github: {
    metadata: true,     // refresh stars, forks, language, topics, license
    contributors: true, // aggregate contributor counts
  },
}
```

The dev server picks up the config change after a restart. Kill `pnpm dev` and re-run it.

## 4. Run the sync

```bash
pnpm exec grove sync github
```

The command walks every record, calls the GitHub REST API for the repo at `repoUrl`, and writes back into the record YAML:

- `github.repository` — the raw REST shape (id, full_name, default_branch, html_url, ...).
- `github.languages` — language breakdown with byte counts.
- `github.sync` — `{ syncedAt, source }` provenance.

It also computes `health.*` from the GitHub signals (last-pushed date, archive flag, stars, etc.).

**What you should see:** the command prints the records it processed and the new sync timestamp. If a record has a missing `repoUrl`, it's skipped with a clear warning.

## 5. Inspect the new fields

Open any record that has a `repoUrl`:

```yaml
kind: project
name: astro
repoUrl: https://github.com/withastro/astro
github:
  repository:
    id: 79145104
    full_name: withastro/astro
    html_url: https://github.com/withastro/astro
    stargazers_count: 51234
    archived: false
  languages:
    TypeScript: 87123123
  sync:
    syncedAt: "2026-04-01T10:23:00Z"
    source: api.github.com
health:
  status: active
  maturity: useful
  tier: curated
  visibility: keep
  cleanupCandidate: false
  confidence: high
  reasons:
    - 51234-stars
    - last-commit-2026-03
```

If `stargazers_count >= 500`, the record is automatically promoted to `tier: curated`. The threshold is checked every sync — there's no editor override.

## 6. Commit and open the PR

```bash
git add data/records/*.yml
git commit -m "Sync GitHub metadata"
git push
```

**What you should see:** the diff is contained to `github.*` and `health.*` blocks. Review the diff to make sure no curator content was overwritten — the merge contract guarantees that curator additions outside the sync surface survive a re-run, but a quick review confirms it.

## Schedule the sync

Don't run `grove sync github` by hand every week. The scaffold ships a `.github/workflows/sync-github.yml` that runs weekly and commits any changes back to the repository:

```yaml
# .github/workflows/sync-github.yml (already in the scaffold)
on:
  schedule:
    - cron: "0 6 * * 1"   # every Monday at 06:00 UTC
  workflow_dispatch:
```

Add a `GITHUB_TOKEN` repository secret in **Settings → Secrets → Actions** for the workflow to use. The default token has read access; for higher rate limits, create a dedicated PAT and add it as `GROVE_GITHUB_TOKEN`.

## Next steps

- [Triage health signals →](/content/health-classification/) — what to do when the report flags records as stale.
- [Cleanup report →](/automation/cleanup/) — the monthly triage report.