# `@grove-dev/cli`

The deliberately small CLI for Grove. It scaffolds new projects,
validates sources, refreshes external metadata, and writes the
maintenance reports that keep generated outputs in sync with the
files you own.

Grove does not replace Astro. Use Astro's normal `pnpm dev` and
`pnpm build` — the `@grove-dev/astro` integration prepares data
automatically. `grove init` installs the `@grove/default` scaffold
(a shadcn registry item, shipped inside this CLI so `init` works
offline) with the official shadcn CLI, and `grove update` reconciles
that install against the hosted registry later without overwriting
files you have edited.

## Install

The recommended path is to run commands with `pnpm dlx`:

```bash
pnpm dlx @grove-dev/cli@latest init my-space
```

Or install it as a dev dependency inside a Grove project:

```bash
pnpm add -D @grove-dev/cli
```

Requires Node.js `>=22.12.0`.

## Commands

| Command | Purpose |
| --- | --- |
| `grove init [directory]` | Scaffold a project in `[directory]`: config files, then the `@grove/default` registry item installed through the shadcn CLI. |
| `grove check [--strict]` | Validate YAML sources, prepare artifacts, and run `astro check`. |
| `grove update` | Reconcile the installed UI scaffold against the registry upstream, preserving files you edited. |
| `grove sync github` | Refresh repository metadata for records that point at a GitHub repo. |
| `grove sync contributors` | Refresh directory-community metadata from configured sources. |
| `grove icons sync` | Reconcile the consumer's `public/icons/` with the packaged set. |
| `grove cleanup [--strict]` | Write the human-review report listing stale or archived records. |
| `grove collection promote` | Write a curated collection YAML from a filter URL. |
| `grove import` | Import records from an external source (for example, an awesome-list README). |
| `grove readme generate` | Render the generated README section (awesome-list block or consumer-facing summary). |
| `grove audit` | Run Lighthouse against every page declared in `grove.config.ts` `audit.pages[]` and enforce the default quality budget. |

### `grove init`

```bash
grove init my-space
```

Creates `my-space/` from the `@grove/default` registry item — the full
scaffold, bundled inside this package, so `grove init` makes no registry
request. It writes the project-root files the item cannot carry
(`package.json`, `tsconfig.json`, `components.json`, `grove.config.ts`,
`astro.config.mjs`, `pnpm-workspace.yaml`, an empty `data/records/`),
installs the item's 70 files into `src/` with the official shadcn CLI,
pins `@grove-dev/{core,astro,cli}` to this CLI's version, records the
install-time file hashes in `.grove/registry.lock.json` for `grove
update`, and finishes with `pnpm install` and `git init`.

It does not scaffold `content/`, `public/`, or `.github/` — those are
yours. Use `--no-install` to skip the final dependency install or
`--no-git` to skip the initial `git init`. If a step fails, the partial
scaffold is removed again, so the retry is just `grove init`.

### `grove check`

```bash
grove check
grove check --strict
```

Loads `grove.config.ts`, validates every record and decision file,
runs `prepareDirectory()`, and finishes with `astro check`. With
`--strict`, Grove warnings are treated as errors.

### `grove sync github`

```bash
grove sync github
```

Re-fetches the GitHub metadata that the generated record payloads
expose — stars, default branch, license, latest release, archived
flag, and so on. Produces a patch that `grove check` can apply.

### `grove sync contributors`

```bash
grove sync contributors
```

Refreshes the contributor list rendered on the contributors page
from the configured sources.

### `grove icons sync`

```bash
grove icons sync
grove icons sync --force
grove icons sync --check
```

Reconciles the consumer's `public/icons/` with the packaged set.
Locally edited files are left alone and reported. `--force` restores
the packaged versions; `--check` exits non-zero on any drift, which is
what CI should run.

### `grove update`

```bash
grove update            # apply what is safe
grove update --check    # print the plan, touch nothing
grove update --diff     # unified diff for every file upstream moved
grove update --force    # take the upstream side of a conflict
grove update --json     # machine-readable summary
```

Three-way reconcile of your installed UI against the registry upstream.
Files you edited are never overwritten; files where both sides moved are
reported as conflicts and left alone unless you pass `--force`. Exits `2`
while a conflict is unresolved, and keeps doing so on every subsequent
run until it is merged.

### `grove cleanup`

```bash
grove cleanup
grove cleanup --strict
```

Classifies records against their health signals and writes a
human-review queue. The CLI never deletes records — it produces a
file an editor can act on. With `--strict`, Grove warnings are
treated as errors.

### `grove collection promote`

```bash
grove collection promote --from PATH --slug SLUG [--title T] [--description D]
```

Writes a curated collection YAML from a filter URL. The result is a
file under the configured collections directory that the build
pipeline renders as a static page.

### `grove import`

```bash
grove import <source>
```

Imports records from an external source. The exact inputs depend on
the importer (for example, an awesome-list README); pass `--help`
for the current contract.

### `grove readme generate`

```bash
grove readme generate
grove readme generate --stdout
grove readme generate --path README.md
grove readme generate --check
```

Renders the generated README section. `--stdout` prints to standard
output. `--path` targets a specific file. `--check` exits non-zero
when the rendered block would differ from what is currently on disk
— useful for CI.

### `grove audit`

```bash
grove audit
grove audit --base-url https://staging.example.com
grove audit --mobile
grove audit --desktop
grove audit --runs 5
grove audit --page / --page /directory
grove audit --json report.json
grove audit --junit report.xml
```

Runs Lighthouse against every page declared in
`grove.config.ts` `audit.pages[]` and enforces the default quality
budget.

#### Options

| Flag | Description |
| --- | --- |
| `--base-url <url>` | Override the `baseUrl` declared in `grove.config.ts` (default: `http://127.0.0.1:4321`). |
| `--mobile` | Audit only the mobile profile. |
| `--desktop` | Audit only the desktop profile. |
| `--runs <n>` | Number of runs per page/profile (clamped to 1–5, default `3`). |
| `--page <path>` | Restrict the audit to specific page paths (repeatable). |
| `--json <file>` | Write a machine-readable JSON report to `<file>`. |
| `--junit <file>` | Write a JUnit XML report to `<file>`. |

#### Default budget

The shipped budget targets Lighthouse "good" thresholds on every
score category and metric:

- **Score categories** (`performance`, `accessibility`,
  `best-practices`, `seo`) ≥ 0.9
- **LCP** ≤ 2500 ms
- **CLS** ≤ 0.25
- **TBT** ≤ 200 ms

The budget is skipped for `type: "404"` pages — Lighthouse returns
`0`/`Infinity` for missing pages by design.

#### Output and exit codes

- stdout: per-run progress (`✓ <profile> <path>`) plus a final
  summary.
- stderr: a list of every budget violation, when any occur.
- `--json` and `--junit` reports capture the full result set for CI.

`grove audit` exits with code `0` when every page passes the budget
and `1` if any violation is detected, so it drops cleanly into CI
pipelines.

## Develop the CLI

```bash
pnpm --filter @grove-dev/cli check
pnpm --filter @grove-dev/cli dev -- --help
```

## License

[MIT](../../LICENSE) © Grove contributors.