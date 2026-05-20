# Open Curated

Open Curated is a CLI and static framework that turns awesome lists and curated GitHub repositories into living developer directories.

Awesome lists show links. Open Curated shows what is still useful.

It imports Markdown lists, extracts project metadata, checks repository health, flags outdated or inactive projects, highlights mature and useful projects, and builds a searchable web directory developers can use to learn, compare, adopt, and contribute.

## Positioning

Open Curated is not a replacement for awesome lists. It is a maintenance and web layer for them.

Awesome lists are easy to start, but hard to search, validate, enrich, and maintain. Open Curated keeps the simplicity of Markdown and structured files while adding repository health, metadata enrichment, search, filters, SEO pages, and human curation workflows.

## Architecture

```txt
Framework repo = generic engine
Project repo = data + config + source + curation decisions
```

This repository contains the framework only:

```txt
open-curated/
├── packages/
│   ├── core/
│   ├── cli/
│   └── astro/
├── docs/
├── examples/
└── README.md
```

Project repositories such as `open-apps`, `awesome-mcps`, `agent-stacks`, or `mongolian-oss` keep their own `curated.config.ts`, sources, data, content, branding, README, issues, and deployment.

Open Apps is the reference implementation for the web experience, but its data does not belong in this framework repo.

## V1 Flow

```bash
open-curated init awesome-mcps
open-curated import https://github.com/owner/awesome-list
open-curated analyze
open-curated validate
open-curated build
```

Or from a local README:

```bash
open-curated import ./README.md
```

The result is a searchable, filterable, SEO-friendly static web directory with project health, maturity signals, and human curation decisions.

## Packages

- `@open-curated/core` - config loading, schemas, Markdown import, GitHub metadata, health classification, validation, YAML IO.
- `@open-curated/cli` - `init`, `import`, `analyze`, `validate`, `build`, and `preview` commands.
- `@open-curated/astro` - reusable Astro components and styles for project repos.

## Data Files

Project repos are file-based:

```txt
curated.config.ts
sources/README.md
data/items.yml
data/health.yml
data/overrides.yml
data/decisions.yml
content/methodology.md
```

The CLI never automatically removes projects. It produces signals; humans make curation decisions.

## Health Statuses

Open Curated uses careful public labels:

- `active`
- `mature`
- `stale`
- `inactive`
- `archived`
- `unknown`
- `historical`
- `needs_review`

## MVP Boundaries

V1 stays static and file-based. No database, auth, CMS, admin dashboard, plugin system, AI classification, marketplace, or multi-tenant SaaS layer.

The first release goal is simple:

```txt
One awesome list in.
One useful living directory out.
```
