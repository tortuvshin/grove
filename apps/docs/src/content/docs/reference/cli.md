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

## `grove init`

Scaffold a new Grove space from the Astro template.

**Syntax:** `grove init [<directory>] [options]`

**Arguments:**

| Argument | Description | Default |
|---|---|---|
| `<directory>` | Project directory name. Omit to scaffold in the current directory (must be empty). | `.` |

**Options:**

| Option | Description | Default |
|---|---|---|
| `--no-install` | Skip `pnpm install` after scaffolding | install runs |
| `--no-git` | Skip `git init` after scaffolding | git init runs |

**Reads:** nothing (creates a new directory).

**Writes:**

- `<directory>/grove.config.ts`
- `<directory>/astro.config.mjs`
- `<directory>/package.json`
- `<directory>/tsconfig.json`
- `<directory>/data/records/` (example YAML records)
- `<directory>/data/taxonomy/` (categories, stacks, platforms)
- `<directory>/data/collections/` (example curated collections)
- `<directory>/data/decisions.yml` (empty `decisions: []`)
- `<directory>/public/` (robots.txt, og-image.svg)
- `<directory>/src/pages/` (home, browse, [slug], about, submit, 404)
- `<directory>/src/styles/global.css`
- `<directory>/.github/workflows/{ci,cleanup,deploy,readme,sync-contributors,sync-github}.yml`
- `<directory>/.github/ISSUE_TEMPLATE/`

The scaffolder does not ask prompts in v0.4.0 — blueprint and
integrations are chosen by editing `grove.config.ts` after scaffold.

**Example:**

```bash
pnpm dlx @grove-dev/cli@latest init my-space
cd my-space
pnpm install
pnpm dev
```

**Common errors:**

- `Install failed` — the scaffold itself completed; run `pnpm install`
  inside `<directory>/` to retry.
- `Directory not empty` — when omitting `<directory>`, the current
  directory must be empty.

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

## `grove check`

Validate data, generate artifacts, and run Astro checks. This is the
V1 single-command entry point — it covers validation, generation,
sitemap, `llms.txt`, `robots.txt`, and `og-image.svg`.

**Syntax:** `grove check [--strict]`

**Options:**

| Option | Description |
|---|---|
| `--strict` | Treat Grove warnings as errors |

**Reads:**

- `grove.config.ts`
- `data/records/*.yml` (every record file)
- `data/decisions.yml`
- `data/overrides.yml`

**Writes:**

- `data/generated/records.full.json` — every record, every field.
- `data/generated/records.index.json` — slim projection for list pages.
- `data/generated/records.json` — alias for `records.full.json`.
- `data/generated/site-config.json` — site name, tagline, nav, theme.
- `public/sitemap.xml` — sitemap of every visible record.
- `public/llms.txt` — one-line-per-record LLM index.
- `public/llms-full.txt` — full record bodies concatenated.
- `public/robots.txt` — robots policy with filter-URL guard.
- `public/og-image.svg` — brand-coloured OG card.

**Output:**

```
[check] <N> records prepared; sitemap and llms files updated.
```

**Example:**

```bash
grove check
grove check --strict
```

**Use this in CI.** The `ci.yml` workflow the scaffolder generates
runs `grove check` on every PR.

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

Refresh the local contributors aggregation from GitHub.

**Syntax:** `grove sync contributors`

**Reads:**

- `grove.config.ts` (for `site.repoUrl`)
- GitHub API (uses `GH_TOKEN` env or `secrets.GITHUB_TOKEN` in Actions)

**Writes:**

- `data/generated/contributors.json` — list of contributor handles + counts.
- `data/generated/repo-stats.json` — repo aggregate stats.

**Output:**

```
[sync contributors] N contributors from M repositories → data/generated/contributors.json
```

**Behavior:**

- The scaffolder writes `.github/workflows/sync-contributors.yml`,
  which runs this on a weekly cron (Sun 04:00 UTC) and on manual
  `workflow_dispatch`. The workflow auto-commits the generated
  files back to the repo.

## `grove cleanup`

Write a report of records that need human review.

**Syntax:** `grove cleanup [--strict]`

**Options:**

| Option | Description |
|---|---|
| `--strict` | Fail the run (exit 1) when review candidates exist |

**Reads:**

- `data/records/*.yml`
- `data/generated/records.full.json` (if present)

**Writes:**

- `data/generated/cleanup-report.json` — machine-readable list of
  candidates.

**Output:**

```
[cleanup] 5 candidate(s) → data/generated/cleanup-report.json
  - old-tool (inactive, 12★)
  - abandoned-app (archived, 304★)
  - ...
```

**Behavior:** The `cleanup.yml` workflow runs this on a monthly
cron and opens a PR with the report. The CLI does not delete or
hide records — that is a curator's call, made via `decisions.yml`.

## Related docs

- **[grove.config.ts reference](/reference/config/)** — every
  config field, every default.
- **[Record schema](/reference/record-schema/)** — the schema
  `grove check` validates against.
- **[Scheduled sync](/automation/scheduled/)** — the GitHub Actions
  workflows generated by `grove init`.
