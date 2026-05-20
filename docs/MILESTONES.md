# Milestones

## Milestone 1 - Framework Foundation

Goal: an empty project can build a basic static directory from config and `data/items.yml`.

Tasks:

- Setup pnpm workspace
- Add `packages/core`
- Add `packages/cli`
- Add `packages/astro`
- Add config loader
- Add generic item schema
- Add basic renderer surface
- Add build command

Definition of done: `curated.config.ts` plus `data/items.yml` can drive a static directory project.

## Milestone 2 - Awesome List Importer

Goal: generate structured items from `README.md`.

Tasks:

- Markdown parser
- Heading/category extraction
- Link extraction
- GitHub repo detection
- Description extraction
- Duplicate detection
- `data/items.yml` generation
- `import-report.md` generation

## Milestone 3 - GitHub Health Analyzer

Goal: generate usefulness and maintenance signals.

Tasks:

- GitHub API client
- Rate limit handling
- Metadata cache
- stars/forks/license/topics fetch
- archived/pushedAt/release fetch
- `data/health.yml` generation
- basic health classification

## Milestone 4 - Web UI

Goal: searchable and filterable directory UI inspired by Open Apps.

## Milestone 5 - Human Curation Workflow

Goal: `decisions.yml` controls final display while CLI flags review candidates.

## Milestone 6 - Open Apps Alignment

Goal: Open Apps can migrate to, or at least become compatible with, the generic schema.
