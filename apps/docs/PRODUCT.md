# Grove — Product Reference

This document is the source of truth for what Grove actually is, what it ships today, and what is reserved for the roadmap. Every claim here is grounded in the code under `packages/`, `apps/docs/`, and the canonical `apps/example/` application, verified directly against source on 2026-08-28/29.

---

## 1. What Grove is, in one paragraph

Grove is a **framework for building community knowledge directories** powered by structured files. `grove init` installs Grove's component registry — including its page routes — into a fresh Astro project (`src/components`, `src/layouts`, `src/lib`, `src/styles`, `src/pages`) via the official shadcn CLI, and generates `package.json`, `tsconfig.json`, `components.json` (registering the `@grove` registry), `grove.config.ts`, `astro.config.mjs`, and an empty `data/records/`. The result is a fully routable site (home, browse, record detail, taxonomy, collections, submit, about, 404) with zero records in it. You then create your own `data/records/*.yml` files, write your own GitHub Actions (the example app's `.github/` is a working reference, not something the CLI generates for you), and run `grove check` / `astro build`. Every record is a file. Every change is reviewable. The site is static. There is no database, no CMS, no admin dashboard.

The framework supports **one blueprint end-to-end today** — `project-directory`, rendered by the registry's default scaffold. Two other blueprints (`resource-hub`, `ecosystem-map`) exist as Zod schemas only — no scaffold, no routes, no authoring path. Selecting a blueprint is a config edit (`blueprint: "project-directory"` in `grove.config.ts`), not a CLI flag — `grove init` no longer prompts or accepts blueprint/framework/deploy options.

---

## 2. Packages

Grove is a pnpm monorepo. `packages/` contains exactly five packages — confirmed by listing `packages/*/package.json`:

| Package | Version (from `package.json`) | What it does |
| --- | --- | --- |
| `@grove-dev/core` | `1.0.0` | Headless engine: Zod schemas, config loader (`defineConfig`/`loadConfig`), importers, validators, taxonomy/facet logic, GitHub sync + health classification, contributor aggregation, sitemap, `llms.txt`, awesome-list README generator, OG image pipeline, audit budget, and `prepareDirectory()` — the single build pipeline both the CLI and the Astro integration call. Zero framework dependencies. |
| `@grove-dev/cli` | `1.0.0` | The `grove` command. Bootstraps a project from the registry, validates/generates/checks, syncs GitHub metadata and contributors, reports cleanup candidates, promotes filter URLs to curated collections, syncs the packaged icon set, imports awesome lists, generates an awesome-list README, and reconciles an installed scaffold against registry upstream (`grove update`). |
| `@grove-dev/astro` | `1.0.0` | Astro integration + server-side view-models. Ships **zero visual components** — it wires `astro:config:setup` to run `prepareDirectory()` before every dev/build/check, syncs the packaged icon set into `public/icons/`, and re-exports `@grove-dev/core` plus framework-agnostic `lib/` helpers (search, lenses, scores, repo parsing, formatting, taxonomy counts). |
| `@grove-dev/registry` | `1.0.0` | Canonical UI source, as a shadcn registry (namespace `@grove`). `packages/registry/registry.json` declares 12 feature items (`ui`, `shell`, `project-card`, `taxonomy`, `collections`, `home`, `browse`, `record`, `submit`, `about`, `contributors`, `not-found`); the build generates `default` (all 70 files inlined) and runs the official `shadcn build` into `dist/r/<item>.json`. The package is `private: true` and never published; `dist/r/` reaches consumers through the docs site (`https://withgrove.dev/r/<item>.json`) and through the copy the CLI's build bakes into `packages/cli/dist/r/`. `grove init` installs `default` via `shadcn add`; consumers add or restore single items with `npx shadcn@latest add @grove/<item>`. There is no `@grove-dev/ui` package and no template-copy step in the CLI. |
| `@grove-dev/starlight` | `0.7.0` | Grove's Starlight theme — what `apps/docs` (this documentation site) runs on. Unrelated to the directory-building product surface described in this document. |

`@grove-dev/ui`, `@grove-dev/nextjs`, and `@grove-dev/svelte` **do not exist** in this workspace — no directory under `packages/` for any of them, and no reference to them in any `pnpm-workspace.yaml` or build script. Any prior claim that they exist as skeleton packages is false as of this verification.

Unresolved: `CHANGELOG.md`'s most recent dated entry is `[0.7.0] — 2026-08-21` (packages in lockstep at that version), and `apps/docs/src/content/docs/project/roadmap.md` still describes a `0.6.1`-era package table that predates `@grove-dev/registry` entirely. The three commits that introduced the registry model and rewrote `grove init`/`@grove-dev/astro` landed **after** that changelog entry and bumped `packages/*/package.json` straight to `1.0.0` without a corresponding changelog/roadmap update. This document reports the `package.json` versions as ground truth; the changelog and roadmap page are stale and need a maintainer pass.

