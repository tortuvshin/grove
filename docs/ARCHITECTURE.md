# Architecture

Open Curated is a generic engine for living developer directories.

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

### `@open-curated/core`

Core is environment-light TypeScript. It owns schemas, config loading, Markdown parsing, item normalization, YAML IO, GitHub fetching, health classification, and validation.

### `@open-curated/cli`

CLI is a thin orchestration layer over core. Commands should be predictable and scriptable, with project files as the source of truth.

### `@open-curated/astro`

Astro provides reusable UI primitives for project repositories. The web output remains static and should be easy to customize in each project repo.

## Data Flow

```txt
sources/README.md
  -> open-curated import
  -> data/items.yml
  -> open-curated analyze
  -> data/health.yml
  -> data/decisions.yml + data/overrides.yml
  -> open-curated validate
  -> open-curated build
  -> static directory
```

## Health Philosophy

Open Curated emits signals, not final judgments. A stale or inactive status should invite review rather than deletion. `decisions.yml` is the human curation layer that decides whether an item is highlighted, kept, hidden, removed, or preserved as historical.
