# Grove

> **Grow useful community knowledge.**

[![npm @grove-dev/core](https://img.shields.io/npm/v/@grove-dev/core?label=%40grove-dev%2Fcore)](https://www.npmjs.com/package/@grove-dev/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/tortuvshin/grove/ci.yml?branch=main&label=CI)](https://github.com/tortuvshin/grove/actions/workflows/ci.yml)
[![GitHub stars](https://img.shields.io/github/stars/tortuvshin/grove?style=social)](https://github.com/tortuvshin/grove/stargazers)

Grove is an **open-source framework** that helps communities **collect, structure, maintain, and improve** the projects, tools, resources, and knowledge they rely on — over years, not weeks. Every artifact is a file. Every space is forkable, diffable, and PR-friendly.

> Grove is not built only for open-source app directories.

It works for any community knowledge space — a local tech ecosystem, an AI resource library, a tools directory, a learning collection, a startup map. Each one is a **Grove space**: a living, browseable, contributor-friendly site backed by plain files and a static generator.

**See it in the wild →** [**Open Apps**](https://github.com/tortuvshin/open-apps) — a production-ready open-source app directory running on Grove.

---

## Why Grove

Communities carry knowledge in many places: awesome lists on GitHub, READMEs, spreadsheets, internal docs, Notion pages, Slack threads. They all decay. Links rot, projects go stale, descriptions drift, contributions stop landing.

Grove treats community knowledge as something to **grow, maintain, prune, and improve** — not as a static list to publish and forget.

- **Collect** — import from Markdown awesome lists, YAML, or hand-authored records.
- **Structure** — categories, topics, tags, maintainers, organizations.
- **Maintain** — optional signals (GitHub activity, releases, archive state) flag what needs review.
- **Improve** — human curators make the final call via plain, reviewable data files.
- **Prune** — visibility decisions (`highlight` / `keep` / `needs_review` / `hide` / `remove` / `historical`) keep the space healthy over years.

No database. No CMS. No admin dashboard. The whole space is plain text, in your repo.

---

## Table of contents

- [Quick start](#quick-start)
- [What you get](#what-you-get)
- [Status](#status)
- [Spaces built with Grove](#spaces-built-with-grove)
- [Repository layout](#repository-layout)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [Maintainers](#maintainers)
- [License](#license)

---

## Quick start

### Prerequisites

- **Node.js** `>=20`
- **pnpm** `10.x` — the repo pins `pnpm@10.12.1`; easiest via Corepack: `corepack enable && corepack prepare pnpm@10.12.1 --activate`

### Scaffold a new space

```bash
# Create a new space. The CLI runs the Astro template by default.
pnpm dlx @grove-dev/cli@latest new my-space

cd my-space
pnpm install
```

The scaffolder writes a `grove.config.ts`, a `data/` tree, GitHub Actions for refresh + deploy, and the framework project. Pick a framework (`astro` is the only fully supported target in V1; `svelte` lands in v0.3.0) and a deploy target (`vercel` / `netlify` / `cloudflare` / `github-pages`) when prompted.

### Add resources, build, deploy

```bash
# Import an existing awesome list
pnpm exec grove import https://github.com/avelino/awesome-go

# Refresh GitHub activity / archive / release signals (works without a token)
pnpm exec grove sync github

# Validate the data
pnpm exec grove validate

# Build the data files + static site
pnpm exec grove generate
pnpm exec grove sitemap
pnpm exec grove llms
pnpm build
```

The output is a fully static site — drop the `dist/` directory on Vercel, Netlify, Cloudflare Pages, or GitHub Pages.

For the full reference (every CLI command, every config field), see the [docs site](https://github.com/tortuvshin/grove/tree/main/docs) and the [architecture overview](./docs/ARCHITECTURE.md).

---

## What you get

- **File-based data** — every resource is a YAML record. No database, no admin UI.
- **Search, filter, and topic pages** — out of the box, fully static, SEO-friendly.
- **Contribution workflow** — submission via issue template, validated via pull request.
- **Optional maintenance signals** — GitHub activity, archive state, latest release, license presence.
- **LLM-friendly output** — `llms.txt` and `llms-full.txt` for AI assistants that need structured context.
- **Static by default** — fast, cheap, forkable, archive-friendly.
- **Easy to customize** — the engine is small; spaces fork the parts they want to change.
- **One supported framework today, one on the runway** — `@grove-dev/astro` is the V1 renderer; `@grove-dev/svelte` is in active development for v0.3.0. `@grove-dev/nextjs` is reserved for a post-V1 wave. The data and CLI work the same regardless of renderer.

---

## Status

Grove is in **active development** (current release: **v0.2.x**). The core engine, CLI, and Astro adapter are stable enough to power a real space. The SvelteKit adapter is in active development (ships a working scaffold in v0.3.0). The Next.js adapter is post-V1 — we are not optimizing for Vercel-specific deployment in this framework. Breaking changes between minor versions follow the rules in [`docs/RELEASING.md`](./docs/RELEASING.md).

### Framework matrix

| Framework           | V1 status               | Notes                                                                              |
| ------------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| `@grove-dev/astro`  | **Supported (V1)**      | Full default template, components, layouts, all four blueprints scaffold-tested.   |
| `@grove-dev/svelte` | In development (v0.3.0) | Scaffold works and renders an empty directory page; full template lands in v0.3.0. |
| `@grove-dev/nextjs` | Post-V1                 | Skeleton package only. Not on the V1 critical path.                                |

**Use it for:** personal projects, internal directories, OSS ecosystems, learning collections, prototypes.
**Hold off for:** mission-critical production where a database migration is cheaper than a YAML migration.

For what's planned, see [`docs/roadmap.md`](./docs/roadmap.md).

---

## Spaces built with Grove

A real-world space that runs on Grove today:

- [**Open Apps**](https://github.com/tortuvshin/open-apps) — production-ready open-source applications.

Each space is its own repository, with its own data, branding, and community rules. Grove is the shared engine underneath. **If you fork Grove to launch a new space, send a PR to add it to this list** — we're happy to link to it.

---

## Repository layout

Grove is a pnpm monorepo. Six published packages, three side directories.

```txt
grove/
├── packages/
│   ├── core/        # Headless engine: schema, config, importers, validators, sitemap, llms.txt
│   ├── ui/          # Framework-agnostic UI primitives — v0.3.0 (currently a placeholder re-export)
│   ├── cli/         # `new`, `import`, `validate`, `generate`, `sitemap`, `llms`, `sync`, `cleanup`, `workflows`, `build`, `dev`
│   ├── astro/       # Astro adapter: components, layouts, design tokens, default template (V1 supported)
│   ├── nextjs/      # Next.js adapter: skeleton only (post-V1)
│   └── svelte/      # SvelteKit adapter: scaffold works in v0.3.0, full template in v0.3.0
├── examples/
│   └── openapps/    # Real Grove-powered space (the reference implementation)
├── docs/            # Framework documentation site (Starlight)
└── scripts/         # release.mjs, test-scaffold.mjs
```

A scaffolded space has only the data, branding, and `.github/` workflows it needs:

```txt
my-space/
├── grove.config.ts          # name, tagline, blueprint, paths
├── data/
│   ├── records/             # one YAML per resource (recommended)
│   ├── taxonomy/            # categories, topics, tags
│   ├── generated/           # build output (gitignored)
│   ├── health.yml           # optional: maintenance signals
│   └── decisions.yml        # visibility decisions
├── content/                 # methodology, about, guides
├── public/                  # logo, OG image, custom assets
├── .github/                 # workflows + issue templates
└── astro.config.mjs         # (or next.config.mjs / svelte.config.js)
```

---

## Architecture

Three layers, each with a single responsibility:

1. **Grove Core** (`@grove-dev/core`) — generic, framework-free. Owns the resource schema, config loader, importers, validators, taxonomy types, optional GitHub signal sync, sitemap, `llms.txt` generation, and the build pipeline.
2. **Grove UI** (`@grove-dev/ui`) — framework-agnostic UI primitives: filters, sort, stats, scores, slug helpers. Pure TypeScript, no Astro / React / Svelte. **V1 ships a placeholder re-export; the v0.3.0 milestone rebuilds primitives on the `Resource` union.**
3. **Grove framework adapters** (`@grove-dev/astro` is the V1 supported renderer; `@grove-dev/svelte` lands in v0.3.0; `@grove-dev/nextjs` is post-V1) — thin wrappers that ship components, layouts, tokens, and a default template per framework. Each adapter's template contains only pages, layouts, static config, and `.github/`. No business logic.

Spaces are made by forking a framework template and editing it. Business logic stays in Core / UI, so theme changes never reach into the engine.

For the full architecture write-up — including the three blueprints (`project-directory`, `resource-hub`, `ecosystem-map`) and the discriminated `Resource` union — see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Contributing

We welcome issues, PRs, and discussions. The quick version:

- **Found a bug?** Open a [bug report](https://github.com/tortuvshin/grove/issues/new?template=bug_report.md).
- **Want a feature?** Open a [feature request](https://github.com/tortuvshin/grove/issues/new?template=feature_request.md).
- **Found a security issue?** **Do not file a public issue.** Email **toroo.byamba@gmail.com** — see [`SECURITY.md`](./SECURITY.md) for the full policy.
- **Want to send a PR?** Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) first. It covers the dev setup, coding conventions, and the `pnpm test:scaffold` gate that catches the "did the tarball rewrite `workspace:*`?" regression class.

All community spaces follow the [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md). Be kind, assume good faith.

---

## Maintainers

Grove is built and maintained by:

- Contributors — see [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the list of people who have submitted PRs.

---

## License

Grove is released under the **MIT License** — see [`LICENSE`](./LICENSE). The same license applies to every scaffolded space unless you change it.