---

## 3. The three blueprints

Every Grove space is bound to one of three blueprints, defined in `packages/core/src/schema.ts`. A blueprint pins the record kind and schema. Blueprints are not extensible.

```ts
export const blueprintSchema = z.enum(["project-directory", "resource-hub", "ecosystem-map"]);
export const blueprintKind: Record<Blueprint, ResourceKind> = {
  "project-directory": "project",
  "resource-hub": "resource",
  "ecosystem-map": "entity",
};
```

| Blueprint | Record kind | Status | What it curates |
| --- | --- | --- | --- |
| `project-directory` | `project` | **End-to-end** | Apps, libraries, tools, frameworks, packages. The only blueprint with a scaffold, routes, and a rendered template. |
| `resource-hub` | `resource` | Schema-only | Guides, comparisons, articles, courses, books, podcasts. `resourceRecordSchema` exists and validates, but there is no scaffold, no routes, and no authoring path. |
| `ecosystem-map` | `entity` | Schema-only | Organizations, products, people, communities, schools, services. Same status as `resource-hub`. |

The mapping is 1:1 — each blueprint accepts exactly one record `kind`. There is no `--blueprint` CLI flag: `grove init` always writes `blueprint: "project-directory"` into the generated `grove.config.ts`, and switching blueprints is a manual config edit with no corresponding scaffold to switch to for the other two.

---

## 4. The `Resource` discriminated union

`packages/core/src/schema.ts` defines a generic `Resource` union with three concrete shapes. The table below reflects the schema as of this verification; fields marked "new" were not documented in earlier versions of this page.

| Shape | Required fields | Notable optional fields |
| --- | --- | --- |
| `ProjectRecord` | `kind: "project"`, `slug`, `name` | `description`, `summary`/`sourceDescription` (curator-written lead vs. GitHub-sourced description), `category`, `tags[]`, `links{ github?, website?, docs?, source? }`, `repoUrl`, `logoUrl`, `screenshots[]`, `licenses[]` (SPDX ids), `difficulty`, `codebaseSize`, `stack`, `stacks[]`, `platforms[]`, `projectType`, `bestFor[]`, `whyListed[]`, `caveats[]`, `distribution.channels[]`, `scores{}`, `curation{}`, `health{}`, `github{}`, `content` (path to Markdown body), `visibility` |
| `ResourceRecord` | `kind: "resource"`, `slug`, `title`, `type`, `topic` | `description`, `tags`, `author`, `publishedAt`, `related[]`, `links{}`, `curation{}`, `source{}`, `visibility` |
| `EntityRecord` | `kind: "entity"`, `slug`, `name`, `type` | `description`, `founded`, `location`, `members`, `parent`, `tags[]`, `links{}`, `curation{}`, `visibility` |

Common base on every record (`resourceBaseSchema`): `slug`, `description`, `summary`, `sourceDescription`, `category` (defaults to `"uncategorized"`), `tags[]`, `links{}`, optional `content`, `source` (provenance: `manual`/`github-topic`/`awesome-list`/`submit`/`import`), `curation` (human-curation block with `reviewed`, `reviewedBy`, `reviewedAt`, `notes`, `labels[]`, `lenses[]`), `scores{}`, `visibility` (effective visibility after any `decisions.yml` override).

A consumer-facing index projection (`IndexRecord`, produced by `toIndexRecord()`) is the slim shape used by list pages — it strips heavy blueprint-specific fields down to what the renderer needs for cards and filter chips.

---

## 5. CLI command surface

The full command surface, read directly from `packages/cli/src/index.ts` and its per-command modules (`init.ts`, `audit-cli.ts`, `collection-cli.ts`, `icons-cli.ts`, `import-cli.ts`, `readme-cli.ts`, `update.ts`):

