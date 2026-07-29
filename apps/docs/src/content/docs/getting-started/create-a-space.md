---
title: Create a project directory
description: Scaffold a new Grove space with the CLI in under 10 minutes. The fastest path to a working community knowledge site.
---

## Requirements

- **Node.js** `>=22.12.0` (every Grove package and `apps/example`
  declare this in `engines`).
- **pnpm** `10.12.1` — install via
  `corepack enable && corepack prepare pnpm@10.12.1 --activate`.

## Create the project

```bash
pnpm dlx @grove-dev/cli@latest init my-directory
cd my-directory
pnpm install
pnpm dev
```

Open `http://localhost:4321`. You now have a working directory with
example projects, search, filters, and project detail pages.

## What gets generated

```
my-directory/
├── data/
│   ├── records/         # directory entries (one YAML per record)
│   ├── taxonomy/        # categories / stacks / platforms
│   ├── collections/     # curated collections
│   ├── decisions.yml    # curator visibility overrides
│   ├── overrides.yml    # manual record patches
│   └── generated/       # build output (gitignored; rebuilt by grove check)
├── public/              # robots.txt, og-image.svg, llms.txt, sitemap.xml
├── src/
│   ├── pages/           # home, browse, [slug], submit, 404
│   ├── components/      # override any default Astro component
│   └── styles/global.css
├── .github/
│   ├── workflows/       # ci, cleanup, deploy, sync-github, sync-contributors
│   └── ISSUE_TEMPLATE/
├── grove.config.ts      # site config (blueprint, site, theme, integrations)
└── astro.config.mjs
```

Three files matter most:

- **`data/records/`** — your directory entries. One YAML file per record.
- **`grove.config.ts`** — site config. Name, blueprint, theme tokens,
  GitHub integration toggle, audit manifest.
- **`src/pages/`** — pages and UI customization. Override components
  here.

## `grove init` options

The CLI takes a single positional `[directory]` argument and two flags:

```bash
pnpm dlx @grove-dev/cli@latest init [directory] [--no-install] [--no-git]
```

| Flag | Effect |
| --- | --- |
| `--no-install` | Skip `pnpm install` after scaffolding. |
| `--no-git` | Skip `git init` after scaffolding. |

Omit `[directory]` to scaffold into the current directory (which must
be empty). The scaffolder does not ask prompts in v0.4.0 — the
blueprint and integrations are chosen by editing `grove.config.ts`
after scaffold.

## Next steps

- **[Add your first project →](/getting-started/add-your-first-project/)**
  — write a YAML record and see it appear.
- **[Deploy your site →](/getting-started/deploy/)** — push to GitHub
  and ship it.