---
title: Next.js
description: "Status: not shipped. A Next.js adapter is a future roadmap item, not part of `0.5.0-next.2`."
---

The **Next.js** adapter is **not shipped in `0.5.0-next.2`**. There is no
`@grove-dev/nextjs` package in the workspace, no Next.js template,
and the `grove init` scaffolder only emits an Astro project.

## Status

**Planned.** No code exists for this adapter today. The roadmap
([Later — directional](/roadmap/#later--directional)) lists a Next.js
adapter only "if asked" by a real community space.

## Why this page exists

The page is kept so that:

- A reader who searches for "Grove Next.js" lands on a clear status
  page rather than a 404.
- The roadmap status of Next.js stays pinned in the docs site
  navigation alongside the [Astro adapter](/adapters/astro/) and the
  [SvelteKit adapter](/adapters/svelte/).

## What would need to ship

A v1.1 Next.js adapter would have to:

- Add a `@grove-dev/nextjs` package to the workspace with
  Next.js-friendly page components and server helpers.
- Port the Astro default template's home page, list page, and
  detail page to Next.js (App Router, React Server Components).
- Reuse `@grove-dev/core` directly — the core package is
  framework-agnostic.
- Re-implement the Astro record components in React (`.tsx`).
- Add Next.js build verification to the `test:scaffold` smoke
  script.

This is roughly 1-2 weeks of focused work for a contributor
familiar with both Astro and Next.js. No such work is currently
scheduled.

## When you need a server-rendered site today

- **Use Astro with the SSR adapter** (out of scope for Grove `0.5.0-next.2`,
  but supported by Astro itself).
- **Build a custom integration** on top of `@grove-dev/core`. The
  core package is framework-agnostic.
- **Wait** for the V1.1 release if the demand justifies it.

## Tracking

Next.js adapter status is tracked in
[Roadmap → Later — directional](/roadmap/#later--directional).

## Related docs

- **[Astro adapter](/adapters/astro/)** — the only `0.5.0-next.2`-supported
  choice.
- **[SvelteKit adapter](/adapters/svelte/)** — same planned status as
  Next.js.
- **[Frameworks status matrix](/reference/frameworks/)** — single
  table covering all renderers.