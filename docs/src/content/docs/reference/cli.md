---
title: CLI reference
description: Every Grove CLI command, every flag, every useful example.
---

The Grove CLI is the operational entry point for a space. It scaffolds
projects, imports records, validates the schema, runs the data pipeline,
and orchestrates the framework's build and dev commands. This page
documents every command in the V1 surface.

The CLI is shipped as `@grove-dev/cli`. The fastest way to run it is
`pnpm create grove` (which calls `grove new` under the hood), or you
can install it as a dev dependency in any space:

```bash
pnpm add -D @grove-dev/cli
```

When installed in a space, run commands from the project root:

```bash
grove --help
grove validate
grove build
```

:::note[Command surface]
The V1 command surface is small and stable:

```txt
grove new <name>      scaffold a new project (asks blueprint + framework)
grove import <src>    turn an awesome list into records/*.yml
grove validate        check records, taxonomy, health, decisions
grove generate        build data/generated/records.{full,index}.json
grove sitemap         write public/sitemap.xml
grove llms            write public/llms.txt and llms-full.txt
grove sync github     optional: enrich records with GitHub metadata
grove cleanup stale   flag records that need human review
grove workflows sync  sync Grove workflow templates into the project
grove build           run the framework's build command
grove dev             run the framework's dev server
```
:::

## `grove new`

Scaffold a new Grove project from a framework template.

```bash
grove new [name] [options]
```

**Arguments:**

- `[name]` — project directory name. If omitted and `--yes` is not set, the
  CLI prompts for a path. Pass `.` to scaffold into the current directory.

**Options:**

- `-b, --blueprint <name>` — one of `project-directory`, `resource-hub`,
  `ecosystem-map`. The CLI rejects unknown values.
- `-f, --framework <name>` — one of `astro`, `nextjs`, `svelte`. V1
  supports `astro`; the other two are roadmap-only.
- `-t, --template <name>` — template name. Defaults to `default`.
- `-d, --deploy <provider>` — one of `vercel`, `netlify`, `cloudflare`,
  `github-pages`, `none`. Determines which deploy workflow the scaffold
  writes.
- `-g, --github <mode>` — GitHub workflow mode: `none` (private, no
  token) or `public` (community, token-gated sync). Defaults to `none`.
- `--no-git` — skip `git init` after scaffolding.
- `--no-install` — skip `pnpm install` after scaffolding.
- `-y, --yes` — accept defaults for every prompt. Use in CI.

**Examples:**

```bash
# Interactive scaffold
grove new my-space

# Non-interactive, the typical "I just want a working site" flow
grove new my-space \
  --blueprint project-directory \
  --framework astro \
  --deploy github-pages \
  --yes

# Scaffold into the current directory
grove new . --yes

# Roadmap-only framework, no install
grove new svelte-space --framework svelte --no-install
```

After scaffolding, the CLI:

1. Copies the matching framework template into the target directory.
2. Rewrites `workspace:*` dependencies to the published version (only
   relevant inside the framework monorepo; external spaces pin to the
   published version on `pnpm install`).
3. Optionally runs `git init` and `pnpm install`.

## `grove import`

Import Markdown links into `data/records/*.yml` for the current
blueprint.

```bash
grove import <source>
```

**Arguments:**

- `<source>` — a GitHub awesome-list URL (`https://github.com/.../awesome-x`),
  a raw README URL (`https://raw.githubusercontent.com/.../README.md`),
  or a local `README.md` path.

**Behavior:**

The CLI parses the Markdown, extracts `name` and `url` pairs from
list items, slugifies the names, and writes one YAML record per link
into `data/records/`. The record's `kind` is set to match the space's
blueprint, and the `source` block is set to `{ type: 'import' }`.

**What it does not do:**

- It does not deduplicate against existing records. Run `grove validate`
  afterwards to find collisions.
- It does not enrich with GitHub metadata. Run `grove sync github` for
  that.
- It does not preserve descriptions that span multiple lines or that
  are formatted in non-standard ways. Curators refine the imported
  records after import.

