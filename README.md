# Grove

A CLI and static framework that turns awesome lists and curated GitHub repositories into living, health-aware developer directories.

```txt
Awesome lists show links. Grove shows what is still useful.
```

Grove is not a replacement for awesome lists. It is a maintenance and web layer for them. You keep the simplicity of a Markdown list; Grove adds repository health, metadata enrichment, search, filters, SEO pages, taxonomy, and human curation workflows on top.

---

## Install

```bash
pnpm add -g @grove-dev/cli   # or use it via pnpm dlx
```

## Quick start

In a fresh directory:

```bash
grove init                        # scaffolds curated.config.ts, data/, .github/, etc.
grove import https://github.com/avelino/awesome-go
grove analyze                    # fetches GitHub metadata, writes data/health.yml
grove build-data                 # generates data/generated/apps.{full,index}.json
grove review                     # lists cleanup candidates for human review
grove validate                    # schema + reference checks
grove build-llms-full             # public/llms.txt + llms-full.txt
grove build                      # static site via Astro
grove dev                        # http://localhost:4321
```

The result is a searchable, filterable, SEO-friendly static directory with project health, maturity signals, taxonomy, and human curation decisions.

## How it works

A project repo has two things:

1. A `curated.config.ts` — site name, tagline, and paths.
2. A `data/` directory — projects (per-app YAML or a flat `items.yml`), GitHub health, decisions, taxonomy, and overrides.

The CLI never deletes projects. It produces signals; humans make curation decisions through `data/decisions.yml`.

## What you get

- **Search and filter** by category, stack, language, platform, license, health, lens, label, and free text.
- **Health signals** for every project: `active`, `mature`, `stale`, `inactive`, `archived`, `unknown`, `needs_review`, `historical`.
- **Two curation layers**:
  - `decisions.yml` controls visibility (`highlight` / `keep` / `needs_review` / `hide` / `remove` / `historical`).
  - `overrides.yml` patches parsed items without re-running import.
- **Token-free GitHub enrichment** (HTML scraping + shields.io fallback for license, language, topics, homepage).
- **GitHub Activity** in monthly buckets via the API.
- **LLM-friendly output**: `llms.txt` (sitewide index) and `llms-full.txt` (per-project detail).
- **SEO**: per-project pages, sitemap, robots.txt, JSON-LD structured data.
- **Light and dark theme** out of the box.

## Repository layout

This is the framework repo. It contains only the engine:

```txt
grove/
├── packages/
│   ├── core/      # Zod schemas, config loader, markdown importer, GitHub client, health classifier, validators, YAML IO, taxonomy types
│   ├── cli/       # `init`, `import`, `analyze`, `validate`, `build-data`, `review`, `enrich`, `build-llms-full`, `build`, `preview`
│   └── astro/     # Reusable Astro components, layouts, and a project template (`template/default/`)
├── docs/
│   ├── ARCHITECTURE.md
│   └── MILESTONES.md
├── package.json   # private pnpm workspace
└── README.md
```

Each project repo you create lives in its own repository and contains only data + branding:

```txt
my-directory/
├── curated.config.ts
├── data/
│   ├── apps/                 # one YAML per project (recommended)
│   ├── taxonomy/             # stacks.yml, platforms.yml, categories.yml, distribution-channels.yml
│   ├── generated/            # build output (gitignored)
│   ├── items.yml             # alternative: flat list of items
│   ├── health.yml
│   ├── decisions.yml
│   └── overrides.yml
├── content/
│   └── methodology.md
├── public/                   # logo, OG image, custom assets
├── .github/                  # workflows + issue templates (scaffolded by `init`)
├── LICENSE                   # MIT (scaffolded by `init`)
├── astro.config.mjs          # from `template/default/`
├── package.json
├── tailwind.config.mjs
└── README.md
```

## Packages

- **`@grove-dev/core`** — Environment-light TypeScript. Owns Zod schemas, config loading, Markdown parsing, item normalization, taxonomy types, YAML IO, GitHub metadata, health classification, validation, HTML-scrape enrichment, and rate-limit-aware HTTP helpers.
- **`@grove-dev/cli`** — Thin orchestration layer over core. All commands are predictable and scriptable. Project files are the source of truth.
- **`@grove-dev/astro`** — Reusable Astro components (`ItemCard`, `HealthBadge`, `ScoreBars`, `DirectoryFilters`, `LensTabs`, `MethodologyPanel`, etc.) and a `template/default/` directory that `init` copies into a new project.

## CLI commands

### V1 (core flow)

| Command | Purpose |
|---|---|
| `grove init [name]` | Create a file-based project wrapper (config, data dirs, taxonomy, workflows, issue templates, LICENSE). |
| `grove import <source>` | Parse a Markdown awesome list (GitHub URL, raw URL, or local path) into `data/apps/*.yml`. |
| `grove analyze [--limit N]` | Fetch GitHub metadata for each project, write `data/health.yml`. Use `--limit` for rate-limited demos. |
| `grove validate` | Schema + reference checks (duplicate ids, missing descriptions, broken categories, unknown decisions). |
| `grove build-data` | Compile `data/apps/*.yml` and `curated.config.ts` into `data/generated/apps.{full,index}.json` plus a typed `src/data/config.ts`. |
| `grove build-llms-full` | Emit `public/llms.txt` (sitewide index) and `public/llms-full.txt` (per-project detail). |
| `grove review` | List cleanup candidates from `data/health.yml` to `data/generated/review-report.json`. |
| `grove build` / `grove preview` | Run the project's `astro build` / `astro preview` script. |

### V1.1

| Command | Purpose |
|---|---|
| `grove enrich [--limit N]` | Token-free HTML-scrape GitHub enrichment (license, language, topics, homepage). Re-runs are no-ops. |

## Health philosophy

Grove produces signals, not verdicts.

| Status | Meaning |
|---|---|
| `active` | Pushed within ~6 months. |
| `mature` | Active and well-adopted. |
| `stale` | No commits in 6–18 months. |
| `inactive` | No commits in 18+ months. |
| `archived` | The repo is archived on GitHub. |
| `unknown` | No GitHub metadata available. |
| `needs_review` | Borderline — invites human review. |
| `historical` | Kept on purpose for reference; the curator's call. |

A project is never deleted by the CLI. Humans decide what to `highlight`, `keep`, `needs_review`, `hide`, `remove`, or preserve as `historical` in `data/decisions.yml`.

## MVP boundaries

V1 is static and file-based. Grove does not include a database, auth, CMS, admin dashboard, plugin system, AI classification layer, marketplace, or multi-tenant SaaS. If you need those, host a different layer on top of the generated `dist/`.

## Develop the framework

```bash
pnpm install
pnpm -r build
pnpm --filter @grove-dev/cli dev   # tsx src/index.ts --help
```

## License

MIT — see `LICENSE` in the framework and every scaffolded project.
