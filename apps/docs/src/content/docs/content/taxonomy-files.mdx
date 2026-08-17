---
title: Taxonomy files
description: How to author categories, stacks, platforms, topics, licenses, and distribution channels in your Grove space.
---

Taxonomy files live under `data/taxonomy/` and shape how visitors filter, search, and navigate your space. Grove reads six fixed taxonomy files; each one is a YAML list of named entries with display metadata.

Taxonomy YAML owns the option **values, display names, and display order**. Which dimensions actually appear as browse filters — and the order of the filter groups themselves — is decided by `browse.facets` in `grove.config.ts` (see [Configuration reference](/reference/config/)).

## File layout

```
data/taxonomy/
├── categories.yml           # top-level grouping (e.g., "ai", "web", "cli")
├── stacks.yml               # programming-language or framework stacks
├── platforms.yml            # deployment platforms or ecosystems
├── topics.yml               # curated tag vocabulary for the Tag filter
├── licenses.yml             # software licenses
└── distribution-channels.yml # distribution surfaces (npm, PyPI, Homebrew, etc.)
```

Only these six filenames are read. Files with other names in `data/taxonomy/` are ignored — there is no custom-taxonomy mechanism in V1.

## `categories.yml`

```yaml
- id: ai
  name: AI & ML
  description: Agent frameworks, model servers, and ML tooling.
- id: web
  name: Web
  description: Frameworks and tooling for the browser.
```

**Used by:** the Category browse filter and homepage/category pages. Records reference an entry through their flat `category` field.

## `stacks.yml`

```yaml
- id: python
  name: Python
  color: "#3776AB"
- id: typescript
  name: TypeScript
  color: "#3178C6"
```

**Used by:** the Stack browse filter, stack pages, and stack chips. Records reference entries through `stack` (primary) and `stacks` (supporting).

## `platforms.yml`

```yaml
- id: web
  name: Web
- id: ios
  name: iOS
- id: android
  name: Android
```

**Used by:** the Platform browse filter. Records reference entries through `platforms`.

## `topics.yml`

```yaml
- id: agents
  name: Agents
- id: self-host
  name: Self-hosted
```

**Used by:** the Tag browse filter. When `topics.yml` exists, only the curated ids listed here appear in the Tag dropdown (with their display names); tags on records that aren't listed remain searchable and visible on record pages. When the file is absent, every raw record tag appears in the dropdown.

## `licenses.yml`

```yaml
- id: mit
  name: MIT License
  url: https://opensource.org/licenses/MIT
- id: apache-2.0
  name: Apache License 2.0
  url: https://www.apache.org/licenses/LICENSE-2.0
```

**Used by:** the License browse filter and license pages. Records reference entries through `licenses` (lowercase SPDX-style ids); records without a curated value fall back to the GitHub-synced license.

## `distribution-channels.yml`

```yaml
- id: npm
  name: npm
  url: https://www.npmjs.com/
- id: pypi
  name: PyPI
  url: https://pypi.org/
```

**Used by:** per-record `distribution.channels`.

## Authoring conventions

- **`id`** is the canonical identifier used in `data/records/*.yml`; URLs derive from it. Entries without an `id` and `name` are skipped.
- **`name`** is the human-readable label shown in filters, chips, and taxonomy pages.
- **File position is display order.** Filter options render in the order entries appear in the file; an explicit numeric **`order`** field overrides file position when present.
- **`description`** (optional) is carried into the generated site config for taxonomy landing pages.
- **`color`** (optional, `stacks.yml`) is used by stack chips.
- **`url`** (optional) links the entry to an upstream definition.

## Related

- [Configuration reference → `browse.facets`](/reference/config/)
- [Curated collections](/concepts/collections/)
- [Author a record](/content/author-a-record/)
- [Getting started → Create a space](/getting-started/scaffold/) (legacy path)

## Why `id` and not `slug`

Earlier versions of the codebase used `slug:` as the identifier key. The loader was changed to require `id:` because:

- Every taxonomy entry has multiple identifiers in real life (SPDX for licenses, language codes for stacks, OS names for platforms). `id:` keeps the structure open to `spdx_id` and similar secondary keys without re-reading the same `slug:`.
- A slug implies a URL; an id is just an identifier. The taxonomy files don't need URLs and the loader shouldn't pretend they do.

A vitest at `apps/docs/src/docs-taxonomy-guard.test.ts` rejects any docs example that uses `slug:` and asserts every tutorial example uses `id:`.

## Reference: canonical facet ids

`browse.facets` in `grove.config.ts` accepts a strict subset of these dimensions:

```ts
// packages/core/src/directory-facets.ts
export const FACET_IDS = [
  "category",
  "stack",
  "platform",
  "tags",
  "license",
] as const;
```

A typo in `browse.facets` fails config parsing immediately. The intended facet shape lives in `FACET_IDS`; the docs test (`docs-taxonomy-guard.test.ts`) imports this array and asserts no docs example adds an unknown facet id.
