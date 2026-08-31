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

No. Grove is fully file-first. Records, taxonomy, collections, decisions — everything is YAML or Markdown. `data/generated/` holds derived JSON, which the build rewrites from those files; it is never a source of truth and never hand-edited.

## How does Grove compare to Hugo / Jekyll / Eleventy?

- **Hugo** is faster but assumes a single content type. Grove is opinionated about *structured* content, with a Zod-validated record schema and taxonomy.
- **Jekyll** is simpler but lacks built-in LLM-oriented outputs and a curated-collection concept.
- **Eleventy** is more flexible but provides less structure; you'd build what Grove gives you out of the box.

## How does Grove compare to a CMS?

Grove is not a CMS. There's no admin UI, no live preview, no workflow engine. Curation happens in Git: PRs review changes, GitHub Actions sync metadata. This is a deliberate choice — see [Why Grove](/start-here/why-grove/).

## How do I deploy?

Any static host — `pnpm build` writes a plain directory of files. `grove init` writes no CI workflows; the reference app in the repo (`apps/example/.github/workflows/`) has a working GitHub Pages `deploy.yml` to copy, and for other hosts you write the config yourself. See [Deploy your site](/deployment/overview/), [GitHub Pages](/deployment/github-pages/), [Cloudflare](/deployment/cloudflare/), [Netlify](/deployment/netlify/), or [self-hosted](/deployment/self-hosted/).

## How do I extend Grove?

Grove has no plugin system of its own. You extend it with the tools Astro already gives you:

1. **Write an Astro integration** that runs alongside `@grove-dev/astro`.
2. **Add a Vite plugin** through that integration's `updateConfig`.
3. **Read `data/generated/*.json`** at build time and emit your own pages.
4. **Ship a Starlight plugin** if you are extending a docs site.

There is no Grove-exposed virtual module and no supported way to extend the config schema. See [Plugin author guide](/reference/plugin-author-guide/).

## Does Grove support i18n?

No. `site.locale` sets one language for the whole site — it drives `<html lang>`, `og:locale`, and JSON-LD `inLanguage`, and nothing more. No `hreflang` alternates are emitted and there is no per-locale routing. (The Starlight theme package has an `i18n:setup` hook stubbed out in `core/plugin.ts`, but that is the docs theme, not a Grove space.)

## How are stars and freshness computed?

`grove sync github` fetches stars, forks, language, topics, license, and `pushed_at` from the GitHub API and writes them under `github.*` on each record.

Health (`active` / `stale` / `inactive` and the `tier` above it) is a *separate* derivation, implemented as `classifyHealth` in `packages/core/src/health.ts`. Set `integrations.github.health: true` and `grove sync github` writes the derived entries to `data/health.yml` in the same run; leave it off and the file is yours to author. See [Maintain health signals](/content/health-classification/).

## What is `llms.txt`?

A site-level index file designed to be ingested by AI assistants. Spec: <https://llmstxt.org>. Grove emits `llms.txt` (a constant-size site header — name, description, directory link, record/category counts, no per-record content) and `llms-full.txt` (an index line plus a detail section per record). See [LLM-oriented outputs](/outputs/llm/).

## Can I use Grove for non-directory content?

Records are scoped to `kind: project` today, so a record has to be something project-shaped. For anything else, author free-form Markdown under `content/pages/` and render it with your own Astro components — see [Content pages](/concepts/content-pages/). The data layer in `@grove-dev/core` is reusable well beyond a directory.

## What's the license?

MIT for the codebase. See [`LICENSE`](https://github.com/tortuvshin/grove/blob/main/LICENSE).

## Where do I report bugs?

Open an issue at <https://github.com/tortuvshin/grove/issues>.

## Related

- [Introduction](/introduction/)
- [Why Grove](/start-here/why-grove/)
- [Roadmap](/project/roadmap/)