**Examples:**

```bash
# Import from a public awesome list
grove import https://github.com/avelino/awesome-go

# Import from a raw README URL
grove import https://raw.githubusercontent.com/some-user/some-list/main/README.md

# Import from a local file
grove import ./awesome-list.md
```

## `grove validate`

Validate project data files against the configured blueprint.

```bash
grove validate [--strict]
```

**Options:**

- `--strict` — fail on warnings as well as errors. Without `--strict`,
  warnings are reported but the command exits 0.

**Behavior:**

The CLI loads `grove.config.ts`, then walks:

- Every YAML file under `data/records/`
- The taxonomy files under `data/taxonomy/`
- `data/health.yml`, `data/decisions.yml`, `data/overrides.yml`

It checks:

- Schema validity against the discriminated `Resource` union.
- `kind` matches the space's blueprint.
- `category` is in `taxonomy/categories.yml`.
- `topic` (on `resource` records) is in `taxonomy/topics.yml`.
- Decision `id`s reference real record slugs.
- Override `id`s reference real record slugs.

The command prints errors with `✖` and warnings with `⚠`, and exits
non-zero if any errors are present (or, with `--strict`, if any
warnings are present).

**Examples:**

```bash
# Standard validation
grove validate

# Treat warnings as errors
grove validate --strict
```

## `grove generate`

Build the data files the framework template consumes.

```bash
grove generate
```

**Behavior:**

Reads every record, applies `decisions.yml` and `overrides.yml`,
projects each record through `toIndexRecord()`, and writes:

- `data/generated/records.full.json` — every record, with the full
  shape (including the GitHub enrichment block, distribution channels,
  curation notes). Used by detail pages.
- `data/generated/records.index.json` — a slimmer projection. Used by
  list, search, and filter pages.
- `data/generated/alias.json` — a slug → record map for cross-references.

The command reports total vs. visible counts (a record with
`visibility: hide` or `remove` is in the full file but not the index
file).

**Examples:**

```bash
# Generate
grove generate

# Typical iteration loop
grove validate && grove generate
```

## `grove sitemap`

Generate `public/sitemap.xml` from the index file.

```bash
grove sitemap
```

**Behavior:**

Reads `data/generated/records.full.json`, filters by visibility
(defaults to `keep` and `highlight`), and writes a sitemap to
`public/sitemap.xml`. The sitemap includes the site root, the index
pages (one per category, topic, or tag), and a `<url>` entry for every
visible record.

The generated `lastmod` is the most recent of the record's `lastCommitAt`
(from GitHub metadata), `addedAt` (set when the record was first
imported), and the build's `generatedAt`.

**Examples:**

```bash
# Generate the sitemap
grove sitemap
```

## `grove llms`

Generate `public/llms.txt` and `public/llms-full.txt`.

```bash
grove llms
```

**Behavior:**

LLM-friendly indexes of the space:

- `llms.txt` — a compact, human-readable summary: site name, tagline,
  blueprint, count of visible records, and a one-line per record.
- `llms-full.txt` — the full record set, with description, category,
  tags, links, and GitHub stats. Useful for AI assistants that need
  structured context.

Both files are generated from the index projection — visibility
`hide` and `remove` are excluded.

**Examples:**

```bash
# Generate llms.txt
grove llms
```

## `grove sync`

Optional GitHub integration: enrich records with GitHub metadata.

```bash
grove sync <target> [--limit <n>] [--strict]
```

**Arguments:**

- `<target>` — one of `github` or `contributors`. V1 implements
  `github`; `contributors` is a placeholder that prints a "not yet
  implemented" message and exits 0.

**Options:**

- `--limit <n>` — limit the number of records to sync. Useful as a
  rate-limit guard. Without `--limit`, the CLI syncs every record.
- `--strict` — fail the run if any record could not be synced.

**Behavior:**

For every record with a `links.github` URL, the CLI fetches the
GitHub API metadata (stars, forks, language, license, latest release,
monthly commits) and writes the result into the record's `github:`
block. On API failure, the CLI falls back to an HTML scrape. On
both failures, the record is skipped (or, with `--strict`, the run
fails).

