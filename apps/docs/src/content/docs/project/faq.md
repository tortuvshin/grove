---
title: Frequently asked questions
description: Common questions about Grove — what it is, how it works, and how to extend it.
---

## What is Grove?

Grove is a **file-first publishing system for structured knowledge**. You write YAML records and Markdown bodies; Grove produces a website, an `llms.txt`, a sitemap, JSON-LD, OG images, and other machine-readable artifacts from those sources. It's a directory builder, but also a knowledge-base generator, a content hub, and an LLM-oriented publishing system — all driven by files you control.

## Is Grove a static site generator?

Grove is *built on top of* a static site generator (Astro), but it's not one itself. The Astro integration renders the human-facing pages; `@grove-dev/core` handles the data layer. The mental model is "files → many outputs," not "templates → HTML."

## Can I use Grove without Astro?

No — Astro is the rendering layer. If you want a non-Astro frontend, you'd need to build your own integration using `@grove-dev/core`'s programmatic API.

## Do I need a database?

No. Grove is fully file-first. Records, taxonomy, collections, decisions — everything is YAML or Markdown. The generated JSON in `data/generated/` is the only runtime data, and it's regenerated on every build.

## How does Grove compare to Hugo / Jekyll / Eleventy?

- **Hugo** is faster but assumes a single content type. Grove is opinionated about *structured* content with blueprints and taxonomy.
- **Jekyll** is simpler but lacks built-in LLM-oriented outputs and a curated-collection concept.
- **Eleventy** is more flexible but provides less structure; you'd build what Grove gives you out of the box.

## How does Grove compare to a CMS?

Grove is not a CMS. There's no admin UI, no live preview, no workflow engine. Curation happens in Git: PRs review changes, GitHub Actions sync metadata. This is a deliberate choice — see the [architecture guardrails](/concepts/philosophy/#what-grove-is-not).

## What are the 3 blueprints?

- **project-directory** — open-source projects (default).
- **resource-hub** — articles, tutorials, videos, papers.
- **ecosystem-map** — organizations, people, working groups.

Each blueprint has its own JSON-LD type and lens semantics.

## How do I deploy?

Any static host. See [GitHub Pages](/deployment/github-pages/), [Cloudflare](/deployment/cloudflare/), [Netlify](/deployment/netlify/), or [self-hosted](/deployment/self-hosted/).

## How do I extend Grove?

Three extension points:

1. **Astro integration** — runs alongside `@grove-dev/astro`. See [Plugin author guide](/reference/plugin-author-guide/).
2. **Vite plugin** — dev-only augmentations.
3. **Starlight plugin** — extends the docs site.

## Does Grove support i18n?

Not yet. `i18n:setup` hooks are scaffolded in the Starlight plugin but commented out. Multi-locale sites need to fork the schema and customize per-locale.

## How are stars and freshness computed?

Stars come from the GitHub API (`fetchGithubMetadata`). Freshness uses `github.pushedAt`. Health classification (`active`/`stale`/`inactive`) is computed from these in `packages/core/src/health.ts`. See [Health classification](/sources/health-classification/).

## What is `llms.txt`?

A site-level index file designed to be ingested by AI assistants. Spec: <https://llmstxt.org>. Grove emits `llms.txt` (≤10 KB index) and `llms-full.txt` (per-record sections). See [LLM-oriented outputs](/outputs/llm/).

## Can I use Grove for non-directory content?

Yes. The `resource-hub` and `ecosystem-map` blueprints are for non-directory use cases. If your content doesn't fit any of the three blueprints, you can author `content/pages/*.md` for free-form Markdown pages and build custom Astro components. The data layer (`@grove-dev/core`) is reusable beyond the directory use case.

## What's the license?

MIT for the codebase. See [`LICENSE`](https://github.com/tortuvshin/grove/blob/main/LICENSE).

## Where do I report bugs?

Open an issue at <https://github.com/tortuvshin/grove/issues>.

## Related

- [Introduction](/introduction/)
- [Philosophy](/concepts/philosophy/)
- [Roadmap](/roadmap/)