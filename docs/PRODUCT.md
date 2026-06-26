# Grove — Product Reference

This document is the source of truth for what Grove actually is, what it ships today, and what is reserved for the roadmap. Every claim here is grounded in the code under `packages/`, `docs/`, and the `packages/astro/templates/default/` template.

---

## 1. What Grove is, in one paragraph

Grove is a **framework for building community knowledge directories** powered by structured files and GitHub automation. You start with a working Astro site, a `grove.config.ts`, and a folder of YAML records. You add records by hand or by import, you push a pull request, and Grove's GitHub Actions validate the data, refresh GitHub metadata, build the static site, and deploy it. Every record is a file. Every change is reviewable. The site is static. There is no database, no CMS, no admin dashboard.

The framework supports **one template end-to-end today** — `project-directory`, rendered with the Astro adapter. Two other blueprints (`resource-hub`, `ecosystem-map`) ship schemas and CLI support but no polished default template yet.

---

## 2. Packages

Grove is a pnpm monorepo. Six published packages:

| Package             | Status          | What it does                                                                                                                                                                                                                                                            |
| ------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@grove-dev/core`   | V1 stable       | Headless engine: Zod schemas, config loader, importers, validators, taxonomy types, optional GitHub signal sync, sitemap, `llms.txt`, build pipeline. Zero framework dependencies.                                                                                      |
| `@grove-dev/ui`     | V1 stable       | Framework-agnostic UI primitives. 5 typed modules over the `IndexRecord` discriminated union: `filterRecords`, `sortRecords`, `paginateRecords`, `scoreRecords`, `format`. Pure TypeScript, no Astro/React/Svelte. Re-exported by every adapter.                        |
| `@grove-dev/cli`    | V1 stable       | The `grove` command. Scaffolds projects, validates data, generates build artifacts, syncs GitHub metadata, cleans up stale records, writes workflows and issue templates. Spawns the framework's `dev` / `build` commands. No framework dependencies in the CLI itself. |
| `@grove-dev/astro`  | V1 supported    | The only V1 framework adapter. Ships 22 components, 1 layout, design tokens, and `templates/default/`. The template contains pages, layouts, public assets, `astro.config.mjs`, scripts, and `.github/`. No business logic.                                             |
| `@grove-dev/nextjs` | Skeleton (V1.2) | Package exists; the V1 CLI refuses `--framework nextjs`.                                                                                                                                                                                                                |
| `@grove-dev/svelte` | Skeleton (V1.1) | Package exists; the V1 CLI refuses `--framework svelte`.                                                                                                                                                                                                                |

---

## 3. The three blueprints

Every Grove space is bound to one of three blueprints. A blueprint pins the record kind, the schema, and the route slug. Blueprints are not extensible in V1.

| Blueprint           | Record kind | V1 status      | What it curates                                                                                                                                                               |
| ------------------- | ----------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project-directory` | `project`   | **End-to-end** | Apps, libraries, tools, frameworks, packages. GitHub metadata is optional but supported. Default Astro template renders a polished directory.                                 |
| `resource-hub`      | `resource`  | Schema-ready   | Guides, comparisons, articles, courses, books, podcasts. `grove generate` produces the JSON; the V1 Astro template does not yet render polished pages for `resource` records. |
| `ecosystem-map`     | `entity`    | Schema-ready   | Organizations, products, people, communities, schools, services. Same data status as `resource-hub`.                                                                          |

The mapping is 1:1 — each blueprint accepts exactly one record `kind`, and `grove validate` rejects mismatches. The mapping is enforced by `blueprintKind` in `packages/core/src/schema.ts`:

```ts
export const blueprintKind: Record<Blueprint, ResourceKind> = {
  'project-directory': 'project',
  'resource-hub': 'resource',
  'ecosystem-map': 'entity',
};
```

Picking the right blueprint is about the **unit of curation**, not the topic:

- "I am curating a list of open-source apps" → `project-directory`
- "I am curating a list of guides and articles" → `resource-hub`
- "I am curating a list of companies and communities" → `ecosystem-map`

