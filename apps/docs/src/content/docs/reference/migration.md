---
title: Migration guide
description: Version upgrade guide — breaking changes between Grove releases and how to handle them.
---

This page tracks breaking changes between Grove releases and the migration steps required.

## 0.5.0-next.2 → next (planned)

### Blueprint kind

The `blueprint.kind` discriminator gains two new values: `resource-hub` and `ecosystem-map`. Existing `project-directory` records continue to work unchanged.

```yaml
# Before
blueprint:
  kind: project-directory
  slug: projects
  name: Projects

# After (unchanged for existing users)
blueprint:
  kind: project-directory
  slug: projects
  name: Projects

# New — choose one of three
blueprint:
  kind: resource-hub     # for resources, articles, tutorials
  kind: ecosystem-map    # for organizations, people
  kind: project-directory # for open-source projects (existing)
```

### `data/taxonomy/*.yml` schema

The `description` and `color` fields are now optional. Existing files continue to parse.

### `data/collections/*.yml` schema

The `match` predicate now supports `scoreFloor`. Existing files without `match` continue to render the curated collection as a static list.

## 0.5.0-next.1 → 0.5.0-next.2

### Renamed fields

| Before | After | Notes |
|---|---|---|
| `record.health` | `record.health_classification` | Aligns with CHAOSS terminology |
| `record.freshness` | (removed) | Derived from `github.syncedAt` |

### Schema migrations

```yaml
# Before
health: active

# After
health_classification: active
```

`grove check --strict` will flag old-style files; `grove migrate` will rewrite them in-place.

### Removed exports

- `LENSES.featuredLatest()` — replaced by `LENSES.featured(records, limit)`.

## 0.4.x → 0.5.x

### Node version

Node 22.12+ is now required. Node 18 and 20 are no longer supported.

### `astro.config.mjs` adapter

`output: 'hybrid'` is now the default for non-static builds. Pure-static sites don't need changes.

### CLI exit codes

The `grove check` command now exits with non-zero status on warnings (use `--no-strict` to keep the old behavior).

### Removed CLI commands

- `grove dev` — removed; use `astro dev` directly.
- `grove build` — removed; use `astro build` directly.

## 0.3.x → 0.4.x

### New required fields

- `site.url` — required; was previously optional.

### Removed integrations

- `@grove-dev/starlight` v0.4 requires Starlight ≥ 0.38. Older Starlight sites need to upgrade.

## Deprecations in 0.5.x

The following APIs remain functional but are deprecated and will be removed in 0.6.x:

- `decisions.yml` `pin` field — replaced by `sortPriority`.
- `record.scoreTier` — derived from `record.scores.overall`.

## Migration tooling

`grove migrate` (planned, not yet shipped) will:

1. Detect old-style fields in YAML files.
2. Apply schema migrations in place.
3. Report any records that need manual review.

## Related

- [Configuration reference](/reference/config/)
- [Record schema](/reference/record-schema/)
- [Releases](https://github.com/tortuvshin/grove/releases)