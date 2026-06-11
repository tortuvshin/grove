---
title: CLI
description: Every grove command, every option, every output file. The V1 command surface.
---

The Grove CLI is the `@grove-dev/cli` package. You can run it with
`pnpm dlx` (no install required) or install it as a project
dependency.

```bash
pnpm dlx @grove-dev/cli@latest <command> [options]
```

This page documents every command, every option, and the files each
command reads and writes. Commands are organized by lifecycle: set
up a space, work with records, ship the site.

## `grove new`

Scaffold a new Grove space from a framework template.

**Syntax:** `grove new [<name>] [options]`

**Arguments:**

| Argument | Description | Default |
|---|---|---|
| `<name>` | Project directory name. Omit to scaffold in the current directory. | `.` |

**Options:**

| Option | Description | Default |
|---|---|---|
| `-b, --blueprint <name>` | `project-directory` \| `resource-hub` \| `ecosystem-map` | prompts |
| `-f, --framework <name>` | `astro` \| `nextjs` \| `svelte` (V1 supports `astro` only) | prompts |
| `-t, --template <name>` | Template name within the framework | `default` |
| `-d, --deploy <provider>` | `vercel` \| `netlify` \| `cloudflare` \| `github-pages` \| `none` | prompts |
| `-g, --github <mode>` | `none` (private/local) \| `public` (community site with sync workflows) | prompts |
| `--no-git` | Skip `git init` after scaffolding | git init runs |
| `--no-install` | Skip `pnpm install` after scaffolding | install runs |
| `-y, --yes` | Accept defaults for every prompt (CI / scripted use) | prompts |

**Reads:** nothing (creates a new directory).

**Writes:**

- `<name>/grove.config.ts`
- `<name>/README.md`
- `<name>/.gitignore`
- `<name>/LICENSE`
- `<name>/data/decisions.yml` (empty `decisions: []`)
- `<name>/content/methodology.md`
- `<name>/.github/workflows/validate-data.yml`
- `<name>/.github/workflows/build.yml`
- `<name>/.github/ISSUE_TEMPLATE/{record_submission,bug_report,feature_request}.md`
- In `--github public` mode, additionally:
  `<name>/.github/workflows/{sync-github-metadata,sync-contributors,cleanup-stale-records,update-records}.yml`,
  `<name>/.github/ISSUE_TEMPLATE/report-broken-record.md`,
  `<name>/.github/pull_request_template.md`

**Example:**

```bash
pnpm dlx @grove-dev/cli@latest new my-space \
  --blueprint project-directory \
  --framework astro \
  --github public \
  --deploy github-pages \
  --yes
```

**Common errors:**

- `Unknown blueprint: <x>` — must be one of the three V1 blueprints.
- `Unknown framework: <x>` — V1 supports `astro` only; `nextjs` and
  `svelte` are accepted by the flag but their templates are bare
  `package.json` and `grove build` will refuse to run them.
- `Install failed` — the scaffold itself completed; run `pnpm install`
  inside `<name>/` to retry.

## `grove import`

Turn an awesome-list README (or any Markdown file full of links)
into `data/records/*.yml`.

**Syntax:** `grove import <source>`

**Arguments:**

| Argument | Description |
|---|---|
| `<source>` | GitHub awesome-list URL (e.g. `https://github.com/avelino/awesome-go`), raw README URL, or path to a local `README.md` |

**Options:** none.

**Reads:**

- `<source>` (URL or file)
- `grove.config.ts` (for the configured blueprint and paths)

**Writes:**

- One `<slug>.yml` per detected record in `data/records/` (or
  whatever `paths.recordsDir` is set to).
- Records are written with `source: { type: "import" }` so you can
  filter imported vs. hand-authored records later.

**Example:**

```bash
grove import https://github.com/avelino/awesome-go
grove import ./inbox/README.md
```

**Behavior:**

- For `project-directory` spaces, each record gets `name`,
  `description`, `category`, `tags`, and `links` from the
  source. `stack`, `stacks`, `platforms`, `projectType` are left
  empty for curators to fill in.
- For `resource-hub` spaces, each record gets `title`, `type:
  "link"`, `topic` (set from the category), and `links`.
- For `ecosystem-map` spaces, each record gets `name`, `type:
  "other"`, and `links`.

**Common errors:**

- `Could not load config` — run from a directory with a
  `grove.config.ts`.
- Network errors fetching the URL — `import` does not retry; re-run
  once the network is up.

## `grove validate`

Check records, taxonomy, health, and decisions against the
configured blueprint's schema.

**Syntax:** `grove validate [--strict]`

**Options:**

| Option | Description |
|---|---|
| `--strict` | Fail the run (exit 1) on warnings as well as errors |

**Reads:**

- `grove.config.ts`
- `data/records/*.yml` (every record file)
- `data/decisions.yml`
- `data/health.yml` (legacy compatibility shape)
- `data/overrides.yml`

**Writes:** nothing. Exits 0 on success, 1 on errors.

**Output:**

```
✖ <code>: <file>: <message>
⚠ <code>: <file>: <message>
Validation passed.
Validation passed with N warning(s).
Validation failed with N error(s) and M warning(s).
```

**Example:**

```bash
grove validate
grove validate --strict
```

**Use this in CI.** The `validate-data.yml` workflow the CLI
generates runs `grove validate` on every PR.

## `grove generate`

Build the data files the renderer reads.

**Syntax:** `grove generate`

**Reads:**

- `grove.config.ts`
- `data/records/*.yml`
- `data/decisions.yml`
- `data/health.yml` (legacy)

**Writes:**

- `data/generated/records.full.json` — every record, every field.
- `data/generated/records.index.json` — slim projection with only
  the fields the list/detail pages need.