---

## 4. The `Resource` discriminated union

`packages/core/src/schema.ts` defines a generic `Resource` union with three concrete shapes:

| Shape            | Required fields                                    | Optional fields                                                                                                                                                                                                                                                                           |
| ---------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProjectRecord`  | `kind: "project"`, `slug`, `name`, `description`   | `category`, `tags[]`, `links{ github?, website?, docs?, source? }`, `repoUrl`, `stack`, `stacks[]`, `platforms[]`, `projectType`, `bestFor[]`, `whyListed[]`, `caveats[]`, `distribution.channels[]`, `scores{}`, `curation{}`, `health{}`, `github{}`, `content` (path to Markdown body) |
| `ResourceRecord` | `kind: "resource"`, `slug`, `title`, `description` | `type` (guide/comparison/link/explainer/tool/video/article/course/book/podcast/other), `topic`, `tags[]`, `author`, `publishedAt`, `related[]`, `links{}`, `curation{}`, `source{}`                                                                                                       |
| `EntityRecord`   | `kind: "entity"`, `slug`, `name`, `description`    | `type` (company/organization/community/school/university/research-lab/agency/service/product/person/other), `founded`, `location`, `members`, `parent`, `tags[]`, `links{}`, `curation{}`                                                                                                 |

Common base on every record: `slug`, `description`, `category`, `tags[]`, `links{}`, optional `content`, `source` (provenance), `curation` (human-curation block with `reviewed`, `reviewedBy`, `reviewedAt`, `labels[]`, `lenses[]`), `scores{}`.

A consumer-facing index projection (`IndexRecord`) is the slim shape used by list pages. It carries only the fields the renderer needs to render cards and filter chips.

---

## 5. CLI command surface

The full V1 CLI surface (`packages/cli/src/index.ts`):

| Command                   | What it does                                                                                                                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grove new <name>`        | Scaffold a new project. Prompts for blueprint, framework, GitHub mode, deploy provider. Copies the framework template, writes `grove.config.ts`, `.gitignore`, `LICENSE`, workflows, issue templates. Runs `pnpm install`. |
| `grove validate`          | Validate project data against the configured blueprint. `grove validate --strict` fails on warnings.                                                                                                                       |
| `grove generate`          | Build `data/generated/records.{full,index}.json` from `data/records/*.yml`. Source of truth for the renderer.                                                                                                              |
| `grove sitemap`           | Generate `public/sitemap.xml` from `records.full.json`.                                                                                                                                                                    |
| `grove llms`              | Generate `public/llms.txt` and `public/llms-full.txt` for LLM-friendly consumption.                                                                                                                                        |
| `grove build`             | Run the framework's build command (chains `build:data` → `build:sitemap` → `build:llms` → `astro build` in the Astro template).                                                                                            |
| `grove dev`               | Run the framework's dev server.                                                                                                                                                                                            |
| `grove import <source>`   | Import a Markdown awesome list (GitHub URL, raw URL, or local README) into `data/records/*.yml`.                                                                                                                           |
| `grove sync github`       | Optional: enrich each record with live GitHub metadata (stars, forks, last push, license, language, topics). Token-free HTML fallback if the API path fails.                                                               |
| `grove sync contributors` | Aggregate contributors across all repositories. V1 prints a stub message — full implementation lives in `core/src/contributors.ts`.                                                                                        |
| `grove cleanup stale`     | List records that need human curation (archived repos, missing licenses, stale forks). Writes `data/generated/cleanup-report.json`.                                                                                        |
| `grove workflows sync`    | Re-emit GitHub workflow files. `--force` overwrites; `--deploy <provider>` switches the build workflow.                                                                                                                    |

The dev-only `grove run [dev\|build\|init]` command scaffolds from the **local** workspace template (not the published version) and links `@grove-dev/*` deps to the monorepo. It is for testing template changes; end users do not call it.

### Scaffold options

