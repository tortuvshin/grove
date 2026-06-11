---
title: Create a space
description: Scaffold a new Grove space with the CLI in under 10 minutes. The fastest path to a working community knowledge site.
---

This page walks you through creating a brand-new Grove space from
scratch. By the end you will have:

- a local repository with the Astro template scaffolded
- a `grove.config.ts` that pins the `project-directory` blueprint
- a `data/records/` directory ready for your first record
- a running dev server at `http://localhost:4321`

The whole thing takes about ten minutes. You only need **Node 20+**
and **pnpm 9+**.

## When to use this

Use this guide when you are starting a **new Grove space** — a fresh
repo where the data, branding, and decisions are yours. If you want
to **contribute to an existing space**, see the existing space's
README instead.

## Before you start

```bash
node --version    # v20.x or newer
pnpm --version    # 9.x or newer
```

If you don't have pnpm, install it with Corepack:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

If you don't have a GitHub account or a `git` configured, the
scaffolder will skip the `git init` step. You can run it later.

## Step 1 — Scaffold with `grove new`

The Grove CLI ships as `@grove-dev/cli`. Run it with `pnpm dlx` (no
install step required):

```bash
pnpm dlx @grove-dev/cli@latest new my-space
cd my-space
```

The CLI will ask you four questions:

| Prompt | Recommended answer for V1 | Why |
|---|---|---|
| Pick a blueprint | `project-directory` | Only this blueprint has a working Astro template in V1 |
| GitHub automation mode | `none` (private/local) or `public` (community site) | Toggles which workflow files get generated |
| Pick a framework | `astro` | V1 only supports Astro. Next.js and SvelteKit are roadmap-only |
| Where will this space be deployed? | `github-pages` (default) | Free, no signup; other targets are also valid |

You can also pass these as flags and skip the prompts:

```bash
pnpm dlx @grove-dev/cli@latest new my-space \
  --blueprint project-directory \
  --framework astro \
  --github none \
  --deploy github-pages \
  --yes
```

After the prompts, the CLI:

1. copies the Astro template into `my-space/`
2. rewrites `workspace:*` dependencies to the published version
3. creates `data/`, `content/`, `public/`, and `.github/` directories
4. writes `grove.config.ts`, `README.md`, `.gitignore`, and `LICENSE`
5. writes GitHub workflow files (validate + build, plus public-mode
   sync/cleanup/update workflows if you picked `public`)
6. initializes a git repo on `main`
7. runs `pnpm install`

If `pnpm install` fails (network, registry, etc.), the CLI tells you
to run it manually inside `my-space/`. The scaffold itself is
complete; the install is a separate step you can retry.

## Step 2 — Check what was generated

```bash
ls -la
```

You should see roughly:

```
my-space/
├── astro.config.mjs           # Astro config, uses @grove-dev/astro integration
├── data/
│   ├── decisions.yml          # empty: decisions: []
│   ├── generated/             # auto-generated JSON, gitignored
│   ├── records/               # empty: .gitkeep, your records go here
│   └── taxonomy/              # empty, for future taxonomy work
├── content/
│   ├── pages/                 # Markdown pages (about.md, methodology.md, …)
│   └── records/               # optional Markdown body per record
├── public/                    # logo, OG image, llms.txt placeholder
├── .github/
│   ├── workflows/             # validate-data.yml, build.yml
│   └── ISSUE_TEMPLATE/        # record_submission.md, bug_report.md, …
├── grove.config.ts            # your site config
├── package.json
└── README.md
```

The exact file count varies by GitHub mode (`public` mode adds
`sync-github-metadata.yml`, `cleanup-stale-records.yml`,
`update-records.yml`, `report-broken-record.md`, and a pull request
template).

## Step 3 — Start the dev server

```bash
pnpm dev
```

This runs `grove generate` (to produce `data/generated/records.{full,index}.json`)
and then `astro dev`. The dev server is at `http://localhost:4321`.

The default template ships with **no records** — only the directory
shell. You will see the hero, the empty-state cards, and the site
chrome, but no list of projects yet. That's expected. The next
page shows how to add your first record.

## Step 4 — Run the validation pipeline

In a separate terminal, while the dev server is running:

```bash
grove validate         # check schemas, slugs, taxonomy
grove generate         # rebuild data/generated/records.{full,index}.json
grove build            # run the framework's build
```

All three should exit 0. If `grove validate` reports errors, they
point to a specific file and field — fix the YAML and re-run.

## Common mistakes

**`pnpm` not found.** Install Node 20+ first, then enable Corepack as
shown above.

**`astro` not found after install.** Run `pnpm install` inside the
scaffolded directory. The CLI only runs install if it can find
`pnpm`; missing or broken installs are surfaced as a warning, not a
hard error.

**`grove` not found.** The CLI is wired up as `pnpm exec grove` in
the template's `package.json` scripts. If you want a global install,
run `pnpm add -g @grove-dev/cli` and use `grove` directly.

**Picked the wrong blueprint.** You can change `blueprint` in
`grove.config.ts` later, but **records in `data/records/` will need
their `kind:` field updated** to match the new blueprint. There is
no automatic migration between blueprints.

## What Grove generates

After `grove new`, the space contains:

- `grove.config.ts` — your site config. Edit this to change name,
  tagline, blueprint, integrations, theme.
- `data/records/` — empty, `.gitkeep` only. Your records go here.
- `data/decisions.yml` — empty `decisions: []`. Curator judgments
  go here.
- `.github/workflows/validate-data.yml` — runs `grove validate` on
  every PR. Catches schema errors before they merge.
- `.github/workflows/build.yml` — runs `pnpm build` on every PR.
- `.github/ISSUE_TEMPLATE/record_submission.md` — the "Submit a
  record" issue form, tailored to your blueprint.

## Next steps

- **[Add your first record](/getting-started/add-your-first-record/)** —
  write a YAML record and see it appear in the list.
- **[CLI reference](/reference/cli/)** — every command, every option.
- **[grove.config.ts reference](/reference/config/)** — every config
  field with defaults and examples.