- `data/generated/records.json` — alias for `records.full.json`,
  for tools that expect a stable filename.
- `data/generated/site-config.json` — site name, tagline, nav, theme.

**Output:**

```
[generate] 42 total, 38 visible
  full:  data/generated/records.full.json
  index: data/generated/records.index.json
  alias: data/generated/records.json
```

`visible` is the count of records whose effective visibility is
`keep` or `highlight` after `decisions.yml` overrides are applied.

## `grove sitemap`

Write `public/sitemap.xml` from the generated records.

**Syntax:** `grove sitemap`

**Reads:**

- `grove.config.ts`
- `data/generated/records.full.json`

**Writes:**

- `public/sitemap.xml`

**Output:** `[sitemap] wrote 38 URLs → public/sitemap.xml`

## `grove llms`

Write the LLM-friendly index files (`llms.txt` and
`llms-full.txt`).

**Syntax:** `grove llms`

**Reads:**

- `grove.config.ts`
- `data/generated/records.full.json`

**Writes:**

- `public/llms.txt` — one-line-per-record index, suitable for
  LLM ingestion.
- `public/llms-full.txt` — full record bodies concatenated.

**Output:** `[llms] 38 indexed → public/llms.txt + public/llms-full.txt`

## `grove sync github`

Enrich records with live GitHub metadata (stars, forks, last
commit, license, language, topics).

**Syntax:** `grove sync github [--limit <n>] [--strict]`

**Options:**

| Option | Description |
|---|---|
| `--limit <n>` | Sync only the first `n` records (alphabetical by filename). Useful as a rate-limit guard. |
| `--strict` | Fail the run (exit 1) if any record could not be synced (API + HTML fallback both failed) |

**Reads:**

- `data/records/*.yml` (one at a time)

**Writes:**

- Each successfully synced record is rewritten with a
  `github.repository` block (API success) or a partial
  `github.html` block (HTML fallback), plus a `github.sync` block
  with `syncedAt` and `source: "api" | "html"`.
- Records with no `repoUrl` or unparseable URLs are skipped
  (printed to stdout).

**Output:**

```
[sync github] owner/repo ... updated
[sync github] owner/repo ... html-fallback
[sync github] owner/repo ... skipped (api+html error)
[sync github] 35 updated (5 html-only), 2 failed
```

**Behavior:**

- `repoUrl` is the canonical field. If `repoUrl` and `links.github`
  disagree, `repoUrl` wins and a warning is printed.
- API hits `https://api.github.com/repos/<owner>/<repo>`. On rate
  limit or transient failure, falls back to scraping the repo page
  HTML for license, language, topics, and homepage.
- Records with `repoUrl` pointing at a non-GitHub host are
  unparseable and skipped.

## `grove sync contributors`

**Status: stub in V1.**

**Syntax:** `grove sync contributors`

**Behavior:** prints `[sync contributors] contributor sync is not yet
implemented in V1.` and exits 0. The full contributor-sync
workflow is generated by `grove new --github public` but the
implementation is a V1.1 feature.

## `grove cleanup stale`

List records that need human curation.

**Syntax:** `grove cleanup stale [--report] [--strict]`

**Options:**

| Option | Description |
|---|---|
| `--report` | Produce a report (default behavior in V1) |
| `--strict` | Fail the run (exit 1) if any candidates need curation |

**Reads:**

- `data/records/*.yml`
- `data/generated/records.full.json` (if present)

**Writes:**

- `data/generated/cleanup-report.json` — machine-readable list of
  candidates.

**Output:**

```
[cleanup stale] 5 candidate(s) → data/generated/cleanup-report.json
  - old-tool (inactive, 12★)
  - abandoned-app (archived, 304★)
  - ...
```

**Behavior:** `cleanup-stale-records.yml` workflow runs this on a
weekly cron and opens a PR with the report. The CLI does not
delete or hide records — that is a curator's call, made via
`decisions.yml`.

## `grove workflows sync`

Re-emit the GitHub workflow files. Useful when you upgrade the CLI
and want the new workflow files, or when you change
`integrations.github` mode.

**Syntax:** `grove workflows sync [--force]`

**Options:**

| Option | Description |
|---|---|
| `--force` | Overwrite existing workflow files |

**Reads:**

- `grove.config.ts` (for the GitHub integration mode)

**Writes:**

- `.github/workflows/validate-data.yml`
- `.github/workflows/build.yml`
- In `public` mode, also:
  `.github/workflows/{sync-github-metadata,sync-contributors,cleanup-stale-records,update-records}.yml`,
  `.github/ISSUE_TEMPLATE/report-broken-record.md`,
  `.github/pull_request_template.md`.

By default, existing files are **not** overwritten. Use `--force`
to replace them with the current templates.

## `grove build`

Build the static site. Detects the framework from `package.json`
and delegates to the framework's own build command.

**Syntax:** `grove build`

**Behavior:**

- Reads `<root>/package.json` to detect `@grove-dev/astro`,
  `@grove-dev/nextjs`, or `@grove-dev/svelte`.
- Runs `astro build`, `next build`, or `vite build` accordingly.
- **V1 only Astro is fully supported.** Next.js and SvelteKit
  scaffolds will pass `grove new` but `grove build` will exit 1
  with "Next.js and SvelteKit are roadmap-only in V1."

## `grove dev`

Start the framework dev server.

**Syntax:** `grove dev`

Same framework detection as `grove build`. V1 only Astro is
supported.

## Related docs

- **[grove.config.ts reference](/reference/config/)** — every
  config field, every default.
- **[Record schema](/reference/record-schema/)** — the schema
  `grove validate` and `grove generate` work against.