`grove new` accepts the following flags and skips the interactive prompts:

```bash
grove new my-space \
  --blueprint project-directory \
  --framework astro \
  --github none \
  --deploy github-pages \
  --yes
```

| Flag           | Accepted values                                                   | V1 default          |
| -------------- | ----------------------------------------------------------------- | ------------------- |
| `--blueprint`  | `project-directory` \| `resource-hub` \| `ecosystem-map`          | `project-directory` |
| `--framework`  | `astro`                                                           | `astro`             |
| `--github`     | `none` \| `public`                                                | `none`              |
| `--deploy`     | `vercel` \| `netlify` \| `cloudflare` \| `github-pages` \| `none` | `github-pages`      |
| `--template`   | template name (per framework)                                     | `default`           |
| `--local`      | flag                                                              | off                 |
| `--no-git`     | flag                                                              | off                 |
| `--no-install` | flag                                                              | off                 |
| `--yes` / `-y` | flag                                                              | off                 |

**V1 CLI refuses** `--framework nextjs` and `--framework svelte` — they are not in the `SUPPORTED_FRAMEWORKS` list. Same for `--framework astro` once V1.1 lands (then SvelteKit joins the accepted list).

### GitHub automation modes

The `--github` flag controls which GitHub Actions and issue templates the scaffolder writes:

| Mode                               | What gets written                                                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `none` (default for private/local) | `validate-data.yml`, `build.yml`, `bug_report.md`, `feature_request.md`, `record_submission.md`                                                                                                              |
| `public` (for community sites)     | All of the above **plus** `sync-github-metadata.yml`, `sync-contributors.yml`, `cleanup-stale-records.yml`, `update-records.yml`, `daily-refresh.yml`, `report-broken-record.md`, `pull_request_template.md` |

`public` mode requires a `GITHUB_TOKEN` for the metadata-sync workflows; everything else works without a token.

### Deploy providers

The `--deploy` flag writes a provider-specific config file and (for vercel/netlify/cloudflare) a deploy workflow:

| Provider       | Config written                               | Workflow written                               |
| -------------- | -------------------------------------------- | ---------------------------------------------- |
| `github-pages` | (none — Pages deploys inline in `build.yml`) | `build.yml` (inline `actions/deploy-pages@v4`) |
| `vercel`       | `vercel.json`                                | `deploy-vercel.yml`                            |
| `netlify`      | `netlify.toml`                               | `deploy-netlify.yml`                           |
| `cloudflare`   | `wrangler.jsonc`                             | `deploy-cloudflare.yml`                        |
| `none`         | (none)                                       | (none)                                         |

---

## 6. Configuration: `grove.config.ts`

`grove.config.ts` is the single source of truth for a Grove space. It is loaded by the CLI (via `jiti` so TypeScript works without a build step) and consumed by the renderer to know which blueprint, which integrations, which theme tokens, and where the data files live.

```ts
import { defineConfig } from '@grove-dev/core';

export default defineConfig({
  blueprint: 'project-directory',

  site: {
    name: 'Open Apps',
    tagline: 'Production-ready open-source applications.',
    description: 'A curated, health-aware directory of open-source apps.',
    url: 'https://openapps.example.com',
    repoUrl: 'https://github.com/example/open-apps',
  },

  nav: [
    { label: 'Home', href: '/' },
    { label: 'Browse', href: '/projects' },
    { label: 'About', href: '/about' },
    { label: 'Submit', href: '/submit' },
  ],

  facets: ['category', 'stacks', 'platforms', 'tags'],

  integrations: {
    github: {
      metadata: true,
      health: true,
    },
  },

  theme: {
    primaryColor: '#16a34a',
    radius: 'soft',
    density: 'comfortable',
    containerWidth: '72rem',
  },

  components: {
    Header: undefined,
    Footer: undefined,
    Hero: undefined,
    ItemCard: undefined,
    DetailHeader: undefined,
  },

  paths: {
    dataDir: 'data',
    contentDir: 'content',
    recordsDir: 'data/records',
    publicDir: 'public',
    generatedDir: 'data/generated',
    health: 'data/health.yml',
    decisions: 'data/decisions.yml',
    overrides: 'data/overrides.yml',
  },
});
```

