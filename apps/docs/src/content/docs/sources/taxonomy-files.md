---
title: Taxonomy files
description: How to author categories, stacks, platforms, licenses, and distribution channels in your Grove space.
---

Taxonomy files live under `data/taxonomy/` and shape how visitors filter, search, and navigate your space. Grove ships five taxonomy files; each one is a YAML list of named entries with display metadata.

## File layout

```
data/taxonomy/
├── categories.yml           # top-level grouping (e.g., "ai", "web", "cli")
├── stacks.yml               # programming-language or framework stacks
├── platforms.yml            # deployment platforms or ecosystems
├── licenses.yml             # software licenses
└── distribution-channels.yml # distribution surfaces (npm, PyPI, Homebrew, etc.)
```

## `categories.yml`

```yaml
- slug: ai
  name: AI & ML
  description: Agent frameworks, model servers, and ML tooling.
- slug: web
  name: Web
  description: Frameworks and tooling for the browser.
```

**Used by:** the top-level navigation, homepage facets, and per-record `taxonomy.categories`.

## `stacks.yml`

```yaml
- slug: python
  name: Python
  color: "#3776AB"
- slug: typescript
  name: TypeScript
  color: "#3178C6"
```

**Used by:** language-based filters and the per-record `taxonomy.stacks`.

## `platforms.yml`

```yaml
- slug: web
  name: Web
- slug: ios
  name: iOS
- slug: android
  name: Android
```

**Used by:** deployment-target filters and per-record `taxonomy.platforms`.

## `licenses.yml`

```yaml
- slug: mit
  name: MIT
  url: https://opensource.org/licenses/MIT
- slug: apache-2.0
  name: Apache 2.0
  url: https://www.apache.org/licenses/LICENSE-2.0
```

**Used by:** license facets and per-record `taxonomy.licenses`.

## `distribution-channels.yml`

```yaml
- slug: npm
  name: npm
  url: https://www.npmjs.com/
- slug: pypi
  name: PyPI
  url: https://pypi.org/
```

**Used by:** distribution facets and per-record `distribution.channels`.

## Authoring conventions

- **`slug`** is the canonical identifier used in `data/records/*.yml`; URLs derive from it.
- **`name`** is the human-readable label; locales can override it.
- **`description`** (optional) appears in tooltips and on taxonomy landing pages.
- **`color`** (optional, `stacks.yml`) is used by stack chips.
- **`url`** (optional) links the entry to an upstream definition.

## Adding a new taxonomy

To introduce a custom taxonomy (e.g., `audiences.yml`):

1. Create `data/taxonomy/audiences.yml` with the schema above.
2. Add the taxonomy name to `facets:` in `grove.config.ts`.
3. Reference it from each record via `taxonomy.audiences`.

## Related

- [Curated collections](/sources/collections/)
- [Author a record](/sources/records/)
- [Getting started → Create a space](/getting-started/create-a-space/) (legacy path)