# `@grove-dev/cli`

The `grove` command — create a Grove space, then run every operation that
keeps it useful.

```bash
pnpm dlx @grove-dev/cli@latest init my-space
```

[Documentation](https://withgrove.dev) ·
[CLI reference](https://withgrove.dev/reference/cli/) ·
[Configuration](https://withgrove.dev/reference/config/) ·
[Changelog](https://github.com/tortuvshin/grove/blob/main/CHANGELOG.md)

**Requirements:** Node.js ≥ 22.12. `grove init` uses pnpm to install.

**Status:** stable. There are no framework, blueprint, template, deployment,
build, or dev commands — Astro's own `pnpm dev` and `pnpm build` do that, and
the Grove integration prepares data automatically.

---

## Create

```bash
pnpm dlx @grove-dev/cli@latest init my-space
cd my-space
pnpm dev
```

`grove init [directory]` copies a complete working Grove site — every route,
`grove.config.ts`, `data/`, `content/`, `public/`, and `astro.config.mjs` —
then rewrites the project name, runs `pnpm install`, and runs `git init`.

Generated artifacts are deliberately *not* copied: `data/generated/` and the
emitted `public/` files are rebuilt on your first `pnpm dev`, so a fresh
project never starts life with someone else's stale output.

The copied source is a release snapshot of this repository's real
`apps/example/`, so the demo you can read and the project you get cannot
drift into separate implementations.

**You own everything it wrote.** No later Grove command overwrites your
routes or your data.

| Flag | Effect |
| --- | --- |
| `--no-install` | Skip `pnpm install` |
| `--no-git` | Skip `git init` |

The target directory must be empty or non-existent; `init` refuses to write
into a directory with files in it rather than merging.

## Validate and prepare

```bash
pnpm exec grove check
pnpm exec grove check --strict
```

`grove check` validates every YAML file against the schema, prints issues as
`[severity] code: message`, and — if validation passed — regenerates the
artifacts and runs `astro check`.

- Exits `1` on any error.
- With `--strict`, exits `1` on warnings too. Use this in CI.
- On success, writes `data/generated/*.json`, `public/sitemap.xml`,
  `public/robots.txt`, `public/llms.txt`, `public/llms-full.txt`, and
  `public/og/*.png`, then reports the record count.

Those generated files are Grove-owned. Edit the sources, not the output.
`astro dev` and `astro build` run the same preparation through the
integration, so you rarely need to invoke `check` by hand outside CI.

## Import

```bash
grove import https://github.com/<owner>/awesome-<topic>
grove import https://raw.githubusercontent.com/<owner>/<repo>/main/README.md
grove import ./local-awesome-list.md
```

`grove import <source>` parses an awesome-list README and writes
`data/records/<slug>.yml` for each entry, tagged
`source: { type: "import" }` so an imported record stays distinguishable from
a curated one. Review the results before committing — an import is a starting
point, not a curation decision.

## Synchronize

```bash
grove sync github               # refresh repository metadata
grove sync github --limit 25    # bound the run
grove sync github --strict      # fail if any record cannot be refreshed
grove sync contributors         # refresh contributor and repo stats
```

**`sync github`** rewrites only the `github.*` block of each record:
`repository.stargazers_count`, `forks_count`, `open_issues_count`,
`language`, `pushed_at`, `updated_at`, `archived`, `disabled`,
`default_branch`, `license`, `topics`, plus `latestReleaseAt` and
`homepage`. Your name, description, category, tags, and editorial fields are
never touched — that split is the point.

**`sync contributors`** writes `data/generated/contributors.json` and
`repo-stats.json`.

Both read a token from `GH_TOKEN` or `GITHUB_TOKEN`. Without one you get the
unauthenticated rate limit (60 requests/hour); `sync github` falls back to
scraping the repository's public HTML for records it cannot fetch, which
keeps scheduled runs useful but returns fewer fields. Each is reported as
`HTML fallback` in the summary.

Both commands are no-ops when disabled via `integrations.github.metadata` or
`integrations.github.contributors` in `grove.config.ts`, and say so.

## Curate and maintain

```bash
grove cleanup
grove cleanup --strict
```

`grove cleanup` writes `data/generated/cleanup-report.json` listing records
that need human review — stale, archived, or disabled. It deletes nothing.
`--strict` exits `1` when the queue is non-empty, which turns the report into
a scheduled CI reminder. Record what you decided in `data/decisions.yml`; a
decision always wins over a derived status.

```bash
grove collection promote --from '/browse?stack=flutter&category=finance' \
  --slug flutter-finance \
  --title 'Flutter finance apps' \
  --description 'Production-grade finance apps built with Flutter.'
```

`collection promote` turns a filter URL a reader could have shared into a
durable `data/collections/<slug>.yml`. `--from` and `--slug` are required.

```bash
grove readme generate            # write the block into README.md
grove readme generate --stdout   # print instead of writing
grove readme generate --check    # exit 1 if the README is out of date
grove readme generate --path docs/LIST.md
```

`readme generate` renders your records as an awesome-list block between the
`<!-- grove-readme:start -->` and `<!-- grove-readme:end -->` sentinels,
leaving everything outside them alone. `--check` in CI is what stops a
GitHub README drifting away from the site built from the same records.

```bash
grove icons sync
grove icons sync --check    # report drift, exit 1 if stale
grove icons sync --force    # overwrite local edits, drop extras
```

`icons sync` copies the packaged icon set into `public/icons/`. The Astro
integration does this automatically and preserves icons you edited; run
`--force` to restore the packaged versions.

## Audit

```bash
pnpm build && pnpm preview &     # audit needs a served site
grove audit
grove audit --page / --page /projects --runs 1
grove audit --desktop --json report.json --junit report.xml
```

`grove audit` runs Lighthouse against every page in `audit.pages[]` in
`grove.config.ts` and enforces the default budget — Lighthouse's own "good"
thresholds: scores ≥ 0.9, LCP ≤ 2500 ms, CLS ≤ 0.25, TBT ≤ 200 ms. Pages of
`type: "404"` are audited for completeness but exempt, because Lighthouse
cannot meaningfully score a 404 response.

| Flag | Effect |
| --- | --- |
| `--base-url <url>` | Override `audit.baseUrl` (default `http://127.0.0.1:4321`) |
| `--mobile` / `--desktop` | One profile instead of both |
| `--runs <n>` | Runs per page/profile, clamped to 1–5 (default 3, median-aggregated) |
| `--page <path>` | Restrict to specific paths; repeatable |
| `--json <file>` | Machine-readable report |
| `--junit <file>` | JUnit XML for CI test reporting |

Exits `0` when every page passes and `1` on any violation, with each
violation listed on stderr. It needs a locally installed Chrome and a
**running** preview server — it will not start one for you.

## Command reference

| Command | Does |
| --- | --- |
| `grove init [directory]` | Create a complete Grove site |
| `grove check` | Validate, regenerate artifacts, run `astro check` |
| `grove sync <github\|contributors>` | Refresh machine-owned metadata |
| `grove cleanup` | Write the human-review queue |
| `grove import <source>` | Convert an awesome-list README into records |
| `grove collection promote` | Promote a filter URL to a curated collection |
| `grove readme generate` | Render the awesome-list README block |
| `grove icons sync` | Copy the packaged icon set into `public/icons/` |
| `grove audit` | Run Lighthouse against the page manifest |

`grove --help` and `grove <command> --help` are authoritative;
`tests/integration/readme-truth.test.ts` asserts this table against them.

## When things go wrong

| Symptom | Cause and fix |
| --- | --- |
| `init` refuses to run | The target directory is not empty. Choose a new path — `init` will not merge into existing files. |
| `sync github` reports `unavailable` or `HTML fallback` | No token, or the rate limit is exhausted. Set `GH_TOKEN`. The fallback is expected behaviour, not an error. |
| `check` exits 1 with only warnings | You passed `--strict`. Fix the warnings or drop the flag. |
| `audit` cannot start | No Chrome, or nothing is serving `audit.baseUrl`. Run `pnpm preview` first. |
| A generated file keeps reverting | It is Grove-owned. Edit the source in `data/` or `content/`, not `data/generated/` or the emitted `public/` artifacts. |
| An edited icon came back | Run `grove icons sync --check` to see drift; the integration preserves edits but `--force` overwrites them. |

Every command is safe to re-run. `check`, `sync`, `cleanup`, `readme
generate`, and `icons sync` are idempotent — running twice on unchanged
sources produces the same files.

## Links

[Issues](https://github.com/tortuvshin/grove/issues) ·
[Contributing](https://github.com/tortuvshin/grove/blob/main/CONTRIBUTING.md) ·
[Security](https://github.com/tortuvshin/grove/blob/main/SECURITY.md)

## License

MIT
