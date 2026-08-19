---
title: grove check
description: Validate records, regenerate artifacts, and run astro check — the single CI gate for every change.
---

`grove check` is the single-command entry point for validation. It runs in CI on every pull request and catches schema errors, cross-reference errors, and broken taxonomy values before they merge.

## Run it

Locally:

```bash
grove check            # validate + generate + sitemap + llms + robots + astro check
grove check --strict   # also fail on warnings (recommended for CI)
```

In CI, the scaffold writes `.github/workflows/ci.yml`, which runs `grove check --strict` on every PR. Failed validation blocks merge.

## What it checks

The validator runs in this order; the first failure stops the run:

1. **Config load** — `grove.config.ts` parses and validates against the Zod schema. A misspelled field or wrong type fails here.
2. **YAML parse** — every `data/records/*.yml` is parseable YAML.
3. **Schema validation** — each record matches its blueprint's Zod schema (see [Record schema](/reference/record-schema/)):
   - `kind` matches the space's `blueprint`. `project-directory` is the only supported blueprint today, so `kind` must be `project`.
   - Required fields are present (`slug`, `kind`, `name`, `description`, `category`).
   - Enum values are valid (`projectType`, `category`, `tags`, etc.).
   - URL fields are well-formed (`repoUrl`, `homepageUrl`, `logoUrl`, `links.*`).
4. **Slug uniqueness** — every record has a unique `slug`. Two records cannot share a slug.
5. **Filename match** — the record's `slug` matches its filename (`data/records/<slug>.yml`).
6. **Cross-record references** — `related[]`, `parent`, and other slug references resolve to existing records.
7. **Taxonomy values** — every record's `category`, `stack`, `platform`, and `license` values are present in `data/taxonomy/*.yml`.
8. **Decisions** — every entry in `data/decisions.yml` references an existing slug. Every `pin`/`renameSlug`/`sortPriority` field is well-formed.
9. **Overrides** — every entry in `data/overrides.yml` applies cleanly to the matching record (no type mismatches).
10. **Collections** — every `data/collections/*.yml` has a valid `query` predicate that matches at least one record (warnings if empty).
11. **Body paths** — every `content:` path resolves to an existing Markdown file.

`validateProject` (`packages/core/src/validate.ts`) does not check `sitemap.xml`, `llms.txt`, `llms-full.txt`, `robots.txt`, or `og-image.svg` — those files aren't validated at all; `grove check` just regenerates them unconditionally via `prepareDirectory()` after the checks above pass, then runs `astro check`.

If `astro check` passes, the build is good to go.

## Severity levels

Two exit codes:

- **Exit 0** — validation passed.
- **Exit 1** — validation failed; the PR is blocked.

By default, **warnings** are reported to stdout but do not affect exit code. `--strict` promotes warnings to errors:

| Issue | Default | `--strict` |
|---|---|---|
| Missing `bestFor` on a curated record | warning | error |
| Slug doesn't match filename | error | error |
| Unparseable YAML | error | error |
| Empty collection (no records match) | warning | error |
| `links.github` differs from `repoUrl` | warning | error |
| Description > 200 characters | warning | warning |

For CI on a mature directory, use `--strict` to keep drift out.

## Reading the output

Each issue is printed as `[severity] code: message`, one line per issue (`packages/cli/src/index.ts:72-74`). A clean run with a couple of warnings looks like this:

```
[warning] unknown_taxonomy_value: coolify: category "devtools" is not defined in data/taxonomy/categories.yml
[warning] slug_mismatch: cal-com: record slug "cal-com-v2" does not match filename
[grove] 247 records prepared; sitemap and llms files updated.
```

The final `[grove] ...` line only prints once validation passes without a blocking failure — it comes from `prepareDirectory()` regenerating every artifact (`packages/cli/src/index.ts:80-83`), not from a per-file "updated" log. There is no separate line for `sitemap.xml`, `llms.txt`, `llms-full.txt`, `robots.txt`, or `og-image.svg` individually.

Failures look like:

```
[error] duplicate_slug: Duplicate record slug: old
[error] zod_error: cool-tool: projectType Invalid enum value
```

The command then exits with code 1 and does not print a summary line. Each error points at the file and the field. Fix and re-run.

## What it does NOT check

- **Record accuracy.** A description saying "the world's best project" passes validation; reviewer judgement is required.
- **URL reachability.** A 404 on `repoUrl` passes validation. Run `grove audit` or a manual check for that.
- **Cross-record semantics.** "Coolify is a Heroku alternative" passes validation; reviewer judgement for accuracy.
- **Editorial consistency.** Slug style, tag vocabulary, category assignment — humans enforce these.

Validation catches structural problems. Curation is a human job.

## Linting and formatting

The scaffold ships a Biome config for TypeScript and JSON files. To run it:

```bash
pnpm lint           # biome check
pnpm lint --fix     # biome check --write
```

`grove check` does not run Biome — the two are independent. CI runs both: `biome check` first, `grove check` second.

## Schema migrations

When the record schema changes between versions, `grove check --strict` flags old-style fields:

```
[check] 1 warning:
  - data/records/legacy.yml: "sortPriority" replaced deprecated "pin"; consider updating
```

There is no automatic `grove migrate` command. Deprecated fields are mapped for one release with a warning (e.g., `pin` → `sortPriority`); curators apply the rename in their next PR. See the [Migration guide](/reference/migration/) for the current state of deprecated fields.

## Continuous integration

The scaffold's `ci.yml` workflow:

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22.12
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec biome check
      - run: pnpm exec grove check --strict
      - run: pnpm build
```

A green CI means the PR is safe to merge from a structural standpoint. The reviewer decides editorial fitness.

## Related

- [CLI reference — `grove check`](/reference/cli/#grove-check) — full flag reference
- [Record schema](/reference/record-schema/) — the schema validation enforces
- [Author a record](/content/author-a-record/) — how to write a record that passes