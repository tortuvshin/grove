---
title: Generated data files
description: The JSON files under data/generated/ — who writes each one, what shape it has, and which ones a build regenerates.
---

`data/generated/` holds derived JSON. Nothing in it is a source of truth, and
nothing in it should be hand-edited — but it is meant to be read, both by
Grove's own Astro adapters and by whatever you want to build on top.

Not everything here is rewritten on every build. That distinction matters
when you are debugging why a file looks stale.

## Written on every `grove check` and every Astro build

| File | Contents |
|---|---|
| `records.full.json` | Every record, normalized, regardless of visibility |
| `records.index.json` | Slim payload, **visible records only** |
| `records.json` | Byte-for-byte alias of `records.full.json` |
| `site-config.json` | Resolved `grove.config.ts` plus taxonomy and counts |
| `og-manifest.json` | OG card path → content hash, so unchanged cards are not re-rendered |

All five come out of `generate()` in `packages/core/src/build-data.ts`, which
`prepareDirectory()` runs as the first step of the build pipeline.

## Written only by their own command

| File | Command |
|---|---|
| `cleanup-report.json` | `grove cleanup` |
| `contributors.json` | `grove sync contributors` |
| `repo-stats.json` | `grove sync contributors` |

:::caution[A build will not refresh these]
`grove check` does not regenerate `cleanup-report.json`, `contributors.json`,
or `repo-stats.json`. If they look out of date, it is because nobody ran the
command — locally or in the scheduled workflow.
:::

## `records.full.json` and `records.json`

```jsonc
{
  "schemaVersion": 1,
  "blueprint": "project-directory",
  "generatedAt": "2026-08-20T16:40:34.448Z",
  "totalRecords": 6,
  "visibleRecords": 6,
  "records": [ /* … */ ]
}
```

Each entry carries the record's fields as the schema resolved them — defaults
filled in, slug normalized to the filename. For a project record that is
`slug`, `kind`, `name`, `description`, `category`, `tags`, `links`,
`content`, `curation`, `scores`, `source`, `visibility`, plus the project
fields: `projectType`, `stack`, `stacks`, `platforms`, `licenses`,
`difficulty`, `codebaseSize`, `repoUrl`, `screenshots`, `bestFor`,
`whyListed`, `caveats`, `distribution`, and `github` / `health` when the
record has them.

There is no `taxonomy` key and no `site` key in this file — those live in
`site-config.json`.

## `records.index.json`

Same envelope minus `visibleRecords`, and a smaller record shape: `scores`,
`source`, and `distribution` are dropped. More importantly, records whose
effective visibility excludes them are **not in this file at all**, which is
why `totalRecords` here can be lower than in `records.full.json`.

This is the file `grove sync contributors` reads to discover which
repositories to aggregate.

## `site-config.json`

```jsonc
{
  "blueprint": "project-directory",
  "blueprintConfig": { /* … */ },
  "name": "My Space",
  "tagline": "…",
  "description": "…",
  "siteUrl": "https://example.com",
  "repoUrl": "https://github.com/you/your-space",
  "locale": "en",
  "nav": [ /* … */ ],
  "footer": { /* … */ },
  "submission": { /* … */ },
  "analytics": { /* … */ },
  "browse": { /* … */ },
  "theme": { /* … */ },
  "integrations": { /* … */ },
  "contributors": { /* … */ },
  "taxonomy": {
    "categories": [], "stacks": [], "platforms": [],
    "topics": [], "distributionChannels": [], "licenses": []
  },
  "stats": { "totalRecords": 6, "totalCategories": 5, /* … */ }
}
```

`taxonomy` is the resolved contents of `data/taxonomy/`, and `stats` is a flat
block of counts (`totalRecords`, `totalApps`, `totalCategories`,
`totalStacks`, `totalPlatforms`, `totalStars`, and the repository totals).
There is no `audit` key here.

## `og-manifest.json`

A flat map from OG image path to content hash:

```json
{
  "home.png": "95744d04325474eb3225c5a0d2bfb5df0a526be8",
  "records/crewai.png": "a099cc5fed9107ca547eb5db9a8cced450c59ab5"
}
```

The paths are relative to `public/og/`. The hashes let the build skip
re-rendering a card whose inputs did not change — the manifest is not a
lookup table for finding an image, since the path is derivable from the slug.

## `repo-stats.json`

A single flat object about your own repository, not the records:

```json
{ "repoUrl": "https://github.com/you/your-space", "stars": 0, "forks": 0, "contributors": 0 }
```

## Reading these files

Inside a Grove Astro project, `@grove-dev/astro` registers a Vite alias so the
path is stable regardless of where your page lives:

```ts
import records from "@grove/generated/records.json";
```

The alias resolves to `data/generated/` in your project root
(`packages/astro/src/index.ts`). Outside Astro — a script, a notebook, another
tool — just read the file.

## Day-to-day

- **Debugging a record?** Run `grove check` and look at `records.json`. That
  is what Grove thinks the record is after defaults and normalization.
- **Confirming a sync?** `github.sync.syncedAt` inside the record entry.
- **Wondering why a record vanished from the site?** Check whether it is in
  `records.index.json`. If it is in `records.full.json` but not the index, its
  visibility excluded it.
- **Do not** fix a record by editing the JSON. Edit
  `data/records/<slug>.yml` and rebuild.

## Related

- [Outputs overview](/outputs/overview/) — every artifact Grove produces.
- [Cleanup report](/automation/cleanup/) — what `cleanup-report.json` contains.
