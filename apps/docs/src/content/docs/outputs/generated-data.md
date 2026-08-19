---
title: Generated data files
description: JSON datasets and review artifacts written under data/generated/.
---

`data/generated/` is rewritten on every `grove check` (or every Astro build). The contents are reproducible from the source files plus `grove.config.ts`. Don't edit by hand; **do** consume them.

## Files

| File | Contents | Producer |
|---|---|---|
| `records.full.json` | Every record with every field resolved. | `generate()` (in `packages/core/src/build-data.ts`) |
| `records.index.json` | Trimmed index — id, slug, name/title, category, tags, visibility. | same |
| `records.json` | Alias of `records.full.json`. | same |
| `site-config.json` | Resolved `grove.config.ts` plus audit metadata. | same |
| `cleanup-report.json` | Output of `grove cleanup` — records flagged for human review. | `cleanupStale()` in `packages/core/src/decisions.ts` |
| `contributors.json` | Output of `grove sync contributors`. | `syncContributors()` in `packages/core/src/contributors.ts` |
| `repo-stats.json` | Per-repository activity totals, written alongside `contributors.json`. | same |
| `og-manifest.json` | Map of generated OG cards — page → file path. | `buildOgImages()` in `packages/core/src/og-image.ts` |

## `records.json` shape

```jsonc
{
  "records": [
    {
      "id": "ollama",
      "slug": "ollama",
      "kind": "project",
      "name": "Ollama",
      "description": "Get up and running with large language models locally.",
      "category": "ai-tools",
      "tags": ["llm", "local"],
      "visibility": "keep",
      "github": { "stars": 0, "forks": 0, /* ... */ }
      // ...every field of the record's schema, including health, scores, etc.
    }
  ],
  "taxonomy": {
    "categories": [/* id, name, description */],
    "stacks": [/* ... */],
    "platforms": [/* ... */],
    "licenses": [/* id, name, spdx_id, url */]
  },
  "site": {
    "name": "My Space",
    "url": "https://example.com"
  }
}
```

The Astro integration and any custom consumer code consumes `records.json` through Vite aliases (`@grove/generated`) so the import path is stable across site structures.

## `site-config.json` shape

```jsonc
{
  "site": { "name": "My Space", "url": "https://example.com" /* ... */ },
  "blueprint": "project-directory",
  "nav": [/* ... */],
  "footer": { /* ... */ },
  "audit": { "pages": [/* ... */ ] }
  // ...every field of grove.config.ts, resolved and ready to read
}
```

## Consumers of `data/generated/`

- `@grove-dev/astro`'s server adapters (`/server`) read the JSON to build record index, taxonomy tables, and collection pages.
- Consumer pages in `src/pages/**/records.json.ts` (or built-in `DirectoryIndexClient`) consume the same files.
- CI workflows read `cleanup-report.json` to surface review candidates.
- External scripts and tooling can read `records.json` to build custom surfaces (notebooks, dashboards).

## What you'll do with this directory day-to-day

- **Debug a record?** Check `records.json` after `pnpm exec grove check` to see what the framework thinks the record is.
- **Confirm a sync?** Compare `github.sync.syncedAt` in `records.json` against your most recent `grove sync github` run.
- **Audit a curation?** `cleanup-report.json` is the canonical triage list. `git diff data/generated/cleanup-report.json` shows what sync changed.
- **Need a custom report?** Write a small script that reads `records.json`. The format is documented; it's safe to depend on.

## What you should NOT do

- Don't edit any file under `data/generated/`. They're disposable.
- Don't commit a fix to a record by editing `records.json`. Edit the source YAML in `data/records/<slug>.yml` and re-run `grove check`.
- Don't `git checkout data/generated/` after a bot PR — it usually reverts work that the bot needs you to review.

## See also

- [Outputs overview](/outputs/overview/) — every artifact Grove produces.
- [Cleanup report](/automation/cleanup/) — how the cleanup report is produced and consumed.