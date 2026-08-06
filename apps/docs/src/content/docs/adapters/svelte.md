---
title: SvelteKit
description: "Status: not shipped. A SvelteKit adapter is a future roadmap item, not part of v0.4.0."
---

The **SvelteKit** adapter is **not shipped in v0.4.0**. There is no
`@grove-dev/svelte` package in the workspace, no SvelteKit template,
and the `grove init` scaffolder only emits an Astro project.

## Status

**Planned.** No code exists for this adapter today. The roadmap
([V1.1 section](/roadmap/#next-release--v11)) lists a SvelteKit
adapter only "if asked" by a real community space.

## Why this page exists

The page is kept so that:

- A reader who searches for "Grove SvelteKit" lands on a clear
  status page rather than a 404.
- The roadmap status of SvelteKit stays pinned in the docs site
  navigation alongside the [Astro adapter](/adapters/astro/) and
  the [Next.js adapter](/adapters/nextjs/).

## What would need to ship

A v1.1 SvelteKit adapter would have to:

- Add a `@grove-dev/svelte` package under `packages/svelte/` with
  SvelteKit-friendly page components and server helpers.
- Mirror `@grove-dev/astro`'s blueprint-aware list and detail pages
  in `+page.svelte` files under `src/routes/`.
- Reuse `@grove-dev/core` directly — the core package is
  framework-agnostic.
- Add SvelteKit build verification to the `test:scaffold` smoke
  script.

This is roughly 1-2 weeks of focused work for a contributor familiar
with both Astro and SvelteKit. No such work is currently scheduled.

## When you need a Svelte-rendered site today

- **Build a custom integration** on top of `@grove-dev/core`. The
  core package is framework-agnostic. A custom SvelteKit integration
  is roughly 100-200 lines of glue code that reads
  `data/generated/records.full.json` and renders the same UI
  primitives Astro uses.
- **Wait** for the V1.1 release if the demand justifies it.

## Tracking

SvelteKit adapter status is tracked in
[Roadmap](/roadmap/#next-release--v11).

## Related docs

- **[Astro adapter](/adapters/astro/)** — the only v0.4.0-supported
  choice.
- **[Next.js adapter](/adapters/nextjs/)** — same planned status as
  SvelteKit.
- **[Frameworks status matrix](/reference/frameworks/)** — single
  table covering all renderers.