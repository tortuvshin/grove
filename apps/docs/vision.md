# Vision

> **Historical document — preserved for context.** Grove's current
> shipping surface is described in [Roadmap](/roadmap/) and the
> [CLI reference](/reference/cli/). This page captures the original
> framing that shaped v0.1.0 through v0.4.0 and remains a useful
> read for contributors, but it is not the canonical description of
> what Grove ships today.

> **Grow useful community knowledge.**

## What Grove is

Grove is an open-source framework for **growing useful community knowledge**. It helps communities collect, structure, maintain, and improve the projects, tools, resources, and knowledge they rely on — over years, not weeks.

The "knowledge" can be anything a community cares about:

- A set of production-ready apps ([`Open Apps`](https://github.com/tortuvshin/open-apps))
- An open-source ecosystem
- A directory of developer tools, SDKs, integrations
- A library of practical AI resources
- A local tech / startup ecosystem map
- Learning resources, public datasets, research collections, community guides

Every one of those is a **Grove space** — a static, file-backed, contributor-friendly site that runs the same engine and changes only its data, branding, and community rules.

## What Grove is not

Grove is **not** an awesome-list generator. It is not a directory template. It is not a CMS, a database, an admin dashboard, or a SaaS.

- It is not a replacement for `awesome-*` repos — it is a maintenance and web layer on top of them.
- It is not tied to GitHub — GitHub metadata is one optional enhancement signal, not the core identity.
- It is not a multi-tenant platform — every space is its own repo, its own data, its own community.
- It is not an opinionated UI — every space can fork the theme and ship its own visual identity.

## Core concepts

```txt
Grove Core
  - resource schema
  - config
  - importers (Markdown awesome lists, YAML, manual)
  - validators
  - taxonomy (categories, topics, tags)
  - optional signal sync (GitHub activity, releases, archive)
  - build pipeline (data → generated JSON → static site)
  - contribution workflow primitives

Grove Space
  - grove.config.ts
  - data/             # resources, taxonomy, health, decisions
  - content/          # methodology, about, guides
  - public/           # logo, OG image, custom assets
  - .github/          # workflows, issue templates
  - branding & navigation overrides
  - community rules
```

The split is deliberate: **Core** stays small and generic; **Space** is where every community's personality lives.

## Why "grow / maintain / improve / prune"

A list decays. A directory rots. An ecosystem that was vibrant five years ago can be dead today with no one noticing. Grove treats community knowledge the way a gardener treats a garden — as something living that needs regular attention.

```txt
Plant    →  suggest a new resource (issue / PR)
Grow     →  collect, structure, and surface it
Maintain →  signals flag drift; humans curate
Improve  →  descriptions, topics, and links get sharper
Prune    →  visibility decisions keep the space honest
```

This language is the brand. We don't say "directory", "awesome list", "catalog", "link collection", or "database" in hero copy. We say **space**, **resource**, **maintainer** (or gardener), **suggest / improve / plant**, **prune**. Use case descriptions can use the older words; the positioning does not.

## Positioning

```txt
Hero:        Grow useful community knowledge.
Subhead:     Grove is an open-source framework that helps communities collect,
             structure, maintain, and improve the projects, tools, resources,
             and knowledge they rely on.
One-liner:   An open-source framework for growing useful community knowledge.
```

The framing in user-facing copy:

- **Grove is not built only for open-source app directories.**
- Open-source projects are *one* kind of resource, not the only kind.
- Every space has its own community and its own rules.
- The engine is shared; the personality is local.

## Identity, not implementation

The data model is the identity. The first thing to get right is the **Resource** shape:

```ts
type Resource = {
  name: string;
  description: string;
  type: ResourceType;
  url?: string;
  repository?: string;
  topics?: string[];
  tags?: string[];
  status?: "active" | "inactive" | "archived" | "unknown";
  maintainers?: Person[];
  organizations?: Organization[];
  metadata?: Record<string, unknown>;
};
```

GitHub metadata — stars, language, license, topics, release dates — is an **optional enhancement** layered on top of this identity. A learning resource, a public dataset, a community guide, or a local company profile all fit the same shape, with `repository` simply being undefined.

This is what keeps Grove generic. If we tie identity to GitHub too tightly, we become an "OSS directory" forever. We are not.

## MVP scope

The MVP exists to **lock the identity** in working code, not to ship every feature.

### In scope for the first release

1. `defineConfig()` (V0's `defineGroveConfig` was renamed in V1) — typed config loader
2. Discriminated `Resource` schema (Zod, framework-agnostic) — `ProjectRecord` | `ResourceRecord` | `EntityRecord`
3. Categories, topics, tags
4. Resource detail page
5. Listing / search / filter page
6. Content pages (about, contributors, submit — V1 ships these as Astro components under `src/pages/`, not as Markdown content pages)
7. Custom branding + navigation overrides
8. Static generation (Astro)
9. Contribution guide structure (issue templates + PR-driven data)
10. One real Grove-powered space shipping end-to-end

### Out of scope (roadmap, not MVP)

- GitHub metadata sync (`grove sync github` — V0 name was `grove analyze`)
- Health / freshness / scoring signals
- AI-assisted curation
- Multi-space dashboard
- Complex review workflows
- Pluggable importers beyond Markdown
- A SaaS / hosted version
- Auth, paywalls, private spaces

These are real, useful features — and they should be roadmap items, not promises in the README. The MVP must work without any of them.

## The reference spaces

The first space we ship proves the framework works:

```txt
Open Apps  →  production-ready OSS applications
```

It is not an "example project". It is a **real space powered by Grove** — the reference implementation that shows the framework is more than an abstract idea. The strongest expression of "growing useful community knowledge" is a real community running on Grove, not just an open-source aesthetic.

The first version of Grove ships when **this space is live**. The rest follow.

## What success looks like

A year from now, success looks like:

- At least three real Grove-powered spaces in production, each maintained by its own community.
- A new community can fork a space template and ship a new space in a weekend.
- The framework's `core` and `ui` packages are reused across all spaces, and almost no code is duplicated.
- The data model is generic enough to hold OSS projects, AI resources, learning collections, and local ecosystems without forking.
- The contribution workflow is the simplest in the open-source world: open an issue, fill a form, get a PR.
- People talk about Grove as a **community knowledge framework**, not as "that awesome-list thing."

## What we are not building

Grove is not building a hosted SaaS. There is no `grove.cloud`. The framework repo is not a marketing site. There is no premium tier.

Grove is a **framework**: a small, sharp, file-backed engine that communities adopt because it makes their knowledge space better. The value is in the spaces, not the platform.
