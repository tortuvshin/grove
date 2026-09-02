---
title: UI registry and consumer-owned source
description: How Grove ships UI through a registry that consumers install and own, and how grove update keeps it in sync without overwriting edits.
---

Every consumer of Grove installs the same canonical UI scaffold once at `grove init` time. After that, the files are theirs. Grove does not own runtime UI exports; the registry owns the upstream scaffold, and `grove update` reconciles upstream changes against consumer edits without overwriting them.

The registry is a real [shadcn registry](https://ui.shadcn.com/docs/registry) under the `@grove` namespace, served at `https://withgrove.dev/r/<item>.json`. It is split into feature-level items — `ui`, `shell`, `project-card`, `taxonomy`, `collections`, `home`, `browse`, `record`, `submit`, `about`, `contributors`, `not-found` — plus `default`, the whole site in one item. `grove init` installs `default`; the standard shadcn CLI can add or restore any single item afterwards.

This is the opposite of how a typical component library works. Grove does not ship `.astro` files inside `@grove-dev/astro` that consumers import by path. There is no `import ProjectCard from "@grove-dev/astro/components/ProjectCard.astro"` in v1. The component lives in your `src/components/grove/project-card.astro` because the registry installed it there when `grove init` ran, and from then on it's your file.

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
- **UI registry** is the canonical source for consumer-installed UI — a shadcn registry whose full-site item is `@grove/default`. It is built from `packages/registry` and served at `withgrove.dev/r/`; it is deliberately **not** an npm package. The shadcn CLI resolves `@grove/<item>` through the URL in your `components.json` and writes files into your `src/` — it never looks in `node_modules`, so there is nothing for you to install.
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
- Styles (`src/styles/system.css`, the design system the registry installs; add `src/styles/global.css` for overrides you want kept clear of upstream — the Grove integration auto-loads it and `grove update` never touches it)
- Branding, design tokens, presentation behavior, custom routes, custom themes

## How it works

### Install

```bash
grove init my-directory
```

This:

1. Writes `package.json`, `tsconfig.json`, `grove.config.ts`, `astro.config.mjs`, an empty `data/records/`, and a `components.json` that points the `@grove` namespace at the registry:

   ```json
   { "registries": { "@grove": "https://withgrove.dev/r/{name}.json" } }
   ```

2. Runs the shadcn CLI (`shadcn add`) against the copy of `@grove/default` bundled with the CLI — no registry request, so `init` works offline. This lands every component, layout, page, and stylesheet in `src/`, and shadcn installs the scaffold's own dependencies (astro, tailwindcss, and friends).
3. Adds `@grove-dev/core`, `@grove-dev/astro`, and `@grove-dev/cli`, pinned to the CLI version. There is no registry package to add — the UI is now source in your repository.
4. Writes `.grove/registry.lock.json` with the version installed and a sha256 per file.

**Commit the lockfile.** It is the install-time snapshot every later
`grove update` diffs against — a build input, like a package lock, not a
cache. Watch your `.gitignore`: a bare `.grove/` entry matches at every
depth and will swallow it, leaving `grove update` with nothing to
compare and no way to run. If that already happened, or the project
predates the lockfile, `grove update --adopt` writes one from the files
on disk without overwriting any of your edits.

### Customize

Edit any file in your `src/`. The registry no longer touches it.

### Add or restore a single item

Because `components.json` maps `@grove` to the hosted registry, the standard shadcn CLI works on any item — no React and no `shadcn init` required:

```bash
npx shadcn@latest view @grove/home                     # preview what an item ships
npx shadcn@latest add @grove/browse                    # install an item and its @grove/* dependencies
npx shadcn@latest add @grove/project-card --overwrite  # reset one item's files to upstream
```

`add` on files that already exist and differ only offers a yes/no overwrite; that's fine for a deliberate reset of one item, but for keeping a whole site current use `grove update`, which knows which files you've edited.

One requirement, if you are writing `components.json` by hand rather than letting `grove init` do it: keep `"tsx": true`. With `tsx: false` the shadcn CLI runs its TypeScript→JavaScript transformer over every file it installs, which cannot parse `.astro` — the install fails with a bare `Unexpected token (13:0)` and no indication of which file or why. Grove's UI is Astro, not React, but `tsx: true` is what tells shadcn to write files through untouched.

### Update

```bash
grove update
```

When a new `@grove/default` ships (a component refactor, a new feature, a bugfix), `grove update` fetches it from the registry URL in `components.json` (or `--from <path-or-url>`, falling back to the copy bundled with the CLI) and compares three states per file:

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
| ✗ conflict | Both sides moved | preserve, warn (`--force` takes upstream) |
| − removed | Lock has it, registry no longer ships it | report, never delete |

The locally-modified rule is load-bearing. If you hand-tuned `project-card.astro`, `grove update` will tell you there's a new upstream version of that file and refuse to overwrite yours. You merge on your own schedule.

`--check` prints the plan without writing, `--diff` prints a unified diff for every file upstream moved, `--json` emits a machine-readable summary, and `--force` takes the upstream side of a conflict. `--force` never touches a `locally modified` file: upstream did not change it, so there is nothing to merge and overwriting would only destroy your work.

**The lock records what you are reconciled to, not what upstream ships.** A file `grove update` refused to write keeps its previous lock entry, and `scaffoldVersion` only advances once no conflict is left unresolved. That is what makes the conflict signal survive: run `grove update --check` in CI and it keeps exiting `2` until someone actually merges, rather than reporting the conflict once and then going quiet.

## Why this matters

- **No silent regressions from `pnpm update`.** Engine package upgrades (`@grove-dev/core`, `@grove-dev/astro`) cannot change your UI. UI upgrades come through `grove update`, which respects your edits.
- **Consumers can fork freely.** If you need a custom card design, edit the file in your repo. The registry never touches it again — and if you change your mind, `npx shadcn@latest add @grove/project-card --overwrite` brings the upstream version back.
- **Standard tooling.** The registry speaks the shadcn schema, so `shadcn add` and `shadcn view` work on it unchanged. `grove update` adds the part shadcn doesn't have: a three-way diff that respects your edits.
- **Engine and UI release independently.** A `@grove-dev/core` patch doesn't ship new UI. A `@grove/default` UI release doesn't require a `@grove-dev/astro` version bump.
- **The build is portable.** Your `src/` is plain Astro. There's no `@grove-dev/astro/components/X.astro` import path. You can `pnpm remove @grove-dev/astro` and the site still builds — you'd lose Grove's data pipeline, but the UI source stays yours.

## See also

- [Architecture](/project/architecture/) — the four-layer model.
- [Files are canonical](/concepts/files-canonical/) — the broader file-first principle this builds on.
- [Scaffold a space](/getting-started/scaffold/) — what `grove init` produces today.
- [Components](/customize/components/) — every registry item and what it ships.