| Field                 | Type              | Default                                                                                        | What it controls                                                                                                    |
| --------------------- | ----------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `blueprint`           | enum              | `project-directory`                                                                            | The record kind and schema this space accepts.                                                                      |
| `site`                | object            | (required)                                                                                     | Brand: name, tagline, description, canonical URL, repo URL.                                                         |
| `nav`                 | array             | `[]`                                                                                           | Top navigation. Each item is `{ label, href }`.                                                                     |
| `facets`              | array             | `["category", "tags"]`                                                                         | Record fields exposed as refinement facets on the list page.                                                        |
| `integrations.github` | boolean \| object | `false`                                                                                        | Optional. `metadata: true` enables stars/forks/pushedAt/license enrichment; `health: true` derives `health.status`. |
| `theme`               | object            | `{ primaryColor: "#16a34a", radius: "soft", density: "comfortable", containerWidth: "72rem" }` | Design tokens consumed by the Astro template's `src/styles.css`.                                                    |
| `components`          | object            | all undefined                                                                                  | Override any of `Header`, `Footer`, `Hero`, `ItemCard`, `DetailHeader` with a path to a custom `.astro` file.       |
| `paths`               | object            | sensible defaults                                                                              | Filesystem layout. Every field has a default; override only what you need.                                          |

`defineConfig` from `@grove-dev/core` provides TypeScript autocomplete and Zod validation — misspelled fields fail at config-load time, not at the first `grove validate` run.

---

## 7. The Astro adapter's default template

`@grove-dev/astro/templates/default/` is the canonical starting point. It contains:

```
my-space/
├── astro.config.mjs              # uses @grove-dev/astro integration
├── grove.config.ts               # your site config
├── package.json                  # scripts: dev, build, validate:data, build:data, build:sitemap, build:llms
├── data/
│   ├── records/                  # one YAML per record
│   ├── decisions.yml             # curator decisions (visibility overrides)
│   ├── overrides.yml             # manual patches for imported records
│   └── generated/                # auto-generated JSON (gitignored)
├── content/
│   ├── pages/                    # optional Markdown pages (about.md, methodology.md)
│   └── records/                  # optional Markdown body per record
├── public/                       # logo, OG image, llms.txt, robots.txt, stack icons
├── src/
│   ├── pages/
│   │   ├── index.astro                              # hero + record sections
│   │   ├── about.astro
│   │   ├── contributors.astro
│   │   ├── submit.astro
│   │   ├── 404.astro
│   │   ├── [slug]/index.astro                       # blueprint-aware list page
│   │   ├── [slug]/[recordSlug].astro                # blueprint-aware detail page
│   │   ├── apps/[recordSlug].astro                  # V0 alias — 301 redirect to /<slug>/<slug>
│   │   └── sitemap.xml.ts
│   ├── data/
│   │   └── records.ts              # typed loader for records.full.json + site-config.json
│   └── styles/
│       └── global.css              # design tokens (--grove-*)
└── .github/
    ├── workflows/                  # validate-data, build, sync-github-metadata, sync-contributors, cleanup-stale-records, daily-refresh
    └── ISSUE_TEMPLATE/             # record_submission, bug_report, feature_request
```

### Pages rendered

- `/` — Hero + WhyThisExists + three lens sections (Trending, New, Established) + StackGrid + CategoryGrid + ContributorsGrid + OriginalCollection.
- `/<slug>/` — blueprint-aware list page (e.g. `/projects/`). SmartLensTabs (All / New / Hot / Mature / Production-like / Good-to-learn) + RefinePanel (stack/platform/category/license/status) + IndexRow list + Pagination.
- `/<slug>/<record-slug>/` — blueprint-aware detail page. Project records render 9 sections (breadcrumb, header, score bars, BestFor/WhyListed/Caveats, GitHub signals dl, decision signals 3-col, language mix, stack/platform chips, tags, distribution channels, content markdown) + JSON-LD `SoftwareSourceCode`.
- `/about/`, `/contributors/`, `/submit/`, `/404/` — supplementary pages.
- `/sitemap.xml` — generated by `grove sitemap`.

