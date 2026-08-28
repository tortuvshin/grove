---
title: UI registry and consumer-owned source
description: How Grove ships UI through a registry that consumers install and own, and how grove update keeps it in sync without overwriting edits.
---

Every consumer of Grove installs the same canonical UI scaffold once at `grove init` time. After that, the files are theirs. Grove does not own runtime UI exports; the registry owns the upstream scaffold, and `grove update` reconciles upstream changes against consumer edits without overwriting them.

This is the opposite of how a typical component library works. Grove does not ship `.astro` files inside `@grove-dev/astro` that consumers import by path. There is no `import ProjectCard from "@grove-dev/astro/components/ProjectCard.astro"` in v1. The component lives in your `src/components/grove/project-card.astro` because you copied it there when `grove init` ran, and from then on it's your file.

## Mental model

```text
                      GROVE
                        │
            ┌───────────┴───────────┐
            │                       │
       Engine packages         UI registry
            │                       │
     @grove-dev/core         @grove/default
     @grove-dev/astro        (the scaffold)
            │                       │
            └──────────┬────────────┘
                       ▼
                Consumer project
                       │
              owns all UI source
```

- **Engine packages** (`@grove-dev/core`, `@grove-dev/astro`, `@grove-dev/cli`) are imported at runtime. They contain domain logic, server-side view-model builders, and the Astro integration.
- **UI registry** (`@grove-dev/registry`) is the canonical source for consumer-installed UI. The single scaffold shipped in v1 is `@grove/default`.
- **Consumer project** owns every `.astro` file under its `src/`. Business logic is imported; UI source is installed.

## What Grove owns

- Domain contracts (`Resource`, `Project`, `Collection` types)
- Business rules (taxonomy, ranking, scoring, search, validation)
- Data generation (records, sitemap, llms.txt, OG images, JSON datasets)
- SEO helpers, view-model builders, Astro integration
- Registry upstream (the scaffold that consumers install)
- Upgrade metadata (`.grove/registry.lock.json` records what was installed and how its hashes have drifted)

## What consumers own

- Pages (`src/pages/**`)
- Layouts (`src/layouts/**`)
- Components (`src/components/ui/**`, `src/components/grove/**`, `src/components/site/**`)
- Styles (`src/styles/global.css` — import the registry's design tokens, override what you need)
- Branding, design tokens, presentation behavior, custom routes, custom themes

## How it works

### Install

```bash
grove init my-directory
```

This:

1. Detects Astro and writes `grove.config.ts`.
2. Installs `@grove-dev/core`, `@grove-dev/astro`, and `@grove-dev/cli` as dependencies.
3. Installs `@grove/default` into `src/` — every component, layout, page, and stylesheet the scaffold ships.
4. Writes `.grove/registry.lock.json` with the version installed and a sha256 per file.

### Customize

Edit any file in your `src/`. The registry no longer touches it.

### Update

```bash
grove update
```

When a new `@grove/default` ships (a component refactor, a new feature, a bugfix), `grove update` compares three states per file:

- **Installed** (what's on your disk)
- **Lock** (what was installed last time)
- **Registry** (the new upstream)

It classifies every file as one of:

| Symbol | Meaning | Action |
| --- | --- | --- |
| ✓ unchanged | Lock and registry agree with installed | skip |
| ↑ upstream changed | Lock and registry differ; installed matches lock | apply |
| + new | Registry has it, you don't | install |
| ! locally modified | Installed differs from lock | **preserve, never overwrite** |
| ✗ conflict | Both sides moved | preserve, warn |

The locally-modified rule is load-bearing. If you hand-tuned `ProjectCard.astro`, `grove update` will tell you there's a new upstream version of that file and refuse to overwrite yours. You merge on your own schedule.

## Why this matters

- **No silent regressions from `pnpm update`.** Engine package upgrades (`@grove-dev/core`, `@grove-dev/astro`) cannot change your UI. UI upgrades come through `grove update`, which respects your edits.
- **Consumers can fork freely.** If you need a custom card design, edit the file in your repo. The registry never touches it again.
- **Engine and UI release independently.** A `@grove-dev/core` patch doesn't ship new UI. A `@grove/default` UI release doesn't require a `@grove-dev/astro` version bump.
- **The build is portable.** Your `src/` is plain Astro. There's no `@grove-dev/astro/components/X.astro` import path. You can `pnpm remove @grove-dev/astro` and the site still builds — you'd lose Grove's data pipeline, but the UI source stays yours.

## See also

- [Architecture](/project/architecture/) — the four-layer model.
- [Files are canonical](/concepts/files-canonical/) — the broader file-first principle this builds on.
- [Scaffold a space](/getting-started/scaffold/) — what `grove init` produces today.