`grove sync github` does not touch `data/health.yml` directly. The
health derivation is run as part of `grove generate`, which reads the
just-updated `github:` blocks and writes `data/health.yml` as a
build artifact.

**Examples:**

```bash
# Sync every record
grove sync github

# Sync a small batch (rate-limit guard)
grove sync github --limit 25

# Fail the run on any sync failure
grove sync github --strict
```

## `grove cleanup`

List records that need human curation.

```bash
grove cleanup <target> [--report] [--strict]
```

**Arguments:**

- `<target>` — only `stale` is supported in V1. Unknown values produce
  an error.

**Options:**

- `--report` — produce a report (default behavior in V1, kept for
  forward compatibility).
- `--strict` — fail the run if any candidates need curation. Useful in
  CI: a PR that introduces a stale record breaks the build until a
  curator reviews it.

**Behavior:**

Reads `data/health.yml` and the in-memory record set, then lists every
record where `cleanupCandidate: true` — that is, every record with
`status: stale`, `archived`, `inactive`, or `unavailable`. The output
is a per-record line with slug, status, and (if available) star count.

The command writes a JSON report alongside the console output. The
report's path is printed; it is gitignored by default.

**Examples:**

```bash
# List cleanup candidates
grove cleanup stale

# Fail in CI if anything needs review
grove cleanup stale --strict
```

## `grove workflows`

Sync Grove workflow templates into the current project.

```bash
grove workflows sync [--force]
```

**Arguments:**

- `<action>` — only `sync` is supported in V1. Unknown actions
  produce an error.

**Options:**

- `--force` — overwrite existing workflow files. Without `--force`,
  the command skips files that already exist.

**Behavior:**

Reads the `integrations.github` field from `grove.config.ts` to decide
which workflows to write. The `none` mode writes a minimal set
(`validate-data.yml`, `build.yml`); the `public` mode adds
`sync-github-metadata.yml`, `sync-contributors.yml`,
`cleanup-stale-records.yml`, `update-records.yml`, and the issue / PR
templates.

Use this command after upgrading the CLI to pick up new workflow
templates. The command is idempotent — re-running it does not
overwrite your customizations, unless `--force` is passed.

**Examples:**

```bash
# Sync the latest workflow templates
grove workflows sync

# Force-overwrite (use after a CLI upgrade)
grove workflows sync --force
```

## `grove build`

Build the static site in the current project repo.

```bash
grove build
```

**Behavior:**

Detects the framework from `package.json` (currently `astro`,
`nextjs`, or `svelte`) and runs the framework's build command. The
V1 default is `astro build`. The CLI does not run the data pipeline
itself — call `grove validate` and `grove generate` first, or wrap
the full pipeline in your CI workflow.

**Examples:**

```bash
# Standard build
grove build
```

## `grove dev`

Start the framework dev server in the current project repo.

```bash
grove dev
```

**Behavior:**

Detects the framework and runs the dev server (`astro dev`, `next dev`,
`vite dev`, ...). The dev server picks up changes to record YAMLs on
reload, so the iteration loop is `edit record → save → reload tab`.

**Examples:**

```bash
# Start the dev server
grove dev
```

## Global options

- `-V, --version` — print the CLI version.
- `-h, --help` — print the command-specific help.

## Exit codes

- `0` — success (or warnings, unless `--strict` was passed).
- `1` — validation, sync, or cleanup failure.
- Non-zero on `grove new` if the scaffold target is not writable, or
  the blueprint / framework / deploy choice is unknown.

## Environment variables

- `GITHUB_TOKEN` — used by `grove sync github` for authenticated
  requests. Without it, the CLI falls back to anonymous requests
  (60.5 req/hr) and an HTML scrape on rate-limit. Set this in CI
  for a 5000 req/hr budget.
- `GROVE_NO_COLOR` — disable colored output. The CLI also respects
  `NO_COLOR` and non-TTY stdout.