### Components shipped (22)

`packages/astro/src/components/`: `Hero`, `WhyThisExists`, `RecordSection`, `StackGrid`, `CategoryGrid`, `ContributorsGrid`, `OriginalCollection`, `IndexRow`, `Pagination`, `ItemCard`, `RefinePanel`, `SmartLensTabs`, `ScoreBars`, `CurationGrid`, `ExploreByCategory`, `ExploreByStack`, `DecisionRow`, `FilterGroupMenu`, `FilterOptions`, `Icon`, `MinimalAbout`.

Plus one layout (`BaseLayout`) with `Header`, `Footer`, `Container`, `Seo`, `SectionHeader`, `ThemeToggle`.

### V1 naming convention

V0 used `item` / `app` / `App`; V1 standardised on `record` / `IndexRecord`:

- `AppsIndexRow.astro` → `IndexRow.astro`
- `AppsPagination.astro` → `Pagination.astro`
- `ItemSection` (component) → `RecordSection`
- `filterItems` (function) → `filterRecords` (also re-exported from `@grove-dev/ui`)
- `[itemSlug].astro` (file name) → `[recordSlug].astro`
- `data-item-slug` / `dataset.itemSlug` → `data-record-slug` / `dataset.recordSlug`

**`ItemCard.astro` is retained as the V1 published name** for downstream stability — the component is the V1 record card; the name is a deliberate exception to the V0→V1 rename.

### URL convention

The canonical V1 URL is `/<blueprint-slug>/<record-slug>` (e.g. `/projects/coolify`). The V0-published `/apps/<slug>` URL still works via a static 301 redirect generated by `apps/[recordSlug].astro`. Open Apps-style bookmarks keep working.

---

## 8. The build pipeline

Every Grove space runs the same chain on `pnpm build`:

```
grove generate    → data/generated/records.{full,index}.json
grove sitemap     → public/sitemap.xml
grove llms        → public/llms.txt + public/llms-full.txt
astro build       → static HTML in dist/
```

The `dev` script runs `grove generate && astro dev`. The dev server watches `data/generated/` and rebuilds the page the moment a record lands.

The data flow:

```
data/records/<slug>.yml
   │
   │  grove validate          (Zod parse, schema check, fails fast)
   │  grove generate          (records.full.json + records.index.json)
   │  grove sitemap           (records.full.json → public/sitemap.xml)
   │  grove llms              (records.full.json → public/llms.txt + llms-full.txt)
   │
   ▼
data/generated/records.{full,index}.json
public/sitemap.xml
public/llms.txt
public/llms-full.txt
   │
   │  astro build              (consume records.index.json, render static pages)
   │
   ▼
dist/                         (deployable static site)
```

`records.full.json` carries every record, every field — the source of truth for the renderer. `records.index.json` is a slim visible-only projection used by list pages. `records.json` is an alias for `records.full.json` for tools that expect a stable filename.

---

## 9. GitHub automation

The `--github public` mode writes 4 extra workflows on top of the always-on `validate-data.yml` and `build.yml`:

