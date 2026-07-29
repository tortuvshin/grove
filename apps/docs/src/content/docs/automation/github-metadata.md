---
title: GitHub metadata
description: Keep stars, forks, last-pushed dates, license, and language fresh automatically through scheduled GitHub Actions.
---

Enable GitHub metadata sync in `grove.config.ts`:

```ts
integrations: {
  github: {
    metadata: true,
    health: true,
  },
},
```

Then run the sync manually, or let the scheduled `sync-github.yml` workflow do it.

```bash
grove sync github                # enrich every record with live metadata
grove sync github --limit 10     # only the first 10 records (rate-limit guard)
grove sync github --strict       # fail if any record could not be synced
```

The sync writes a `github.repository` block back into each record YAML — reviewable in a pull request. No token is required for public repositories; a `GITHUB_TOKEN` raises the rate limit.

Full guide: **[Sync GitHub metadata](/guides/sync-github-metadata/)**.