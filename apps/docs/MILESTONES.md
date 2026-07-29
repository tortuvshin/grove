# Milestones

Status legend: done / in progress / not started.

> **Historical record.** These milestones predate the V0→V1 rename
> and the v0.4.0 package line. The V0 names used below —
> `data/items.yml`, `curated.config.ts`, `examples/basic`, "items"
> as the generic term — are kept verbatim so the historical record
> is faithful. The V1 canonical names are `data/records/<slug>.yml`,
> `grove.config.ts`, `apps/example/`, and "records".

## Milestone 1 - Framework Foundation (done)

Goal: an empty project can build a basic static directory from config and `data/items.yml` (V0 name — V1 is `data/records/`).

Tasks:

- Setup pnpm workspace
- Add `packages/core`
- Add `packages/cli`
- Add `packages/astro`
- Add config loader
- Add generic item schema
- Add basic renderer surface
- Add build command

Definition of done: `curated.config.ts` (V0 name — V1 is `grove.config.ts`) plus `data/items.yml` (V0 name — V1 is `data/records/`) can drive a static directory project.

Verified: `examples/basic` (now `apps/example/`) builds via `pnpm build`
and produces a static site with homepage, item pages, llms.txt,
sitemap.xml.

## Milestone 2 - Awesome List Importer (done)

Goal: generate structured items from `README.md`.

Tasks:

- Markdown parser
- Heading/category extraction (with TOC and emoji anchor cleanup)
- Link extraction
- GitHub repo detection
- Description extraction
- Duplicate detection
- `data/items.yml` (V0) generation → `data/records/<slug>.yml` (V1)
- `import-report.md` generation

Definition of done: an awesome list README imports into per-record YAML files (V0: `items.yml`; V1: `data/records/<slug>.yml`).

Verified: `punkpeye/awesome-mcp-servers` (2571 items across 56 real categories
after TOC and anchor filtering).

## Milestone 3 - GitHub Health Analyzer (done)

Goal: generate usefulness and maintenance signals.

Tasks:

- GitHub API client
- Rate limit handling
- Metadata cache
- stars/forks/license/topics fetch
- archived/pushedAt/release fetch
- `data/health.yml` generation
- basic health classification

Definition of done: each item with a GitHub link gets a health entry.

Verified: real GitHub metadata flows in; status (active / mature / stale /
inactive / archived / unknown), maturity, and reasons are populated.

Known gap: no on-disk cache yet, so re-runs re-fetch everything. Token is
required for big lists (60/hr unauthenticated vs 5000/hr with a token).

## Milestone 4 - Web UI (done)

Goal: searchable and filterable directory UI inspired by Open Apps.

Tasks:

- Homepage with stats and search
- Directory list with facets and filters
- Category pages
- Item detail pages
- Methodology / About / Submit pages
- llms.txt and llms-full.txt
- Sitemap and robots.txt
- Light / dark theme

Definition of done: a populated project repo renders a usable directory.

Verified: `examples/basic` and a fresh `init` project both build a working
directory end-to-end (init → import → analyze → validate → build).

## Milestone 5 - Human Curation Workflow (done)

Goal: `decisions.yml` controls final display while the CLI flags review candidates.

Tasks:

- `decisions.yml` schema (highlight / keep / needs_review / hide / remove / historical)
- visibility rules
- `grove review` command
- review report (`data/generated/review-report.json`)
- methodology page content

Definition of done: CLI flags stale items for review; humans make the final
visibility call through `data/decisions.yml`.

Verified: `grove review` writes `data/generated/review-report.json` with
status, tier, stale reason, last commit, and stars per candidate.

## Milestone 6 - Open Apps Alignment (done)

Goal: a real project repo (the Open Source Apps dataset) can run on Grove's
generic engine with no manual scripting.

Tasks:

- Audit Open Apps' schema (19 scripts, 4 taxonomies, 5 workflows)
- Port schema, GitHub client, enrichment, parser to TypeScript in `@grove-dev/core`
- Add `grove build-data`, `grove enrich`, `grove review`, `grove build-llms-full`
- Verify end-to-end on real Open Apps data (85 apps, 16 categories, 82 contributors)

Definition of done: the Open Source Apps dataset runs on Grove with the
generic CLI flow.

Verified: 85 apps imported as `data/apps/*.yml`, `grove build-data` produces
`apps.full.json` + `apps.index.json`, `grove build` produces 90 static pages
(index + about + contributors + submit + sitemap + llms.txt + 85 per-app pages),
`grove dev` serves the directory on `http://localhost:4321`.