| Workflow                    | What it does                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validate-data.yml`         | Runs `grove validate` on every PR. Catches schema errors before they merge.                                                                       |
| `build.yml`                 | Runs `pnpm build` on push to `main`. Deploys to the configured provider (GitHub Pages, Vercel, Netlify, Cloudflare).                              |
| `sync-github-metadata.yml`  | Runs `grove sync github` on a schedule + on demand. Writes stars/forks/pushedAt/license/language back into record YAML. Opens a PR if it changes. |
| `sync-contributors.yml`     | Runs `grove sync contributors` and aggregates contributor data into `data/generated/contributors.json`.                                           |
| `cleanup-stale-records.yml` | Runs `grove cleanup stale` and writes `data/generated/cleanup-report.json` as a workflow artifact.                                                |
| `daily-refresh.yml`         | Combined daily refresh — runs both sync workflows and the cleanup.                                                                                |

All workflows are pinned to specific action versions (`actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4` with Node 24).

---

## 10. The `llms.txt` output

Grove writes two files at build time:

- `public/llms.txt` — short, ~50-line index of the space. Sections: site name + description, top categories, key links. Suitable as a quick context file for an LLM.
- `public/llms-full.txt` — verbose: every visible record with name, description, category, tags, license, stars, URL.

Both files link back to each other and to the canonical record pages. The detail page advertises itself as `<link rel="alternate" type="text/plain" href="/llms.txt" title="LLM usage guidance" />`.

This is a **secondary feature**, not a headline. The headline is the directory itself.

---

## 11. Health signals

Every `project` record can carry a `health:` block:

```yaml
health:
  status: active # active | mature | stale | inactive | archived | unknown | historical | needs_review | quiet | unavailable
  tier: curated # curated | listed | experimental | hidden
```

`grove sync github` derives `status` from the live repository metadata (stars, last push, archive state). `data/decisions.yml` is the human curation layer — `highlight`, `keep`, `needs_review`, `hide`, `remove`, `historical` visibility decisions.

The renderer surfaces status as a badge on the card and on the detail page header.

---

## 12. Contribution workflow

The `public` GitHub mode writes the contribution tooling:

- **`.github/ISSUE_TEMPLATE/record_submission.md`** — the "Submit a record" form. 5 sections (Basics, Links, Why, Caveats, Checkboxes). Fields mirror the record schema.
- **`.github/ISSUE_TEMPLATE/report-broken-record.md`** — report a broken entry.
- **`.github/pull_request_template.md`** — PR template for record additions.
- **`/submit` page** — the Astro template ships a `submit.astro` page that renders a form which generates a record-submission issue.

The maintainer team triages submissions → turns them into PRs against `data/records/<slug>.yml` → `validate-data.yml` runs → merge → `daily-refresh.yml` syncs metadata → site redeploys.

---

## 13. Theming

`theme.primaryColor`, `theme.radius`, `theme.density`, `theme.containerWidth` are read by the Astro template's `src/styles.css` and applied as CSS custom properties (`--grove-primary`, `--grove-radius`, etc.). Tailwind 4 is supported as an opt-in via `@tailwindcss/vite`; plain CSS + design tokens is the default.

Override any default component by pointing `components.ItemCard` (etc.) at a custom `.astro` file. The custom component receives the same `record` prop shape.

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

Each space is its own repository, with its own data, branding, and community rules. Grove is the shared engine underneath.

---

## 16. Roadmap status

The Wave 0 → Wave 5 plan is in the [Roadmap](/roadmap/) page on the docs site. Summary of where things stand:

| Wave   | Goal                                 | Status                                                                                                                                     |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Wave 0 | Framework foundation                 | Done (V1 ships this)                                                                                                                       |
| Wave 1 | Identity & architecture lock         | Done                                                                                                                                       |
| Wave 2 | First real space in production       | Done — Open Apps is live                                                                                                                   |
| Wave 3 | Multiple spaces, multiple blueprints | **Next** — polished `resource-hub` and `ecosystem-map` templates, second reference space, SvelteKit adapter (V1.1), Next.js adapter (V1.2) |
| Wave 4 | Maintenance signals as opt-in        | Mostly done — `sync github` and `cleanup stale` exist; scoring and AI-assisted curation are roadmap                                        |
| Wave 5 | Federation (cross-space references)  | Do not build unless asked                                                                                                                  |

The framework is at **v0.3.0** (initial public release; pre-V1). The CLI, core, and Astro adapter are stable enough to power a real space end-to-end. The Next.js and SvelteKit adapters are skeleton packages; the V1 CLI refuses to scaffold them.
