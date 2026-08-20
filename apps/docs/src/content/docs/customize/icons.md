---
title: Icons
description: The packaged icon set and grove icons sync.
---

`@grove-dev/astro` ships an icon set under `public/icons/`. The Astro integration runs the same `sync` automatically on every build, so most sites never need to interact with it directly.

## What `sync` does

On each build:

1. The integration reads `packages/astro/assets/icons/` — the packaged set shipped inside `@grove-dev/astro` (`packages/astro/src/lib/packaged-icons.ts`).
2. For each icon in the source, it copies to `public/icons/` if the destination is missing or its content still matches the last hash Grove wrote there.
3. It writes `public/icons/.grove-icons.json` — a sha256 manifest of every icon Grove owns.
4. Icons the consumer has hand-edited (content no longer matches the recorded hash) are **preserved** — Grove reports them as kept, not overwritten.

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
| `public/icons/stacks/<id>.svg` | One SVG per stack (language/framework) taxonomy id. Editable per file. |
| `public/icons/platforms/<id>.svg` | One SVG per platform taxonomy id. Editable per file. |
| `public/icons/.grove-icons.json` | sha256 manifest of the synced set (`packages/core/src/sync-icons.ts`). Don't edit — this is what lets sync tell "unmodified" apart from "you edited this". |

## How records resolve to an icon

`<Icon name="..." category="stack" />` resolves `name` to `/icons/{stacks|platforms|brands}/{name}.svg` (lowercased, dash-cased), with a small built-in alias table for names that share artwork — `ios`/`macos`/`swiftui`/`objective-c` all render `stacks/apple.svg`, `kmp` renders `stacks/kotlin.svg` (`packages/astro/src/lib/icon-registry.ts`). A name the alias table and packaged set don't recognize still resolves to that path — it just 404s and falls back to an initials chip, which is how a consumer's own icon under the same folder works without touching the registry. See [Images and assets](/customize/assets/) for the full mono/color rendering model.

## See also

- [Reference: programmatic API](/reference/api-core/) — `syncIconAssets` and `IconSyncOptions`.
- [Images and assets](/customize/assets/) — mono vs. color rendering, adding your own icon, the vendored source.
