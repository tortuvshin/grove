# Grove

> **Grow useful community knowledge.**

Grove is an open-source framework that helps communities collect, structure, maintain, and improve the projects, tools, resources, and knowledge they rely on.

```txt
Grove is not built only for open-source app directories.
```

It works for any community knowledge space — a local tech ecosystem, an AI resource library, a tools directory, a learning collection, a startup map. Each one is a **Grove space**: a living, browseable, contributor-friendly site backed by plain files and a static generator.

---

## Why Grove

Communities carry knowledge in many places: awesome lists on GitHub, READMEs, spreadsheets, internal docs, Notion pages, Slack threads. They all decay. Links rot, projects go stale, descriptions drift, contributions stop landing.

Grove treats community knowledge as something to **grow, maintain, prune, and improve** — not as a static list to publish and forget.

- **Collect** — import from Markdown lists, YAML, or hand-authored records.
- **Structure** — categories, topics, tags, maintainers, organizations.
- **Maintain** — optional signals (GitHub activity, releases, archive state) flag what needs review.
- **Improve** — human curators make the final call via plain, reviewable data files.
- **Prune** — visibility decisions (`highlight` / `keep` / `needs_review` / `hide` / `remove` / `historical`) keep the space healthy over years.

Every artifact is a file. No database. No CMS. No admin dashboard. The whole space is forkable, diffable, and PR-friendly.

---

## Spaces built with Grove

A few example spaces that show what Grove can do:

- **Open Apps** — production-ready open-source applications.
- **oss.dev.mn** — the Mongolian open-source ecosystem.
- **tools.dev.mn** — developer tools, SDKs, and integrations.
- **ai.dev.mn** — practical AI resources for builders.
- **startups.dev.mn** — a map of the Mongolian tech ecosystem.

Each space is its own repository, with its own data, branding, and community rules. Grove is the shared engine underneath.

---

## Quick start

```bash
# Scaffold a new space (defaults to Astro)
pnpm create grove my-space

cd my-space
pnpm install

# Add resources
grove import https://github.com/avelino/awesome-go

# Refresh signals (optional — works without a GitHub token)
grove analyze

# Build the static site
grove build
```

`grove` scaffolds a `curated.config.ts`, a `data/` tree, GitHub Actions for refresh + deploy, and an Astro project. The site is fully static — easy to host on Vercel, Netlify, Cloudflare Pages, or GitHub Pages.

---

## What you get

- **File-based data** — every resource is a YAML record. No database, no admin UI.
- **Search, filter, and topic pages** — out of the box, fully static, SEO-friendly.
- **Contribution workflow** — submission via issue template, validated via pull request.
- **Optional maintenance signals** — GitHub activity, archive state, latest release, license presence.
- **LLM-friendly output** — `llms.txt` and `llms-full.txt` for AI assistants that need structured context.
- **Static by default** — fast, cheap, forkable, archive-friendly.
- **Easy to customize** — the engine is small; spaces fork the parts they want to change.

---

## Repository layout

```txt
grove/
├── packages/
│   ├── core/       # Generic resource schema, config, importers, validators, optional GitHub signal sync
│   ├── ui/         # Framework-agnostic UI primitives: filters, sort, scores, stats, slug
│   ├── cli/        # `new`, `import`, `analyze`, `validate`, `build-data`, `sitemap`, `build`, `dev`
│   └── astro/      # Astro adapter: components, layouts, tokens, theme. Includes a default template
├── examples/       # Real Grove-powered spaces (oss-dev-mn, open-apps, ...)
├── docs/
│   ├── ARCHITECTURE.md
│   ├── vision.md
│   └── roadmap.md
├── package.json    # private pnpm workspace
└── README.md
```

Each space is its own repo and only contains data + branding:

```txt
my-space/
├── curated.config.ts          # name, tagline, paths
├── data/
│   ├── resources/             # one YAML per resource (recommended)
│   ├── taxonomy/              # categories, topics, tags
│   ├── generated/             # build output (gitignored)
│   ├── health.yml             # optional: maintenance signals
│   └── decisions.yml          # visibility decisions
├── content/                   # methodology, about, guides
├── public/                    # logo, OG image, custom assets
├── .github/                   # workflows + issue templates
└── astro.config.mjs           # framework wiring
```

---

## Architecture

Three layers, each with a single responsibility:

1. **Grove Core** (`@grove-dev/core`) — generic, framework-free. Owns the resource schema, config loader, importers, validators, taxonomy types, optional GitHub signal sync, sitemap, llms.txt generation, and the build pipeline.
2. **Grove UI** (`@grove-dev/ui`) — framework-agnostic UI primitives: filters, sort, stats, scores, slug helpers. Pure TypeScript, no Astro / React / Svelte.
3. **Grove framework adapters** (`@grove-dev/astro`, `@grove-dev/nextjs`, `@grove-dev/svelte`) — thin wrappers that ship components, layouts, tokens, and a default template per framework. Each adapter's template contains only pages, layouts, static config, and `.github/`. No business logic.

Spaces are made by forking a framework template and editing it. Business logic stays in Core / UI, so theme changes never reach into the engine.

---

## Develop the framework

```bash
pnpm install
pnpm -r build
pnpm --filter @grove-dev/cli dev   # tsx src/index.ts --help
```

To scaffold a new space inside the workspace for local development:

```bash
node packages/cli/dist/index.js new examples/my-space --framework astro --deploy github-pages
```

## Release

A single command builds, bumps versions, and publishes all six packages to npm in dependency order (`core` → `ui` → `astro`/`nextjs`/`svelte` → `cli`):

```bash
pnpm release               # patch bump (0.1.0 -> 0.1.1)
pnpm release --minor       # minor bump (0.1.0 -> 0.2.0)
pnpm release --major       # major bump (0.1.0 -> 1.0.0)
pnpm release --bump=2.3.4  # explicit version
pnpm release:dry           # build + bump + dry-run publish (no actual publish)
```

The release script lives in `scripts/release.mjs`. It bumps every package's `version`, rewrites every `workspace:*` dep to the new version, reinstalls, rebuilds, and publishes with `--no-git-checks --access public`.

Authentication comes from `~/.npmrc`. Run `npm login` first if you have not yet authenticated this machine.

---

## License

MIT — see `LICENSE` in the framework and every scaffolded space.
