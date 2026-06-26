---
title: Create a project directory
description: Scaffold a new Grove space with the CLI in under 10 minutes. The fastest path to a working community knowledge site.
---

## Requirements

- **Node.js** 20 or newer
- **pnpm** 10.x — install via `corepack enable && corepack prepare pnpm@10.12.1 --activate`

## Create the project

```bash
pnpm create grove my-directory
cd my-directory
pnpm install
pnpm dev
```

Open `http://localhost:4321`. You now have a working directory with example projects, search, filters, and project detail pages.

## What gets generated

```
my-directory/
├── data/
│   ├── records/         # directory entries (one YAML per record)
│   ├── decisions.yml    # curator decisions
│   └── generated/       # build output (gitignored)
├── public/              # logo, OG image, llms.txt
├── src/
│   ├── pages/           # home, browse, [slug], submit, 404
│   ├── components/      # override any default Astro component
│   └── styles/global.css
├── .github/
│   ├── workflows/       # validate-data.yml, build.yml
│   └── ISSUE_TEMPLATE/  # record_submission.md, bug_report.md
├── grove.config.ts      # site config (blueprint, site, theme, integrations)
└── astro.config.mjs
```

Three files matter most:

- **`data/records/`** — your directory entries. One YAML file per record.
- **`grove.config.ts`** — site config. Name, blueprint, theme tokens, GitHub integration toggle.
- **`src/`** — pages and UI customization. Override components here.

## What the scaffolder asks

| Prompt | Recommended answer | Why |
|---|---|---|
| Pick a blueprint | `project-directory` | The only blueprint with a polished Astro template today |
| GitHub automation mode | `public` | Writes sync, cleanup, and submission workflows for community sites |
| Pick a framework | `astro` | V1 only supports Astro. Next.js and SvelteKit are coming soon. |
| Where will this space be deployed? | `github-pages` | Free, no signup. Other targets are valid. |

Or skip the prompts entirely:

```bash
pnpm create grove my-directory \
  --blueprint project-directory \
  --framework astro \
  --github public \
  --deploy github-pages \
  --yes
```

## Next steps

- **[Add your first project →](/getting-started/add-your-first-project/)** — write a YAML record and see it appear.
- **[Deploy your site →](/getting-started/deploy/)** — push to GitHub and ship it.