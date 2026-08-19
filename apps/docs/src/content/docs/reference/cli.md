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

The scaffolder does not prompt at runtime — the blueprint and
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

- Each record gets `name`, `description`, `category`, `tags`, and
  `links` from the source. `stack`, `stacks`, `platforms`, and
  `projectType` are left empty for curators to fill in.

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

## `grove audit`

Run Lighthouse against every page declared in `grove.config.ts`'s
`audit.pages[]` manifest and enforce the default quality budget.
Implemented in `packages/cli/src/audit-cli.ts`; the runtime in
`packages/cli/src/audit.ts`.

**Syntax:** `grove audit [options]`

**Options:**

| Option | Description | Default |
|---|---|---|
| `--base-url <url>` | Override `audit.baseUrl` from `grove.config.ts` | from config; falls back to `http://127.0.0.1:4321` |
| `--mobile` | Run only the mobile profile | both mobile and desktop |
| `--desktop` | Run only the desktop profile | both mobile and desktop |
| `--runs <count>` | Runs per page (default 3, max 5) | `3` |
| `--page <path>` | Audit only this page path (repeatable) | all pages in `audit.pages[]` |
| `--json <path>` | Write a JSON report | unset |
| `--junit <path>` | Write a JUnit XML report | unset |

**Profile selection:** `--mobile` only → mobile; `--desktop` only →
desktop; both or neither → both.

**Reads:** `grove.config.ts` (parsed via the TypeScript AST — both
bare `defineConfig({...})` and `export default defineConfig({...})`
are accepted; requires `audit.pages[]`).

**Default budget** (`packages/core/src/audit.ts::DEFAULT_BUDGET`):

| Category | Metric / score | Threshold |
|---|---|---|
| scores | performance, accessibility, bestPractices, seo | `≥ 1.00` each |
| metrics | LCP | `≤ 1800 ms` |
| metrics | CLS | `≤ 0.05` |
| metrics | TBT | `≤ 100 ms` |

404 pages are scored but skipped from the budget — Lighthouse cannot
meaningfully measure a 404 (all scores come back as 0, all metrics as
Infinity).

**Writes:** `--json <path>` writes `{ results, violations }`.
`--junit <path>` writes an XML test suite `grove-audit` with one
`<testcase>` per result; `<failure>` elements annotate each violation
with category, name, expected, and actual values. XML special
characters (`<`, `>`, `&`, `'`, `"`) are escaped.

**Environment variables:** `CHROME_PATH` overrides the Chrome binary
path. On Linux, `--no-sandbox` is added automatically. `--headless=new
--disable-gpu --disable-dev-shm-usage` are always set.

**Output (per page):**

```
✓ mobile  /
✓ mobile  /projects/
✓ desktop /
✗ 1 budget violation(s)
  [mobile] /projects/coolify/ score.performance: expected 1, got 0.92
```

**Final line:** `✓ N page/profile combinations passed the budget` or
`✗ N budget violation(s)` with a list of each violation. Exit code is
1 when any violation is found, otherwise 0.

**Example:**

```bash
grove audit                       # full audit, mobile + desktop
grove audit --desktop --runs 5    # desktop only, 5 runs per page
grove audit --page /projects/     # one specific page
grove audit --json out.json --junit out.xml
```

## `grove collection promote`

Promote a filter URL into a curated `data/collections/<slug>.yml`
file. Implementation in `packages/cli/src/collection-cli.ts`.

**Syntax:** `grove collection promote [options]`

**Options:**

| Option | Description | Default |
|---|---|---|
| `--from <path>` **(required)** | Source filter path, e.g. `/browse?stack=flutter&category=finance` | — |
| `--slug <slug>` **(required)** | Slug for the new collection file | — |
| `--title <title>` | Collection title | humanised slug (e.g. `My Slug`) |
| `--description <description>` | Collection description | `Curated collection built from <from>.` |

**Query parsing** uses `URLSearchParams` on the substring after the
first `?`. Recognised keys:

| URL key | Maps to |
|---|---|
| `stack` | `query.stacks: [<stack>]` |
| `category` | `query.categories: [<category>]` |
| `platform` | `query.platforms: [<platform>]` |

Unknown keys are ignored. Values containing `&`, `=`, `+`, or percent-
encoded characters round-trip correctly.

