---
title: 1. Bootstrap a space
description: From zero to a running Grove site — scaffold the project, understand what got created, and preview it in the browser.
---

This tutorial walks you through creating a brand-new Grove space from scratch.
By the end you will have:

- A local repository with the Astro template scaffolded.
- A `grove.config.ts` that pins the `project-directory` blueprint.
- A handful of example records in `data/` so the site has something to render.
- A running dev server at `http://localhost:4321`.

The whole thing takes about ten minutes. You only need Node 20+ and pnpm 9+.

## Prerequisites

```bash
node --version    # v20.x or newer
pnpm --version    # 9.x or newer
```

If you don't have pnpm, install it with Corepack:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

## Step 1 — Scaffold with `pnpm create grove`

From any directory — *not* inside an existing repo — run:

```bash
pnpm create grove my-space
```

The CLI will walk you through four prompts:

| Prompt                | What it means                                                                                | This tutorial picks |
| --------------------- | -------------------------------------------------------------------------------------------- | ------------------- |
| **Blueprint**         | The shape of the space: `project-directory`, `resource-hub`, or `ecosystem-map`.             | `project-directory` |
| **Framework**         | Which UI framework to scaffold (V1 only ships Astro; Next.js and SvelteKit are skeletons).   | `astro`             |
| **Deploy target**     | Where you intend to host the built site. The CLI writes a workflow for the chosen target.   | `vercel`            |
| **GitHub integration** | Whether the CLI should write `grove sync github` into the workflows. You can flip this later. | `none`              |

The CLI then runs `pnpm install` and `git init` for you. When it finishes you
have a working directory called `my-space`.

## Step 2 — See what got created

```bash
cd my-space
ls -la
```

You will see something like this:

```text
my-space/
├── .github/
│   └── workflows/             # CI workflows, populated by `grove workflows sync`
├── data/                      # the heart of the space — records live here
│   ├── records/               # one file per record
│   │   └── example.md
│   ├── taxonomy.yml           # categories, topics, tags
│   ├── health.yml             # signal derivation rules
│   └── decisions.yml          # visibility / featured flags
├── src/                       # Astro site (UI + routes)
│   ├── content.config.ts      # content collections (records, taxonomy, …)
│   ├── pages/                 # file-based routes
│   ├── components/            # reusable UI
│   └── styles/
├── public/                    # static assets served as-is
├── astro.config.mjs           # Astro/Starlight config
├── grove.config.ts            # Grove config — the one file you will edit most
├── package.json
├── pnpm-lock.yaml
└── tsconfig.json
```

The most important files for now are:

- **`grove.config.ts`** — the one place you set blueprint, site metadata, nav,
  facets, theme, and integrations.
- **`data/records/example.md`** — the seed record the CLI wrote. We'll replace
  it with real ones in [Tutorial 2](/tutorials/02-author-records/).
- **`astro.config.mjs`** — Astro/Starlight wiring. You rarely touch this.

## Step 3 — Open `grove.config.ts`

```ts
// grove.config.ts
import { defineConfig } from '@grove-dev/core/config';

export default defineConfig({
    blueprint: 'project-directory',
    site: {
        title: 'My Space',
        description: 'A community-curated directory of projects.',
        url: 'https://my-space.example.com',
    },
    paths: {
        data: 'data',
        content: 'src/content',
    },
    nav: [
        { label: 'Home', href: '/' },
        { label: 'Projects', href: '/projects' },
    ],
});
```

The CLI generated a working stub. The three knobs you will touch the most:

- **`blueprint`** — fixed at scaffold time. Changing it later requires a
  migration of every record.
- **`site`** — title, description, and canonical URL. Used by `<head>`, the
  sitemap, and `llms.txt`.
- **`nav`** — the top navigation. Each entry is `{ label, href }` and is
  rendered by the default layout.

Everything else (`facets`, `integrations.github`, `theme`, `components`) is
optional and defaults to sensible values. You will meet them in
[Tutorial 3](/tutorials/03-customize/).

## Step 4 — Run the dev server

```bash
pnpm dev
```

The Astro dev server starts on `http://localhost:4321`. Open it in a
browser. You should see:

- A homepage with the site title and description from `grove.config.ts`.
- A "Projects" page (`/projects`) listing the seed record from
  `data/records/example.md`.
- A detail page (`/projects/example`) for that record.

The CLI command `grove dev` is a thin wrapper around `astro dev` — same
flags, same behaviour. If you want to pass extra flags to Astro, use
`pnpm astro dev …` directly.

:::tip[Hot reload]
Both the Astro site and the Grove data layer watch the filesystem. Editing
any `.md` or `.yml` file under `data/` reloads the browser automatically.
:::

## Step 5 — Validate the seed

Before adding your own records, run validation to make sure the seed is
healthy:

```bash
pnpm grove validate
```

You should see something like:

```text
✓ 1 record read
✓ taxonomy.yml: 2 categories, 4 topics, 0 tags
✓ health.yml: 3 signals loaded
✓ decisions.yml: 0 decisions
✓ 0 errors, 0 warnings
```

If anything is red, the message points to the file and line. Common issues at
this stage are mismatched categories (a record uses a category that isn't
declared in `taxonomy.yml`) or missing required fields.

## Recap

You now have:

- A repo with the `project-directory` blueprint pinned.
- A `grove.config.ts` to edit.
- A dev server running at `http://localhost:4321`.
- Validation working.

**Next: [Tutorial 2 — Author records](/tutorials/02-author-records/)** —
we'll replace the seed record with five realistic ones and watch the site
rebuild itself.
