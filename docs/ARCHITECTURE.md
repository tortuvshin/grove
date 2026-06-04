# Architecture

Grove is a generic engine for living developer directories.

## Boundaries

The framework repo owns reusable code:

- import Markdown awesome lists
- parse project links, descriptions, and categories
- detect GitHub repositories
- generate structured item data
- fetch GitHub metadata
- classify repository health
- validate data files
- support human curation decisions
- expose static web building blocks

Project repos own project-specific state:

- `curated.config.ts`
- `sources/`
- `data/`
- `content/`
- `public/`
- deployment config
- issue templates and contribution policy

The framework repo must not contain real Open Apps, MCP, agent, or other project datasets.

## Package Responsibilities

### `@grove-dev/core`

Environment-light TypeScript. Owns Zod schemas, config loading, Markdown parsing, item normalization, taxonomy types, YAML IO, GitHub metadata, health classification, validation, HTML-scrape enrichment, and rate-limit-aware HTTP helpers (`ghFetch`, `pLimit`).

### `@grove-dev/cli`

Thin orchestration layer over core. Commands are predictable and scriptable; project files are the source of truth.

### `@grove-dev/astro`

Reusable Astro components and a `template/default/` directory that `init` copies into a new project. The web output is static and easy to customize per project.

## Data Flow

```txt
sources/README.md
  -> grove import
  -> data/apps/<slug>.yml   (or data/items.yml)
  -> grove analyze
  -> data/health.yml
  -> data/decisions.yml + data/overrides.yml
  -> grove build-data
  -> data/generated/apps.{full,index}.json + src/data/config.ts
  -> grove build-llms-full
  -> public/llms.txt + public/llms-full.txt
  -> grove validate
  -> grove build (astro build)
  -> static site
```

## Health Philosophy

Grove emits signals, not final judgments. A stale or inactive status invites review rather than deletion. `decisions.yml` is the human curation layer that controls visibility: `highlight`, `keep`, `needs_review`, `hide`, `remove`, or `historical`.