**Writes** `data/collections/<slug>.yml` (the directory is created
with `mkdir { recursive: true }` if it doesn't exist). The emitted
shape:

```yaml
slug: <slug>
kind: curated
title: <title>
description: <description>
query:
  stacks: [<stack>]            # only if --from had stack=…
  categories: [<category>]     # only if --from had category=…
  platforms: [<platform>]      # only if --from had platform=…
  excludeStatuses: [archived]
ranking:
  preset: quality
seo:
  index: true
```

**Output:**

```
Wrote /<abs>/data/collections/<slug>.yml
```

Exit code is always 0 on success. The CLI does not run a follow-up
`grove check`; do that yourself to make sure the new collection
loads.

**Example:**

```bash
grove collection promote \
  --from "/browse?stack=flutter&category=finance" \
  --slug top-finance-flutter \
  --title "Top Flutter finance apps" \
  --description "Flutter apps for personal finance, payments, and budgeting."
```

## `grove readme generate`

Render an awesome-list-formatted README between the
`<!-- grove-readme:start -->` and `<!-- grove-readme:end -->` sentinels
and write it to `README.md` (or `--path`). Implementation in
`packages/cli/src/readme-cli.ts`; the renderer in
`packages/core/src/awesome-readme.ts`.

**Syntax:** `grove readme generate [options]`

**Options:**

| Option | Description | Default |
|---|---|---|
| `--stdout` | Print to stdout instead of writing to `README.md` (for CI dry-runs) | off |
| `--path <path>` | README path relative to cwd | `README.md` |
| `--check` | Exit with code 1 when the rendered block differs from the existing README; for CI gating | off |

**Reads:**

- `grove.config.ts` — `site.name`, `site.tagline?`, `site.description?`,
  `site.url?`, `site.repoUrl?`, and the `readme` block (title, tagline,
  intro, etc.).
- `data/records/*.{yml,yaml}` — every record file. For each, the CLI
  reads `slug`, `name`, `description`, `category`, `repoUrl` (falls
  back to `links.github`), `homepageUrl` (falls back to `links.website`),
  `visibility`, `stars` (from `github.stars` or `github.repository.stargazers_count`),
  `license` (from `github.license`).
- `data/taxonomy/categories.yml` — parsed array of `{ id, name }`.

Records with `visibility: hide` or `visibility: remove` are dropped.

**Writes** the README at `--path` with the awesome-list block
replaced between the sentinels. Hand-written content outside the
sentinels (intro, contributing notes, license) is preserved. If the
file does not exist yet, it is created with the rendered block
appended.

**Output (default mode):**

```
[grove readme] wrote README.md (6 records, 5 categories)
```

**`--check` mode** — exits 1 when the rendered block differs from the
existing README, otherwise:

```
[grove readme] README.md is up to date.
```

**`--stdout` mode** — prints the full rendered markdown to stdout
and exits 0. No file changes.

**Sentinel format:**

```markdown
<!-- grove-readme:start -->
... rendered block ...
<!-- grove-readme:end -->
```

`AWESOME_README_START` and `AWESOME_README_END` are exported from
`@grove-dev/core` for downstream tooling that needs to detect the
same sentinels.

**Example:**

```bash
grove readme generate            # write README.md
grove readme generate --check    # CI gate
grove readme generate --stdout   # preview in the terminal
grove readme generate --path docs/README.md
```

## `grove icons sync`

Copy the packaged icon set into `public/icons/`. Implementation in
`packages/cli/src/icons-cli.ts`; the copy logic in
`packages/core/src/sync-icons.ts`.

`@grove-dev/astro` already runs this same sync into `public/icons/`
on every build, so most sites never need to invoke it directly. The
command exists as an explicit escape hatch for two cases the
automatic build-time sync deliberately does not handle: restoring an
icon you hand-edited (`--force`), and failing CI when the packaged
set has drifted from what's on disk (`--check`).

**Syntax:** `grove icons sync [options]`

**Options:**

| Option | Description | Default |
|---|---|---|
| `--force` | Overwrite locally modified icons and drop extras (files no longer in the packaged set) | off |
| `--check` | Report drift without writing; exit 1 if anything is stale | off |

**Reads:**

- The packaged icon set under the CLI's own scaffold source
  (`public/icons/` inside the resolved scaffold — the installed
  `@grove-dev/cli` package's bundled `site/` directory, or, in the
  monorepo, `apps/example/`).
- `public/icons/.grove-icons.json` in the current directory — the
  sha256 manifest of files Grove previously wrote, used to tell a
  consumer-edited file from an untouched one.

**Writes** (default mode, no flags):

- `public/icons/<name>.svg` — one file per icon that is missing or
  unchanged since the last sync; overwritten to match the packaged
  version.
- `public/icons/.grove-icons.json` — manifest of every file Grove
  owns and its hash.
- Icons you have hand-edited are **left alone** — Grove detects the
  edit via the hash mismatch and skips the file.

**With `--force`:** every packaged icon is written regardless of
local edits, and files under `icons/{stacks,platforms}` that are not
in the packaged set are deleted (`prune` is implied by `--force`).

**With `--check`:** nothing is written; the command only reports.

**Output (default mode):**

```
[icons] 3 written, 0 removed, 1 kept
  kept (locally modified): stacks/flutter.svg
Run `grove icons sync --force` to restore the packaged versions.
```

**Output (`--check` mode):**

```
[icons] up to date
```

or, when drift exists:

```
  stale:    stacks/flutter.svg
  extra:    stacks/old-icon.svg
  modified: platforms/ios.svg
[icons] out of date — run `grove icons sync`
```

`--check` exits 1 whenever any file is stale, extra, or
locally modified; 0 when everything matches.

**Example:**

```bash
grove icons sync             # default: match packaged set, preserve edits
grove icons sync --force     # overwrite everything; prune icons not in packaged set
grove icons sync --check     # CI gate: exit 1 when drift is detected
```

---

## Related docs

- **[grove.config.ts reference](/reference/config/)** — every
  config field, every default.
- **[Record schema](/reference/record-schema/)** — the schema
  `grove check` validates against.
- **[Scheduled sync](/automation/scheduled/)** — the GitHub Actions
  workflows generated by `grove init`.
