# `@grove-dev/cli`

The deliberately small CLI for Grove directories.

```bash
pnpm dlx @grove-dev/cli init my-directory
```

## Commands

- `grove init [directory]` copies the canonical working Grove site and installs it.
- `grove check [--strict]` validates YAML, prepares artifacts, and runs `astro check`.
- `grove sync github` refreshes record repository metadata.
- `grove sync contributors` refreshes directory-community metadata.
- `grove cleanup [--strict]` writes the human-review report.
- `grove audit` runs Lighthouse 100×4 across every page declared in `grove.config.ts` `audit.pages[]`.

There are no framework, blueprint, template, deployment, build, or dev commands. Use Astro's normal `pnpm dev` and `pnpm build`; the integration prepares data automatically. The CLI bundles a release snapshot of the repository's real `apps/example/`, so the demo and generated project cannot drift into separate implementations.

## Audit

`grove audit` runs Lighthouse against every page declared in `grove.config.ts` `audit.pages[]` and enforces the standard 100×4 budget (Lighthouse cannot meaningfully score 404 responses, so `type: "404"` pages are audited for completeness but are exempt from the budget).

### Options

| Flag | Description |
| --- | --- |
| `--base-url <url>` | Override the `baseUrl` declared in `grove.config.ts` (default: `http://127.0.0.1:4321`). |
| `--mobile` | Audit only the mobile profile. |
| `--desktop` | Audit only the desktop profile. |
| `--runs <n>` | Number of runs per page/profile (clamped to 1–5, default `4`). |
| `--page <path>` | Restrict the audit to specific page paths (repeatable). |
| `--json <file>` | Write a machine-readable JSON report to `<file>`. |
| `--junit <file>` | Write a JUnit XML report to `<file>`. |

### Default budget

The shipped budget requires a perfect score in every Lighthouse category and the following metric ceilings:

- **LCP** ≤ 1800 ms
- **CLS** ≤ 0.05
- **TBT** ≤ 100 ms

The budget is skipped for `type: "404"` pages — Lighthouse returns `0`/`Infinity` for missing pages by design.

### Output and exit codes

- stdout: per-run progress (`✓ <profile> <path>`) plus a final summary.
- stderr: a list of every budget violation, when any occur.
- optional `--json` and `--junit` reports capture the full result set for CI.

`grove audit` exits with code `0` when every page passes the 100×4 budget and `1` if any violation is detected, so it drops cleanly into CI pipelines.

MIT
