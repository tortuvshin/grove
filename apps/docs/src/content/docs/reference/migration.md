---
title: Migration guide
description: Version upgrade guide — breaking changes between Grove releases and how to handle them.
---

This page tracks breaking changes between Grove releases and the migration steps required.

The migration page deliberately documents **what actually shipped**. Earlier versions of this page described a `record.health → record.health_classification` rename that never landed in code, and a "next" release that never came. Those entries are removed.

## Current release

The four published packages are at the same version (`@grove-dev/{core,astro,cli,starlight}`). Refer to the live changelog at <https://github.com/tortuvshin/grove/releases> for what's new in each release. The roadmap is at [Project > Roadmap](/project/roadmap/).

## Breaking changes by major version

### 0.4.x → 0.5.x

- **Node version.** Node 22.12+ is now required. Node 18 and 20 are no longer supported.
- **Astro adapter.** `output: 'hybrid'` is now the default for non-static builds. Pure-static sites don't need changes.
- **CLI exit codes.** `grove check` exits non-zero on warnings (use `--no-strict` to keep the older permissive behavior).
- **Removed CLI commands.** `grove dev` and `grove build` are removed; use `astro dev` and `astro build` directly.

### 0.3.x → 0.4.x

- **Required field.** `site.url` is now required in `grove.config.ts`.
- **Starlight version.** `@grove-dev/starlight` v0.4 requires Starlight ≥ 0.38. Older Starlight sites need to upgrade.

## Active deprecations

The following remain functional but are deprecated. Migration is optional today but will become required in a future release.

- **`data/decisions.yml` `pin` field.** Replaced by `sortPriority` for new entries. The framework still reads `pin` and treats it as `sortPriority` for back-compat, but new YAML should use `sortPriority`.
- **`record.scoreTier` accessor.** Deprecated in favor of `record.scores.overall` and `scoreTier(record)` from `@grove-dev/core`. Existing usages on the record map to the `scores.overall` field.

## Removed earlier — kept here so old PRs make sense

These are items that have already shipped as deprecations in past releases, with the framework honoring the older spelling for one major version.

- **`browse.facets`** replaced the top-level `facets` key. The top-level `facets` is now a hard parse-time failure with a pointed migration message (`schema.ts:731-738`). To migrate, delete `facets:` from `grove.config.ts` and place the value at `browse.facets:` instead.
- **`resourcesFileSchema`** `unwrapRecords()` was removed; `recordsFileSchema = resourceSchema` now and `parse()` directly maps a single record.

## Schema migrations by hand

For each release, the canonical YAML shape changes. Most changes are non-breaking (new fields are optional; renamed fields are mapped for one release). When a release introduces a breaking schema change, the framework's validation surfaces it via `grove check`:

```text
[error] grove.validation.invalid_record: missing required field 'description' on slug 'some-record'
[error] groove.validation.unknown_field: 'record.health_classification' on slug 'older-project' — use 'record.health'
```

If a field is renamed, the framework honors the old spelling for one release and emits a warning, not an error:

```text
[warning] grove.deprecation.pin_to_sortPriority: 'pin' is deprecated; use 'sortPriority' on slug 'some-record'
```

## What this page does not promise

- **An automatic `grove migrate` command.** Earlier versions of this page described one. It is not implemented. Schema migrations are handled by the parser's back-compat mapping and a warning, with curators applying the rename in their next PR.
- **Future releases.** Once a release ships, its breaking changes are appended here. Speculative changes do not appear.

## See also

- [Reference: configuration](/reference/config/) — every `grove.config.ts` field.
- [Reference: record schema](/reference/record-schema/) — every record kind and field.
- [Releases](https://github.com/tortuvshin/grove/releases) — the live changelog.
- [Project: roadmap](/project/roadmap/) — what's planned.