| Command | What it does |
| --- | --- |
| `grove init [directory]` | Write `package.json` (scripts `dev`/`build`/`check`), `tsconfig.json`, `components.json` (`"registries": { "@grove": "https://withgrove.dev/r/{name}.json" }`), `grove.config.ts`, `astro.config.mjs`, an empty `data/records/`, and — for pnpm projects only — `pnpm-workspace.yaml` (approves esbuild's install script; pnpm 11 fails any install that skipped one); run `<pm> dlx shadcn@4.19.0 add <bundled default.json> --yes` to install the `@grove/default` item into `src/` (the built item ships inside the CLI tarball, so this needs no registry request; shadcn installs the scaffold's npm deps — astro, tailwindcss, `@tailwindcss/vite`, `@astrojs/check`), falling back to writing the bundled item in-process if shadcn fails; add `@grove-dev/{core,astro,cli}` pinned to the CLI version; write `.grove/registry.lock.json`; then `<pm> install` and `git init`. The package manager is detected, not assumed — `packageManager` field, then lockfile, then the `npm_config_user_agent` of whatever launched the command, then the first of pnpm/npm/yarn/bun on PATH — and recorded as `packageManager` in the generated package.json (which is also the only signal shadcn's own detector can read in a fresh directory). Steps after the empty-directory check are transactional — a failure removes the partial scaffold so the retry is just `grove init`. **Does not** scaffold `content/`, `public/`, or `.github/` — those are left entirely to you. Options: `--no-install` (skips Grove's own `<pm> install`; shadcn still installs the scaffold's deps), `--no-git`. No blueprint/framework/GitHub/deploy flags exist. |
| `grove check` | Validate project data (`validateProject`), run the full generation pipeline (`prepareDirectory`), then run the project's own `node_modules/.bin/astro check` — no package manager is spawned, so this works in a project installed with any of them. Option: `--strict` (treat warnings as errors). This is the single V1 entry point for validation + generation. |
| `grove sync github` | Enrich each record with live GitHub metadata (stars, forks, pushed date, license, language, topics), with a token-free HTML fallback when the API path fails. Options: `--limit <n>`, `--strict`. |
| `grove sync contributors` | Aggregate contributors across the configured repositories into `data/generated/contributors.json`. |
| `grove cleanup` | Write a report of records that need human review (stale, archived, missing license, etc.) to `data/generated/cleanup-report.json`. Option: `--strict`. |
| `grove audit` | Run Lighthouse against every page in `grove.config.ts`'s `audit.pages[]` and enforce a fixed quality budget. Options: `--base-url`, `--mobile`, `--desktop`, `--runs <n>`, `--page <path>` (repeatable), `--json <path>`, `--junit <path>`. |
| `grove import <source>` | Turn an awesome-list README (GitHub URL, raw URL, or local file) into `data/records/*.yml`, tagged `source: { type: "import" }`. |
| `grove collection promote` | Promote a filter URL (e.g. `/browse?stack=flutter&category=finance`) into a curated `data/collections/<slug>.yml` file. Options: `--from` and `--slug` (required), `--title`, `--description`. |
| `grove icons sync` | Copy the packaged icon set into `public/icons/`. Mostly redundant — `@grove-dev/astro` already syncs icons on every build — but useful for `--force` (restore hand-edited icons) and `--check` (CI drift gate). |
| `grove readme generate` | Render an awesome-list-formatted README between `<!-- grove-readme:start -->`/`<!-- grove-readme:end -->` sentinels from `data/records/*.yml`. Options: `--stdout`, `--path <path>`, `--check`. |
| `grove update` | Fetch `@grove/default` from the registry URL in `components.json` (or `--from <path-or-url>`; falls back to the copy bundled with the CLI) and reconcile the installed `src/` against it with a three-way diff (installed / lock / registry), classifying each file as unchanged, upstream_changed, new, locally_modified, conflict, or removed. Applies the safe changes, never overwrites locally-modified files, refreshes the lock. Options: `--check`, `--diff`, `--force`, `--json`, `--from`. Requires `.grove/registry.lock.json` (written by `grove init`). |

None of these commands existed in earlier documentation of this page under the names `grove validate`, `grove generate`, `grove sitemap`, `grove llms`, `grove build`, `grove dev`, or `grove workflows sync` — those command names **do not exist** in the current CLI. There is also no `grove run` command. Validation, generation, sitemap, and `llms.txt` are folded into `grove check` (and into the Astro integration's automatic pipeline — see §8); `build`/`dev` are plain `astro build`/`astro dev`, invoked as `pnpm build`/`pnpm dev` via the scripts the registry's `registry.json` manifest declares (`dev`: `astro dev`, `build`: `astro build`, `check`: `astro check`).

### `grove init` options

```bash
pnpm dlx @grove-dev/cli@latest init [directory] [--no-install] [--no-git]
```

| Flag | Effect |
| --- | --- |
| `--no-install` | Skip the `<pm> install` after scaffolding. |
| `--no-git` | Skip `git init` after scaffolding. |

That is the entire flag surface. Omit `[directory]` to scaffold into the current directory (which must be empty). There is no `--blueprint`, `--framework`, `--github`, `--deploy`, `--template`, `--local`, or `--yes` flag — none of these are defined in `InitOptions` (`packages/cli/src/init.ts`) or in the `init` command's `.option(...)` calls (`packages/cli/src/index.ts`). The scaffolder asks no interactive prompts either; site name, theme, and integrations are all chosen afterward by editing `grove.config.ts` directly.

### GitHub automation and deploy providers — not generated by the CLI

There is no code anywhere in `packages/cli/`, `packages/core/`, or `scripts/` that writes GitHub Actions workflow files, issue templates, or provider-specific deploy config (`vercel.json`, `netlify.toml`, `wrangler.jsonc`). A repo-wide grep for `vercel`, `netlify`, `cloudflare`, `github-pages`, and `deploy-*.yml` turns up nothing in the CLI or scripts — only in `apps/docs/src/content/docs/deployment/*.mdx` (hand-written deployment *guides*, not generator code) and in `apps/example/.github/` itself, which is a **hand-maintained reference implementation**, not output the CLI produced. `apps/example/.github/` currently contains `workflows/{ci,cleanup,deploy,readme,sync-contributors,sync-github}.yml`, `ISSUE_TEMPLATE/{bug_report,feature_request,record_submission}.md`, and `pull_request_template.md` — useful as a starting point to copy by hand, not something `grove init` generates for you.

(Note: `apps/docs/src/content/docs/reference/cli.md`'s `grove init` and `grove update` entries were rewritten against this model on 2026-08-29. Its `grove check` and `grove sync contributors` entries still refer to workflows "the scaffolder generates" and remain stale.)

---

## 6. Configuration: `grove.config.ts`

`grove.config.ts` is the single source of truth for a Grove space's site metadata, integrations, and theme. It is loaded by the CLI and the Astro integration via `jiti` (TypeScript, no build step) and validated by `groveConfigSchema` (`packages/core/src/schema.ts`).

```ts
import { defineConfig } from "@grove-dev/core";

export default defineConfig({
  blueprint: "project-directory",

  site: {
    name: "Open Apps",
    tagline: "Production-ready open-source applications.",
    description: "A curated, health-aware directory of open-source apps.",
    url: "https://openapps.example.com",
    repoUrl: "https://github.com/example/open-apps",
    logo: "/logo.svg",        // optional, path under public/
    favicon: "/favicon.svg",  // optional
    locale: "en",
    twitter: "@example",      // optional
  },

  nav: [
    { label: "Home", href: "/" },
    { label: "Browse", href: "/projects" },
    { label: "About", href: "/about" },
  ],

  footer: {
    columns: [
      { heading: "Discover", items: [{ label: "Browse", href: "/projects" }] },
    ],
    poweredBy: true, // "Powered by Grove" — on by default
  },

  submission: {
    title: "Add a project",
    good: ["A usable open-source project with a clear license"],
    avoid: ["Marketing-only landing pages"],
  },

  // Canonical facet ids only — a typo fails config parsing.
  browse: {
    facets: ["category", "stack", "platform", "tags", "license"],
  },

  integrations: {
    github: { metadata: true, contributors: true, health: true },
  },

  theme: {
    radius: "soft",
    density: "comfortable",
    containerWidth: "72rem",
    // primaryColor unset — neutral ink treatment (near-black on light,
    // near-white on dark) instead of an injected hue
  },

  audit: {
    baseUrl: "http://127.0.0.1:4321",
    pages: [{ path: "/", type: "home", label: "Homepage" }],
  },

  readme: {
    title: "Awesome Open-Source Apps",
    intro: "## Why this list\n\nEach tool is actively maintained.",
  },

  paths: {
    dataDir: "data",
    contentDir: "content",
    recordsDir: "data/records",
    pagesDir: "content/pages",
    bodiesDir: "content/records",
    publicDir: "public",
    taxonomyDir: "data/taxonomy",
    generatedDir: "data/generated",
    health: "data/health.yml",
    decisions: "data/decisions.yml",
    overrides: "data/overrides.yml",
  },
});
```

| Field | Type | Default | What it controls |
| --- | --- | --- | --- |
| `blueprint` | enum | `project-directory` | The record kind and schema this space accepts. No CLI flag switches this — edit the file. |
| `site` | object | (required) | Brand: name, tagline, description, canonical URL, repo URL, logo, favicon, locale, Twitter handle. |
| `analytics.googleAnalyticsId` | string (GA4 id) | unset | Optional GA4 measurement id. |
| `nav` | array | `[]` | Top navigation. Each item is `{ label, href }`. |
| `footer` | object | `{ columns: [], poweredBy: true }` | Up to 3 footer columns, copyright/license text, and the "Powered by Grove" toggle. |
| `submission` | object | `{ good: [], avoid: [] }` | Copy for the `/submit` flow — eyebrow, title, description, do/avoid lists. |
| `routes` | object | `{}` | Optional URL slug overrides (`directory`, `item`) — default routes derive from the blueprint id. |
| `labels` | object | `{}` | Optional singular/plural noun overrides for a blueprint's default labels. |
| `browse.facets` | array of canonical ids | `["category", "tags"]` | Which browse/filter dimensions the site exposes, and in what order. Only `category`, `stack`, `platform`, `tags`, `license` (the `FACET_IDS` in `packages/core/src/directory-facets.ts`) validate — plurals like `stacks`/`platforms` are **not** accepted here (though they're tolerated as aliases at the display layer). A bare top-level `facets` key (the old location) fails config parsing with a pointed migration message. |
| `integrations.github` | boolean \| object | `false` | `true` enables all three sub-flags; an object lets you enable `metadata`, `contributors`, `health` independently. |
| `theme` | object | `{ radius: "soft", density: "comfortable", containerWidth: "72rem" }` | `primaryColor` (optional hex), `radius` (`none`\|`soft`\|`round`), `density` (`compact`\|`comfortable`\|`spacious`), `containerWidth`. Consumed by `src/styles/system.css`. |
| `contributors.showContributionCount` | boolean | `true` | Whether contributor tiles show a per-user commit/PR count. |
| `audit` | object, optional | unset | Lighthouse page manifest consumed by `grove audit`. |
| `readme` | object, optional | unset | Overrides for the `grove readme generate` preamble. |
| `paths` | object | sensible defaults (shown above) | Filesystem layout. Every field has a default; override only what you need. |

There is **no `components` field** in the config schema. Component customization is purely file-based: `grove init` copies the registry scaffold into `src/components/{ui,grove,site}/`, and you edit those `.astro` files directly — there is no config-driven component-override mechanism (no `components: { Header: ..., ItemCard: ... }` block exists in `groveConfigSchema`, and none is read anywhere in `packages/core` or `packages/astro`).

`defineConfig` provides TypeScript autocomplete and Zod validation — misspelled fields fail at config-load time.

---

## 7. The registry model

There is no "Astro adapter's default template" shipped from inside `@grove-dev/astro` anymore — `@grove-dev/astro` ships **zero visual components**. The canonical UI source is `packages/registry/` (published as `@grove-dev/registry`), a real shadcn registry under the `@grove` namespace, and `grove init` installs it into a consumer's `src/` through the standard shadcn CLI. `apps/example/` is the reference consumer — `scripts/check-example-mirrors-registry.mjs` verifies every file of the `default` item exists at its target under `apps/example` with identical bytes.

**The manifest.** `packages/registry/registry.json` is hand-authored in the official shadcn schema (`https://ui.shadcn.com/schema/registry.json`). It declares 12 feature-level items, each with a title, description, its files (explicit `type` and `target`, always `~/src/<path>`), and `registryDependencies` on the other `@grove/*` items it imports from.

**The source layout.** Item sources live under `packages/registry/default/`, laid out exactly like a consumer's `src/` (`components/{ui,grove,site}`, `layouts`, `lib`, `pages`, `styles`). This is a deliberate departure from a typical shadcn registry, which groups source per item and imports through `@/` aliases: Grove's `.astro` files use relative imports, so the layout *is* the import contract and every file type-checks in place. `.astro` files are never transformed by the shadcn CLI, so they use semantic types (`registry:page`, `registry:component`, `registry:ui`); `.ts` and `.css` files must be `registry:file`, because the CLI runs other types through ts-morph transformers that strip comments and reformat, and `grove update` hashes installed files, so they must land byte-identical.

**The build.** `pnpm registry:build` (`scripts/build-registry.mjs`) first validates `registry.json` against the source tree — every file under `default/` belongs to exactly one item (or is listed as default-only; currently just `pages/empty.astro`, the audit empty-state fixture); each item's `registryDependencies` exactly equals what its files' relative imports imply; file types and targets follow the rules above; nothing imports the removed `@grove-dev/astro/{components,ui,layouts}` subpaths. It then generates the `default` item (all 70 files inlined, so a scaffold installs in one step with no registry lookups), stamps every item with `meta.version` from the package version, and runs the official `shadcn build` (shadcn 4.19.0, a devDependency) to produce `packages/registry/dist/r/<item>.json` plus a `registry.json` index. `pnpm registry:check` runs the validation alone.

**Hosting.** `@grove-dev/registry` is `private: true` and is never published (`scripts/release.mjs` publishes only `@grove-dev/{core,astro,cli,starlight}`); its `dist/r/` reaches consumers through the docs site and through the copy baked into the CLI tarball (`packages/cli/dist/r/`). The docs site copies `dist/r` into `apps/docs/public/r/` before each build (`scripts/sync-registry-public.mjs`), so items are served at `https://withgrove.dev/r/<item>.json`. A consumer's `components.json` contains `"registries": { "@grove": "https://withgrove.dev/r/{name}.json" }`, so `npx shadcn@latest add @grove/browse` installs the browse item and its `@grove/*` dependencies, `npx shadcn@latest add @grove/project-card --overwrite` restores one item's files to upstream, and `npx shadcn@latest view @grove/home` previews. No React and no `shadcn init` are needed — a bare Astro project with `components.json` and a tsconfig `@/*` path alias is enough.

### What `grove init` actually produces

```
my-space/
├── astro.config.mjs         # registers @grove-dev/astro + the Tailwind v4 Vite plugin
├── grove.config.ts          # generated fresh — the registry ships no config of its own
├── components.json          # "registries": { "@grove": "https://withgrove.dev/r/{name}.json" }
├── tsconfig.json            # Astro base config + the @/* path alias the shadcn CLI expects
├── package.json             # scripts dev/build/check; @grove-dev/{core,astro,cli,registry} pinned to
│                             # the CLI version, plus the scaffold's own deps installed by shadcn
├── data/
│   └── records/             # empty — your YAML records go here
├── .grove/
│   └── registry.lock.json   # scaffold @grove/default, version, per-file sha256 — what `grove update` diffs against
└── src/
    ├── components/
    │   ├── ui/               # button, badge, empty-state, filter-drawer, page-header, search-field
    │   ├── grove/             # domain UI + page-level compositions — project-card, hero, directory-browse, taxonomy-list, etc.
    │   └── site/              # site chrome — theme-toggle
    ├── layouts/               # base-layout, container, footer, header, section-header, seo
    ├── pages/                 # home, browse, record detail, taxonomy, collections, submit, about, contributors, 404
    ├── lib/                   # classnames, icon-kinds, icon-registry — UI-local helpers
    └── styles/
        └── system.css         # design tokens, light/dark theme, Tailwind theme
```

`grove init` runs `<pm> dlx shadcn@4.19.0 add <bundled default.json> --yes` (`pnpm dlx`, `bunx`, `yarn dlx` on Berry, `npm exec --yes`, or `npx` for Yarn Classic) — the CLI's build copies the built registry into `packages/cli/dist/r/`, so the `default` item ships with it and a fresh scaffold needs no registry request. shadcn itself installs the scaffold's npm deps (astro, tailwindcss, `@tailwindcss/vite`, `@astrojs/check`) with real version ranges. The lock records targets project-relative (`src/components/ui/button.astro`).

`pages/` is registry-shipped like everything else here — `grove init` produces a fully routable site from a single install step, not a component library with no routes. Two of the `grove/` files are page-level composition components, not reusable UI: `directory-browse.astro` (browse-page body, shared by the paginated and unfiltered routes) and `taxonomy-list.astro` (shared body for the three taxonomy pages) exist only to be imported by `pages/`, not by other components.

`grove init` does **not** scaffold `content/`, `public/`, or `.github/`. `data/records/` is created empty; any GitHub Actions or issue templates are yours to write, optionally starting from `apps/example/.github/` as a reference.

### Items shipped

From `packages/registry/registry.json`:

| Item | Type | Depends on | Ships |
| --- | --- | --- | --- |
| `ui` | `registry:ui` | — | 6 primitives (`badge`, `button`, `empty-state`, `filter-drawer`, `page-header`, `search-field`) + `lib/classnames.ts` |
| `shell` | `registry:block` | `ui` | 6 layouts (`base-layout`, `container`, `footer`, `header`, `section-header`, `seo`), `theme-toggle`, `powered-by`, `styles/system.css`; declares the npm deps `astro`, `@astrojs/check`, `tailwindcss`, `@tailwindcss/vite` |
| `project-card` | `registry:block` | — | `project-card`, `card-grid`, `card-icon`, `icon`, `lib/icon-kinds.ts`, `lib/icon-registry.ts` |
| `taxonomy` | `registry:block` | `shell`, `project-card`, `ui` | `categories/{index,[name]}`, `stacks/{index,[name]}`, `licenses/[name]`, `taxonomy-list`, `stack-grid`, `category-grid` |
| `collections` | `registry:block` | `shell`, `project-card`, `ui` | `collections/{index,[slug]}`, `collection-index`, `collection-page`, `collection-card`, `collection-row`, `collection-teaser` |
| `home` | `registry:block` | `shell`, `project-card`, `ui`, `taxonomy`, `collections` | `index`, `hero`, `why-this-exists`, `pipeline-strip`, `record-section`, `contributors-grid`, `original-collection`, `final-cta` |
| `browse` | `registry:block` | `shell`, `project-card`, `ui` | `[slug]/index`, `[slug]/page/{[page],cards,records.json.ts}`, `directory-browse`, `directory-index-client`, `refine-panel`, `filter-group-menu`, `filter-options`, `pagination`, `smart-lens-tabs`, `index-row` |
| `record` | `registry:block` | `shell`, `project-card`, `ui` | `[slug]/[recordSlug]`, `record-header`, `record-sidebar`, `editorial-summary`, `table-of-contents`, `markdown-body`, `language-breakdown` |
| `submit` | `registry:block` | `shell`, `ui` | `submit`, `submission-client` |
| `about` | `registry:block` | `shell`, `ui` | `about` |
| `contributors` | `registry:block` | `shell`, `ui` | `contributors` |
| `not-found` | `registry:block` | `shell`, `ui` | `404` |
| `default` | `registry:block` (generated) | — | every file of every item above plus `pages/empty.astro`, 70 files inlined |

Filenames are kebab-case (`project-card.astro`), not PascalCase.

### Naming

Current naming is `ProjectCard` / `project-card.astro` (kebab-case files). There is **no `ItemCard.astro` exception** — the registry has no file by that name at all. Any prior note claiming `ItemCard.astro` was retained as "the V1 published name" is inaccurate; the current, only name is `ProjectCard`.

### Updating a scaffold

Two paths, for two jobs:

- **Reset or add a single item** with the standard shadcn CLI: `npx shadcn@latest add @grove/<item>` installs an item and its `@grove/*` dependencies; `--overwrite` puts one item's files back to upstream. shadcn's only answer to an existing, differing file is a yes/no overwrite prompt.
- **Keep the whole site current** with `grove update`. It fetches `@grove/default` from the registry URL in `components.json` (or `--from <path-or-url>`; falls back to the bundled copy) and runs a three-way classification per file — installed / lock / registry — into unchanged, upstream_changed, new, locally_modified, conflict, or removed. Safe changes are applied, locally modified files are never overwritten, and the lock is refreshed. This is Grove's value-add over plain `shadcn add`.

---

## 8. The build pipeline

There is no CLI-driven chain of `grove generate → grove sitemap → grove llms → astro build` — those are not separate commands. Instead, `@grove-dev/core`'s `prepareDirectory()` (`packages/core/src/prepare.ts`) is the single application-facing pipeline, and it runs automatically:

- **`@grove-dev/astro`'s `astro:config:setup` hook** calls `prepareDirectory()` before every `astro dev`, `astro build`, and `astro check` — so a Grove-powered Astro project needs no consumer-owned prebuild script at all. `pnpm dev` and `pnpm build` are literally `astro dev` and `astro build` (per the registry's `registry.json` script manifest).
- **`grove check`** calls `validateProject()`, then `prepareDirectory()`, then the project's local `astro check` — useful as an explicit CI gate independent of a full Astro build.

`prepareDirectory()` does, in one pass: `generate()` → `data/generated/records.{full,index}.json` (+ `records.json` alias) and `site-config.json`; `buildSitemap()` → `public/sitemap.xml`; `buildLlmsFiles()` → `public/llms.txt` + `public/llms-full.txt`; `buildSiteArtifacts()` → `public/robots.txt` + `public/og-image.svg` (while Grove still owns them — editing away the marker line takes ownership permanently); and `buildOgImages()` → per-page PNG social cards under `public/og/**` (via Satori + resvg).

```
data/records/<slug>.yml
   │
   │  prepareDirectory()  — generate, sitemap, llms.txt, site artifacts, OG images
   │  (invoked automatically by the Astro integration, or explicitly by `grove check`)
   ▼
data/generated/records.{full,index,json}.json, site-config.json
public/sitemap.xml, llms.txt, llms-full.txt, robots.txt, og-image.svg, og/**
   │
   │  astro build   (consumes records.index.json, renders static pages)
   ▼
dist/   (deployable static site)
```

`records.full.json` carries every record, every field. `records.index.json` is the slim visible-only projection used by list pages. `records.json` is an alias for `records.full.json`.

---

## 9. GitHub automation

Grove ships GitHub-metadata *sync logic* (`grove sync github`, `grove sync contributors`, both callable manually or from a workflow you write) — but it does **not** generate the GitHub Actions workflow files or issue templates that invoke them. There is no `grove workflows sync` command, and no code path anywhere in `packages/cli/` or `packages/core/` writes `.yml` files under `.github/`.

`apps/example/.github/` is a working, hand-maintained reference you can copy from:

| File (in `apps/example/.github/`) | What it does there |
| --- | --- |
| `workflows/ci.yml` | Runs on PRs — presumably `grove check` and similar (a real project should adapt this, not assume it's what `grove init` would produce, since `grove init` produces no `.github/` at all). |
| `workflows/deploy.yml` | Builds and deploys to GitHub Pages via `actions/deploy-pages@v4` on push to `main`. |
| `workflows/sync-github.yml`, `workflows/sync-contributors.yml` | Scheduled/manual GitHub metadata + contributor sync. |
| `workflows/cleanup.yml`, `workflows/readme.yml` | Scheduled cleanup report and README regeneration. |
| `ISSUE_TEMPLATE/{bug_report,feature_request,record_submission}.md`, `pull_request_template.md` | Contribution tooling for a public directory. |

Treat these as a starting point to copy into your own repo, not as CLI output.

---

## 10. The `llms.txt` output

Confirmed against `packages/core/src/llms.ts`. Grove writes two files as part of `prepareDirectory()`:

- **`public/llms.txt`** — a short, fixed-size site header: site name, description/tagline, the directory URL, a count of indexed (visible) records, and a count of distinct categories, plus a one-line "Usage" pointer to `llms-full.txt`. It does **not** enumerate top categories or key links beyond the directory URL itself.
- **`public/llms-full.txt`** — an index line per visible record (`- [name](#slug) — category · stack · ★stars — description`) followed by a detail section per record (slug, category, stack, stars, license, repo, homepage, last-commit/added dates, and an optional `#### Detail` block sourced from the record's Markdown sidecar).

Both files are regenerated on every build (dev, build, and `grove check` all call `prepareDirectory()`). This remains a secondary feature — the directory itself is the headline.

---

## 11. Health signals

Every `project` record can carry a `health:` block (`healthBlockSchema` in `packages/core/src/schema.ts`):

```yaml
health:
  status: active # active | mature | stale | inactive | archived | unknown | historical | needs_review | quiet | unavailable
  tier: curated  # curated | listed | experimental | hidden
  maturity: mature      # experimental | useful | mature | unknown
  visibility: keep       # highlight | keep | needs_review | hide | remove | historical
  cleanupCandidate: false
  confidence: medium     # low | medium | high
  reasons: []
```

Both enums in the earlier version of this document (`status` and the `decisions.yml` visibility values) are still accurate — `healthStatusSchema` and `decisionVisibilitySchema` match exactly. `grove sync github` derives `status` from live repository metadata (stars, last push, archive state) via `classifyHealth()`. `data/decisions.yml` is the human curation layer: each entry is `{ id, decision: { visibility, reason, reviewedBy?, reviewedAt? } }`, and its `visibility` overrides both the record's own field and any health-derived value.

---

## 12. Contribution workflow

Grove ships no contribution-tooling generator. A public directory typically follows `apps/example/.github/`'s pattern by hand:

- An issue template for "Submit a record" (mirroring the record schema's fields).
- A `/submit` page rendering a form that opens a pre-filled GitHub issue (`components/grove/submission-client.astro` in the registry provides this UI piece).
- A PR template for record additions.
- Maintainers turn accepted submissions into PRs against `data/records/<slug>.yml`; `grove check` (run in CI, by hand) catches schema errors before merge.

None of this is CLI-generated — see §5 and §9.

---

## 13. Theming

`theme.primaryColor` (optional), `theme.radius`, `theme.density`, and `theme.containerWidth` are consumed by the registry's `src/styles/system.css` as CSS custom properties. Tailwind v4 is wired in by default (`astro.config.mjs` registers `@tailwindcss/vite`; the scaffold's styles import `tailwindcss` directly) — it is not an opt-in add-on in the current scaffold.

There is no `components.*` config override. To customize a component, edit its file directly under `src/components/` — the file *is* the customization; there is no override-by-path config field (see §6).

---

## 14. What Grove is not

These are explicit non-goals. Each item has been considered and rejected:

- **A CMS.** There is no WYSIWYG editor. Records are YAML files edited in a text editor.
- **A database application.** Data lives in files.
- **A hosted SaaS.** The framework repo is not a marketing site; there is no grove.com.
- **A plugin marketplace.** The engine is small enough to fork.
- **A real-time collaboration layer.** Pull requests are the collaboration layer.
- **Auth, paywalls, private spaces.** Every space is public.
- **Replacing awesome lists.** Grove runs alongside them, not against them.
- **Tying the data model to GitHub.** GitHub is one optional signal, not the spine.

---

## 15. Spaces built with Grove

One production space ships today:

- **[Open Apps](https://github.com/tortuvshin/open-apps)** (separate repository) — production-ready open-source app directory. The reference implementation of the `project-directory` blueprint with the Astro adapter.

Each space is its own repository, with its own data, branding, and community rules. Grove is the shared engine underneath. (This is an external, unverified-from-this-repo claim, left as-is per scope.)

---

## 16. Version and roadmap status

**Versions** (read directly from `packages/*/package.json`, 2026-08-28/29): `@grove-dev/core`, `@grove-dev/cli`, `@grove-dev/astro`, and `@grove-dev/registry` are all `1.0.0`. `@grove-dev/starlight` is `0.7.0`. This is inconsistent with `CHANGELOG.md` (latest dated entry: `0.7.0`, 2026-08-21) and with `apps/docs/src/content/docs/project/roadmap.md` (still describes a 4-package, `0.6.1`-era world with no `@grove-dev/registry`) — both predate the registry-model rewrite. **This is a real gap, not something this document can resolve**: the code has moved to a `1.0.0`-labeled registry architecture; the changelog and roadmap page have not caught up. Treat both as needing a maintainer pass rather than as current.

**Roadmap:** the roadmap page linked from earlier versions of this document (`/roadmap/`) exists at `apps/docs/src/content/docs/project/roadmap.md`, but — per the versioning gap above — its "Shipped" package table and wave-status framing predate the registry rewrite and should not be treated as a reliable snapshot of the current architecture. Its CLI command list, however, does match the current `packages/cli/src/index.ts` command surface (`init`, `check`, `sync github`/`sync contributors`, `cleanup`, `audit`, `import`, `collection promote`, `icons sync`, `readme generate`) — that part is corroborated by source and was used to help verify §5 of this document. Beyond that specific cross-check, this document does not assert a wave-by-wave roadmap status; that requires a maintainer decision, not an inference from code.
