---
title: Next.js
description: Roadmap-only framework adapter. Why it exists, what's missing, and when to expect it.
---

The **Next.js** adapter (`@grove-dev/nextjs`) is reserved as a
package boundary but is **not supported in V1**. The package
exists so consumers can install it, but the V1 CLI refuses
`--framework nextjs` at scaffold time.

## Status

**Roadmap only — not in V1.** The package is published (to reserve
the name and the import path) but the default template is
incomplete and the build pipeline is not wired up.

## What ships today

The Next.js default template is essentially `package.json` plus
a `README.md`. It does not include:

- any Next.js pages or layouts
- any `@grove-dev/nextjs` components
- a working `grove build` chain

The V1 CLI refuses `--framework nextjs` at scaffold time. The
`grove build` command detects the framework from
`<root>/package.json` and exits with a clear error if the
`@grove-dev/nextjs` adapter is present but the build pipeline is
not wired up.

## What you'd need to ship a V1.2 Next.js adapter

- Port the Astro default template's home page, list page, and
  detail page to Next.js (App Router, React Server Components).
- Reuse `@grove-dev/ui` primitives (`filterRecords`, `sortRecords`,
  `paginateRecords`, `scoreRecords`, `format`) — no React
  re-implementation needed.
- Reuse `@grove-dev/core` types (`ProjectRecord`, `ResourceRecord`,
  `EntityRecord`, `IndexRecord`) and the discriminated `Resource`
  union.
- Re-implement the 22 `@grove-dev/astro` components in React,
  swapping `.astro` for `.tsx` and prop spreading. `ItemCard`,
  `IndexRow`, `RecordSection` are the three core record-rendering
  components to start with.
- Add Next.js build verification to the `test:scaffold` script.

This is roughly one to two weeks of focused work for a contributor
familiar with both Astro and Next.js.

## When to use this

**Don't**, in V1. Use the [Astro adapter](/adapters/astro/)
instead. The Next.js adapter is reserved as a forward-compatibility
boundary so consumers can write code that imports
`@grove-dev/nextjs` today, and have it work when the adapter
ships in V1.2.

If you need a server-rendered Grove site right now, the options are:

- **Use Astro with the SSR adapter** (out of scope for Grove
  V1, but supported by Astro itself).
- **Build a custom integration** on top of `@grove-dev/core`. The
  core package (`defineConfig`, `pickCleanupCandidates`,
  `classifyHealth`, `buildLlmsTxt`, `buildLlmsFullTxt`, `buildSitemap`,
  etc.) is framework-agnostic. A custom Next.js integration is
  roughly 100-200 lines of glue code that reads
  `data/generated/records.full.json` and renders the same UI
  primitives Astro uses.

## Tracking

V1.2 work for the Next.js adapter is tracked in the project
roadmap. See [Roadmap](/roadmap/) for current status.

## Related docs

- **[Astro adapter](/adapters/astro/)** — the V1-supported choice.
- **[SvelteKit adapter](/adapters/svelte/)** — same roadmap status
  as Next.js.
