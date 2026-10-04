<div align="center">

# 🌱 Grove

**Build a curated directory from files. Publish it everywhere. Keep it in sync.**

Grove is an open-source Astro framework for project directories, open-source
catalogs, and curated resource sites. Keep each record as a Markdown file;
Grove generates the searchable site, detail pages, collections, README lists, SEO
metadata, GitHub-enriched data, and machine-readable outputs. No database, no
CMS, and no runtime server required.

[![npm](https://img.shields.io/npm/v/@grove-dev/cli?label=%40grove-dev%2Fcli&color=0f766e&style=flat-square)](https://www.npmjs.com/package/@grove-dev/cli)
[![CI](https://img.shields.io/github/actions/workflow/status/tortuvshin/grove/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/tortuvshin/grove/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-0f766e.svg?style=flat-square)](LICENSE)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/tortuvshin/grove)

[Website](https://withgrove.dev/) ·
[Documentation](https://withgrove.dev/introduction/) ·
[Quick start](https://withgrove.dev/getting-started/scaffold/) ·
[Live example](https://openappscout.com/) ·
[npm](https://www.npmjs.com/package/@grove-dev/cli)

</div>

## One source, every surface

<a href="https://withgrove.dev/">
  <img
    src=".github/assets/grove-pipeline.gif"
    alt="Animation showing YAML records, Markdown, collections, and taxonomy flowing through Grove into website, SEO, AI-ready, and repository outputs"
    width="1200"
  />
</a>

Files remain the source of truth. Generated files are disposable build
artifacts, and scheduled workflows refresh external facts without taking
editorial judgment away from maintainers.

## What Grove ships today

- **A complete static site.** One command scaffolds an Astro project with
  search, filters, lenses, curated collections, record pages, submission
  guidance, and contributor pages.
- **Structured, portable content.** Each record is one Markdown file —
  frontmatter fields plus the notes shown on its page. Taxonomy, collections,
  decisions and overrides live in reviewable YAML.
- **Multiple outputs from the same files.** A build produces the website,
  normalized JSON datasets, `sitemap.xml`, `robots.txt`, Open Graph images,
  `llms.txt`, `llms-full.txt`, and optionally a generated README section.
- **Maintenance on rails.** Grove validates sources, refreshes GitHub and
  contributor metadata, identifies stale or archived records, and leaves the
  final keep/hide/remove decision in a file.
- **Consumer-owned presentation.** The generated project owns its Astro pages
  and product copy. Grove supplies schemas, domain logic, data adapters, and
  reusable UI without silently replacing local customization.
- **Credit that travels.** Links to listed projects keep the referrer and
  carry `ref=<your host>`, maintainers get a "Featured on" README badge, and
  the people who submit entries are credited on the pages they added.
- **Static-first deployment.** The result is plain HTML, JSON, and text files
  that can ship to Cloudflare, Vercel, Netlify, GitHub Pages, or any static
  host.
- **Stable since 1.0.** The packages follow semantic versioning: config,
  schemas, CLI and exports only break in a major, after a deprecation — see
  the [stability policy](https://withgrove.dev/project/roadmap/#stability).

## Quick start

Requirements: Node.js `>=22.12.0` and a package manager (pnpm, npm, yarn or bun — `grove init` detects which).

```bash
pnpm dlx @grove-dev/cli@latest init my-space
cd my-space
pnpm dev
```

The scaffold is a real, complete Grove site — not a separate demo template —
and starts with one sample record. Start by editing these three surfaces:

```text
content/records/    one Markdown file per record — frontmatter + notes (YAML in data/records/ also works)
grove.config.ts     identity, routes, facets, theme, integrations, audit pages
src/pages/          site-owned routes and page composition
```

Grove prepares generated artifacts automatically before `astro dev`,
`astro check`, and `astro build`.

```bash
pnpm exec grove check               # validate sources and rebuild outputs
pnpm exec grove update              # take upstream UI changes, keeping local edits
pnpm exec grove sync github         # refresh repository metadata
pnpm exec grove sync contributors   # refresh community metadata
pnpm exec grove cleanup             # write the human-review queue
pnpm exec grove readme generate     # update a generated README section
pnpm build                           # produce the deployable static site
```

See the [CLI reference](https://withgrove.dev/reference/cli/) for collection
promotion, import, icon synchronization, and Lighthouse audit commands.

## A real operating model

[Open App Scout](https://openappscout.com/) is the production reference that
shaped Grove — featured in [Astro's August 2026 roundup](https://astro.build/blog/whats-new-august-2026/):
nearly 200 apps as Markdown records, searchable views, editor's picks and live
collections, repository refreshes, health signals, credited community
submissions, a sitemap, and AI-readable outputs. Grove turns that proven operating model into
reusable packages and a project scaffold, and Open App Scout runs on the
published packages.

<table align="center">
  <tr>
    <td align="center" valign="top" width="420">
      <a href="https://openappscout.com/">
        <img
          src=".github/assets/open-apps-home.png"
          alt="Open App Scout home page with search, activity signals, and curated applications"
          width="420"
        />
      </a>
      <br />
      <a href="https://openappscout.com/"><strong>Home</strong></a>
      <br />
      <sub>Search, the Astro feature, contributors and live ecosystem stats.</sub>
    </td>
    <td align="center" valign="top" width="420">
      <a href="https://openappscout.com/apps/">
        <img
          src=".github/assets/open-apps-browse.png"
          alt="Open App Scout browse page with search, filters, sorting, and application cards"
          width="420"
        />
      </a>
      <br />
      <a href="https://openappscout.com/apps/"><strong>Browse</strong></a>
      <br />
      <sub>Search, filtering, sorting, and health-aware application cards.</sub>
    </td>
    <td align="center" valign="top" width="420">
      <a href="https://openappscout.com/apps/anarlog/">
        <img
          src=".github/assets/open-apps-detail.png"
          alt="Open App Scout application detail page with project context and structured editorial content"
          width="420"
        />
      </a>
      <br />
      <a href="https://openappscout.com/apps/anarlog/"><strong>Detail</strong></a>
      <br />
      <sub>Install channels, a written verdict, and source-derived facts.</sub>
    </td>
    <td align="center" valign="top" width="420">
      <a href="https://openappscout.com/collections/">
        <img
          src=".github/assets/open-apps-collections.png"
          alt="Open App Scout collections page with curated views generated from application records"
          width="420"
        />
      </a>
      <br />
      <a href="https://openappscout.com/collections/"><strong>Collections</strong></a>
      <br />
      <sub>Editor's picks and live views, with app icons and review dates.</sub>
    </td>
  </tr>
</table>

Directories are the front door; the same data layer — files in, many outputs
out, kept in sync — also serves other structured catalogs.

## Repository

```text
packages/
  core/       framework-free schemas, validation, generation, and maintenance
  astro/      Astro integration, data adapters, and server view models
  cli/        project creation and maintenance commands
  registry/   the UI source `grove init` installs and `grove update` reconciles
  starlight/  Grove's documentation theme and integration
apps/
  example/    reference consumer; mirrors the generated scaffold byte-for-byte
  docs/       product site and documentation at withgrove.dev
```

| Package                                      | Role                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [`@grove-dev/core`](packages/core)           | Config, schemas, validation, generated data, collections, health, sitemap, AI outputs, and maintenance logic. |
| [`@grove-dev/astro`](packages/astro)         | Astro integration, generated-data adapters, and server view models. Ships no components — UI lives in the registry. |
| [`@grove-dev/cli`](packages/cli)             | Scaffolding, checks, synchronization, cleanup, imports, audits, icons, collections, and README generation.    |
| [`@grove-dev/starlight`](packages/starlight) | The Starlight theme and documentation integration used by Grove.                                              |

`@grove-dev/registry` is a fifth workspace package. It is private and never
published to npm; its built items are served from the docs site and baked
into the CLI tarball.

There is no hidden hosted backend. The UI a space renders is installed into
that space's own `src/` and owned there — `grove init` writes it, and
`grove update` reconciles it against upstream without ever overwriting a
file the space has modified. `apps/example` mirrors the generated scaffold
byte-for-byte, enforced in CI, so the project users create stays aligned
with the site this repository builds and tests.

## Develop Grove

```bash
pnpm install
pnpm dev
pnpm check
pnpm test
pnpm build
pnpm test:scaffold
```

For the documentation site, run `pnpm dev:docs`.

## Principles

- Files are the source of truth; outputs are derived.
- One piece of content should serve many human and machine surfaces.
- Automation should reduce drift while keeping decisions transparent.
- Static publishing and portable formats are the default.
- Infrastructure must earn its place; Grove does not require a database or
  application server.

## License

[MIT](LICENSE) © Grove contributors.
