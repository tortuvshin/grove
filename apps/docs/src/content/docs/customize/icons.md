---
title: Icons
description: The packaged icon set and grove icons sync.
---

# Icons

`@grove-dev/astro` ships an icon set under `public/icons/`. The Astro integration runs the same `sync` automatically on every build, so most sites never need to interact with it directly.

## What `sync` does

On each build:

1. The integration reads `packages/astro/.../icons/**` (the packaged set shipped with the package).
2. For each icon in the source, it copies to `public/icons/` if the destination is missing or has not been edited.
3. It writes `public/icons/.grove-icons.json` — a manifest of every icon and its hash.
4. Icons the consumer has hand-edited are **preserved** (per-file ownership).

## When to use the CLI command

```bash
pnpm exec grove icons sync             # default: match packaged set, preserve edits
pnpm exec grove icons sync --force     # overwrite everything; prune icons not in packaged set
pnpm exec grove icons sync --check     # CI gate: exit 1 when drift is detected
```

The command exists for two cases the automatic sync deliberately avoids:

- **Restoring a file you hand-edited** — `--force` overwrites; the next build will see the packaged version again.
- **Failing CI when drift is real** — `--check` reports stale / extra / modified icons and exits non-zero, surfacing the issue to PR review rather than letting it pass.

Drift can happen if you upgrade `@grove-dev/astro` to a version that ships new icons, or if you delete an icon from the packaged set.

## Output

| Path | Description |
|---|---|
| `public/icons/<name>.svg` | One SVG per icon. Editable per file. |
| `public/icons/.grove-icons.json` | Manifest of the synced set. Don't edit. |

## Pinning icons to records

Records reference icons through their taxonomy entries. The framework's components render the icon SVG by name; the manifest path is implicit. See [Icon kinds](https://github.com/tortuvshin/grove) for the registry.

## See also

- [Reference: programmatic API](/reference/api-core/) — `syncIconAssets` and `IconSyncOptions`.
- [Customize: theme](/customize/theme/) — token-based customization of the icon-button family.
- [Images and assets](/customize/assets/) — broader image asset guidance.
