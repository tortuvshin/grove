---
title: grove check
description: Validate records, regenerate every derived artifact, and run astro check — the single CI gate for every change.
---

`grove check` is the single-command entry point for validation. It runs in CI on every pull request and catches schema errors, cross-reference errors, and unknown taxonomy values before they merge.

## What it does, in order

1. Loads `grove.config.ts` (`loadConfig()`). If the config file itself fails to parse against the Zod schema, the command exits before any records are read.
2. Runs `validateProject()` (`packages/core/src/validate.ts`) against every file in `paths.recordsDir` (default `data/records`) and prints one line per issue.
3. If validation failed — or `--strict` was passed and any warnings were reported — the command stops here with exit code `1`. Nothing is regenerated.
4. Otherwise it calls `prepareDirectory()` (`packages/core/src/prepare.ts`), which regenerates every derived artifact, and prints a one-line summary.
5. Finally it runs `pnpm exec astro check` as a child process.

Source: `packages/cli/src/index.ts:64-85`.

## Run it

```bash
grove check            # validate, regenerate artifacts, run astro check
grove check --strict   # also fail when there are warnings
```

## What gets validated

`validateProject()` reads every `*.yml` file in `paths.recordsDir`, parses it, and accumulates issues across **all** files before returning — it does not stop at the first failure. Each issue carries a `code` and a `severity` of `error` or `warning`:

| Code | Severity | What it means |
|---|---|---|
| `missing_records_dir` | error | `paths.recordsDir` doesn't exist. |
| `schema_error` | error | The record's YAML parsed to something that isn't a mapping (empty file, a list, etc.), or a non-Zod exception was thrown while parsing it. |
| `duplicate_slug` | error | Two record files resolve to the same slug. |
| `zod_error` | error | One line per failed Zod check against `recordsFileSchema` — missing required field, wrong type, invalid enum value, and so on. If a record has no `kind`, it's defaulted to `project` before the Zod parse runs. |
| `slug_mismatch` | warning | The record's own `slug` field doesn't match its filename. |
| `unknown_taxonomy_value` | warning | The record's `category`, `stack`, or (for `platforms[]`) a `platform` value isn't defined in `data/taxonomy/{categories,stacks,platforms}.yml`. Only checked when the matching taxonomy file has entries. |
| `missing_health` | error | The record has a `repoUrl` or `links.github` but `data/health.yml` has no entry for its slug. |
| `missing_health_file` | warning | `data/health.yml` doesn't exist, but at least one record links to GitHub and would need an entry. |
| `health_file_invalid` | error | `data/health.yml` exists but fails to parse against its schema. |
| `decisions_file_invalid` | error | `data/decisions.yml` exists but fails to parse against its schema. |
| `unknown_decision_record` | error | An entry in `data/decisions.yml` references a slug that has no matching record. |

Source: `packages/core/src/validate.ts:70-284`.

A **YAML syntax error** (bad indentation, an unterminated string, and so on) is not one of these codes — `validateProject` calls the YAML parser without a `try`/`catch` around it, so a syntax error throws straight out of the function. It crashes the `check` command with the raw parser error message instead of a structured `[error] ...` line, and still exits `1`.

Two checks that a previous draft of this page claimed do not exist in the source: there is no check that `related[]` or `parent` slug references resolve to real records, no validation of `data/overrides.yml`, no check that `data/collections/*.yml` queries match records, no check of `content:` body paths, and no taxonomy check for `license`. None of those fields or files are touched anywhere in `validate.ts`.

## Severity and exit codes

- **Exit 0** — no errors (and, with `--strict`, no warnings either).
- **Exit 1** — at least one error, or (`--strict`) at least one warning.

By default only `errors.length === 0` decides the outcome; warnings are printed but don't fail the run. `--strict` changes the pass condition to `errors.length === 0 && warnings.length === 0` (`packages/core/src/validate.ts:286-299`).

## Reading the output

Each issue prints as `[severity] code: message`, one line per issue, via:

```ts
const output = issue.severity === "error" ? console.error : console.warn;
output(`[${issue.severity}] ${issue.code}: ${issue.message}`);
```

Both `console.error` and `console.warn` write to **stderr** in Node — so every `[error]`/`[warning]` line goes to stderr, not stdout. Errors print before warnings, regardless of file order, because `issues` is `[...errors, ...warnings]`.

A run with warnings but no errors looks like this (the message text comes straight from `validate.ts`'s templates):

```
[warning] unknown_taxonomy_value: coolify: category "devtools" is not defined in data/taxonomy/categories.yml
[warning] slug_mismatch: cal-com: record slug "cal-com-v2" does not match filename
[grove] 247 records prepared; sitemap and llms files updated.
```

The `[grove] ...` line is the only line printed via `console.log` (stdout), and only prints once validation passes without a blocking failure:

```ts
console.log(
  `[grove] ${prepared.generated.totalRecords} records prepared; sitemap and llms files updated.`,
);
```

Source: `packages/cli/src/index.ts:72-83`.

A blocked run looks like this, and stops — nothing after it runs, and there is no summary line:

```
[error] duplicate_slug: Duplicate record slug: old
[error] zod_error: cool-tool: projectType Invalid enum value
```

## What `prepareDirectory()` reads and writes

Once validation passes, step 4 above regenerates every derived artifact by calling the functions in `packages/core/src/prepare.ts`:

- **`generate()`** (`packages/core/src/build-data.ts`) reads every `data/records/*.yml` and `data/decisions.yml`, and writes `data/generated/records.full.json`, `data/generated/records.index.json`, `data/generated/records.json` (an alias of the full file), and `data/generated/site-config.json`.
- **`buildSitemap()`** writes `public/sitemap.xml` from the generated records and `data/collections/*.yml`.
- **`buildLlmsFiles()`** writes `public/llms.txt` and `public/llms-full.txt`.
- **`buildSiteArtifacts()`** writes `public/robots.txt` and a default `public/og-image.svg` — but only while those files still contain a `grove-generated` marker comment. Editing either file by hand removes the marker, and `check` stops touching it.
- **`buildOgImages()`** writes a per-record/per-collection/per-taxonomy OG image under `public/`.

None of this is checked by `validateProject()` — `check` regenerates all of it unconditionally after validation passes, then runs `astro check`.

## What it does NOT check

- **Record accuracy.** A description that overstates a project passes validation; that's reviewer judgement.
- **Cross-record semantics.** Whether a `related[]` reference or a written claim about another project is actually true — not checked (and, as noted above, `related[]`/`parent` slugs aren't even checked for *existing*).
- **Editorial consistency.** Slug style, tag vocabulary, category assignment — humans enforce these.

## Continuous integration

`grove init` writes no workflows; the reference app's `apps/example/.github/workflows/ci.yml` is the one to copy. As shipped there, the job runs `grove check` **without** `--strict`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec grove check
      - run: pnpm build
```

If you want CI to fail on warnings too, change that step to `pnpm exec grove check --strict`.

## Related

- [CLI reference — `grove check`](/reference/cli/#grove-check) — full flag reference
- [Record schema](/reference/record-schema/) — the schema `zod_error` issues are checked against
- [Author a record](/content/author-a-record/) — how to write a record that passes
