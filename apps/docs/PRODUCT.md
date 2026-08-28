# Grove — Product Reference

This document is the source of truth for what Grove actually is, what it ships today, and what is reserved for the roadmap. Every claim here is grounded in the code under `packages/`, `apps/docs/`, and the canonical `apps/example/` application, verified directly against source on 2026-08-28/29.

---

## 1. What Grove is, in one paragraph

Grove is a **framework for building community knowledge directories** powered by structured files. `grove init` installs Grove's component registry into a fresh Astro project (`src/components`, `src/layouts`, `src/lib`, `src/styles`) and generates `grove.config.ts`, `astro.config.mjs`, and `package.json`. You then create your own `data/records/*.yml` files, write your own GitHub Actions (the example app's `.github/` is a working reference, not something the CLI generates for you), and run `grove check` / `astro build`. Every record is a file. Every change is reviewable. The site is static. There is no database, no CMS, no admin dashboard.

The framework supports **one blueprint end-to-end today** — `project-directory`, rendered by the registry's default scaffold. Two other blueprints (`resource-hub`, `ecosystem-map`) exist as Zod schemas only — no scaffold, no routes, no authoring path. Selecting a blueprint is a config edit (`blueprint: "project-directory"` in `grove.config.ts`), not a CLI flag — `grove init` no longer prompts or accepts blueprint/framework/deploy options.

---

## 2. Packages

Grove is a pnpm monorepo. `packages/` contains exactly five packages — confirmed by listing `packages/*/package.json`:

| Package | Version (from `package.json`) | What it does |
| --- | --- | --- |
| `@grove-dev/core` | `1.0.0` | Headless engine: Zod schemas, config loader (`defineConfig`/`loadConfig`), importers, validators, taxonomy/facet logic, GitHub sync + health classification, contributor aggregation, sitemap, `llms.txt`, awesome-list README generator, OG image pipeline, audit budget, and `prepareDirectory()` — the single build pipeline both the CLI and the Astro integration call. Zero framework dependencies. |
| `@grove-dev/cli` | `1.0.0` | The `grove` command. Bootstraps a project from the registry, validates/generates/checks, syncs GitHub metadata and contributors, reports cleanup candidates, promotes filter URLs to curated collections, syncs the packaged icon set, imports awesome lists, generates an awesome-list README, and reconciles an installed scaffold against registry upstream (`grove update`). |
| `@grove-dev/astro` | `1.0.0` | Astro integration + server-side view-models. Ships **zero visual components** — it wires `astro:config:setup` to run `prepareDirectory()` before every dev/build/check, syncs the packaged icon set into `public/icons/`, and re-exports `@grove-dev/core` plus framework-agnostic `lib/` helpers (search, lenses, scores, repo parsing, formatting, taxonomy counts). |
| `@grove-dev/registry` | `1.0.0` | Canonical UI source. Ships one scaffold today, `@grove/default` (`packages/registry/default/`) — components, layouts, `lib/`, and `styles/system.css`. Installed into a consumer's `src/` by `grove init` via `materializeRegistry()`; there is no `@grove-dev/ui` package and no separate template-copy step in the CLI. |
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
| `grove init [directory]` | Install the `@grove/default` registry scaffold into `<directory>/src/`, write `package.json`, `grove.config.ts`, and `astro.config.mjs`, then run `pnpm install` and `git init`. **Does not** scaffold `data/`, `content/`, `public/`, or `.github/` — those are left entirely to you. Options: `--no-install`, `--no-git`. No blueprint/framework/GitHub/deploy flags exist. |
| `grove check` | Validate project data (`validateProject`), run the full generation pipeline (`prepareDirectory`), then run `pnpm exec astro check`. Option: `--strict` (treat warnings as errors). This is the single V1 entry point for validation + generation. |
| `grove sync github` | Enrich each record with live GitHub metadata (stars, forks, pushed date, license, language, topics), with a token-free HTML fallback when the API path fails. Options: `--limit <n>`, `--strict`. |
| `grove sync contributors` | Aggregate contributors across the configured repositories into `data/generated/contributors.json`. |
| `grove cleanup` | Write a report of records that need human review (stale, archived, missing license, etc.) to `data/generated/cleanup-report.json`. Option: `--strict`. |
| `grove audit` | Run Lighthouse against every page in `grove.config.ts`'s `audit.pages[]` and enforce a fixed quality budget. Options: `--base-url`, `--mobile`, `--desktop`, `--runs <n>`, `--page <path>` (repeatable), `--json <path>`, `--junit <path>`. |
| `grove import <source>` | Turn an awesome-list README (GitHub URL, raw URL, or local file) into `data/records/*.yml`, tagged `source: { type: "import" }`. |
| `grove collection promote` | Promote a filter URL (e.g. `/browse?stack=flutter&category=finance`) into a curated `data/collections/<slug>.yml` file. Options: `--from` and `--slug` (required), `--title`, `--description`. |
| `grove icons sync` | Copy the packaged icon set into `public/icons/`. Mostly redundant — `@grove-dev/astro` already syncs icons on every build — but useful for `--force` (restore hand-edited icons) and `--check` (CI drift gate). |
| `grove readme generate` | Render an awesome-list-formatted README between `<!-- grove-readme:start -->`/`<!-- grove-readme:end -->` sentinels from `data/records/*.yml`. Options: `--stdout`, `--path <path>`, `--check`. |
| `grove update` | Reconcile an installed scaffold against the registry upstream — never overwrites locally-modified files. Options: `--check`, `--diff`, `--force`, `--json`. Requires `.grove/registry.lock.json` (written by `grove init`). |

None of these commands existed in earlier documentation of this page under the names `grove validate`, `grove generate`, `grove sitemap`, `grove llms`, `grove build`, `grove dev`, or `grove workflows sync` — those command names **do not exist** in the current CLI. There is also no `grove run` command. Validation, generation, sitemap, and `llms.txt` are folded into `grove check` (and into the Astro integration's automatic pipeline — see §8); `build`/`dev` are plain `astro build`/`astro dev`, invoked as `pnpm build`/`pnpm dev` via the scripts the registry's `registry.json` manifest declares (`dev`: `astro dev`, `build`: `astro build`, `check`: `astro check`).

### `grove init` options

```bash
pnpm dlx @grove-dev/cli@latest init [directory] [--no-install] [--no-git]
```

| Flag | Effect |
| --- | --- |
| `--no-install` | Skip `pnpm install` after scaffolding. |
| `--no-git` | Skip `git init` after scaffolding. |

That is the entire flag surface. Omit `[directory]` to scaffold into the current directory (which must be empty). There is no `--blueprint`, `--framework`, `--github`, `--deploy`, `--template`, `--local`, or `--yes` flag — none of these are defined in `InitOptions` (`packages/cli/src/init.ts`) or in the `init` command's `.option(...)` calls (`packages/cli/src/index.ts`). The scaffolder asks no interactive prompts either; site name, theme, and integrations are all chosen afterward by editing `grove.config.ts` directly.

### GitHub automation and deploy providers — not generated by the CLI

There is no code anywhere in `packages/cli/`, `packages/core/`, or `scripts/` that writes GitHub Actions workflow files, issue templates, or provider-specific deploy config (`vercel.json`, `netlify.toml`, `wrangler.jsonc`). A repo-wide grep for `vercel`, `netlify`, `cloudflare`, `github-pages`, and `deploy-*.yml` turns up nothing in the CLI or scripts — only in `apps/docs/src/content/docs/deployment/*.mdx` (hand-written deployment *guides*, not generator code) and in `apps/example/.github/` itself, which is a **hand-maintained reference implementation**, not output the CLI produced. `apps/example/.github/` currently contains `workflows/{ci,cleanup,deploy,readme,sync-contributors,sync-github}.yml`, `ISSUE_TEMPLATE/{bug_report,feature_request,record_submission}.md`, and `pull_request_template.md` — useful as a starting point to copy by hand, not something `grove init` generates for you.

(Note: `apps/docs/src/content/docs/reference/cli.md` — a docs page, not this file — still claims `grove init` writes `.github/workflows/*`, `data/records/`, `data/taxonomy/`, `data/collections/`, `src/pages/`, and `tsconfig.json`. That page is itself stale relative to `packages/cli/src/init.ts` and should be corrected separately; it is not treated as a source of truth here.)

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

There is no "Astro adapter's default template" shipped from inside `@grove-dev/astro` anymore — `@grove-dev/astro` ships **zero visual components**. The canonical UI source is `packages/registry/default/` (published as `@grove-dev/registry`), and `grove init` installs it into a consumer's `src/` via `materializeRegistry()`. `apps/example/` is the reference implementation — its `src/components/{ui,grove,site}/`, `src/layouts/`, `src/lib/`, and `src/styles/system.css` are a byte-identical mirror of the registry, enforced by `scripts/check-example-mirrors-registry.mjs`.

### What `grove init` actually produces

Confirmed against `packages/cli/src/init.ts` and cross-checked against `apps/docs/src/content/docs/getting-started/scaffold.mdx` (accurate, written from the same source):

```
my-space/
├── astro.config.mjs         # registers @grove-dev/astro + the Tailwind v4 Vite plugin
├── grove.config.ts          # generated fresh — the registry ships no config of its own
├── package.json             # @grove-dev/{core,astro,cli,registry} pinned to the CLI version,
│                             # plus the scaffold's own npm deps/scripts from registry.json
├── .grove/
│   └── registry.lock.json   # install-time per-file hashes — what `grove update` diffs against
└── src/
    ├── components/
    │   ├── ui/               # button, badge, empty-state, filter-drawer, page-header, search-field
    │   ├── grove/             # domain UI — project-card, hero, collection-*, refine-panel, etc.
    │   └── site/              # site chrome — theme-toggle
    ├── layouts/               # base-layout, container, footer, header, section-header, seo
    ├── lib/                   # classnames, icon-kinds, icon-registry — UI-local helpers
    └── styles/
        └── system.css         # design tokens, light/dark theme, Tailwind theme
```

`grove init` explicitly does **not** scaffold `data/`, `content/`, `public/`, or `.github/` — that's stated directly in `init.ts`'s own header comment. You create `data/records/*.yml` yourself (see the getting-started docs), and any GitHub Actions or issue templates are yours to write, optionally starting from `apps/example/.github/` as a reference.

### Components shipped

Counted directly from `packages/registry/default/components/`:

- `components/ui/` — 6 files: `badge`, `button`, `empty-state`, `filter-drawer`, `page-header`, `search-field`.
- `components/grove/` — 32 files, including `hero`, `project-card`, `record-header`, `record-section`, `record-sidebar`, `index-row`, `pagination`, `refine-panel`, `smart-lens-tabs`, `stack-grid`, `category-grid`, `contributors-grid`, `collection-index`/`collection-page`/`collection-card`/`collection-row`/`collection-teaser`, `submission-client`, `filter-group-menu`, `filter-options`, `table-of-contents`, `language-breakdown`, `markdown-body`, `editorial-summary`, `original-collection`, `why-this-exists`, `final-cta`, `powered-by`, `card-grid`, `card-icon`, `icon`, `directory-index-client`.
- `components/site/` — 1 file: `theme-toggle`.
- `layouts/` — 6 files: `base-layout`, `container`, `footer`, `header`, `section-header`, `seo`.

39 components across `ui`/`grove`/`site`, plus 6 layout files — not "22 components + 1 layout under `packages/astro/src/components/`" as earlier documented; that path does not exist. Filenames are kebab-case (`project-card.astro`), not PascalCase.

### Naming

Current naming is `ProjectCard` / `project-card.astro` (kebab-case files). There is **no `ItemCard.astro` exception** — the registry has no file by that name at all. Any prior note claiming `ItemCard.astro` was retained as "the V1 published name" is inaccurate; the current, only name is `ProjectCard`.

### Updating a scaffold

`grove update` reconciles an installed `src/` against the registry's current upstream version, classifying each file as unchanged / locally-modified / upstream-changed / conflicted, and never overwrites a file you've edited. This has no analogue in the earlier template-copy model.

---

## 8. The build pipeline

There is no CLI-driven chain of `grove generate → grove sitemap → grove llms → astro build` — those are not separate commands. Instead, `@grove-dev/core`'s `prepareDirectory()` (`packages/core/src/prepare.ts`) is the single application-facing pipeline, and it runs automatically:

- **`@grove-dev/astro`'s `astro:config:setup` hook** calls `prepareDirectory()` before every `astro dev`, `astro build`, and `astro check` — so a Grove-powered Astro project needs no consumer-owned prebuild script at all. `pnpm dev` and `pnpm build` are literally `astro dev` and `astro build` (per the registry's `registry.json` script manifest).
- **`grove check`** calls `validateProject()`, then `prepareDirectory()`, then `pnpm exec astro check` — useful as an explicit CI gate independent of a full Astro build.

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
