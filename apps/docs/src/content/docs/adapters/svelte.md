---
title: SvelteKit
description: Roadmap-only framework adapter. Why it exists, what's missing, and when to expect it.
---

The **SvelteKit** adapter (`@grove-dev/svelte`) is reserved as a
package boundary but is **not supported in V1**. The V1 CLI
refuses `--framework svelte` at scaffold time. Same status as
the [Next.js adapter](/adapters/nextjs/).

## Status

**Roadmap only — not in V1.** The package is published (to reserve
the name and the import path) but the default template is
incomplete and the build pipeline is not wired up.

## What ships today

The SvelteKit default template is essentially `package.json` plus
a `README.md`. It does not include:

- any SvelteKit routes or layouts
- any `@grove-dev/svelte` components
- a working `grove build` chain

The V1 CLI refuses `--framework svelte` at scaffold time. Same
build-detection error as the Next.js adapter.

## What you'd need to ship a V1.1 SvelteKit adapter

The work mirrors the Next.js adapter:

- Port the Astro default template's home page, list page, and
  detail page to SvelteKit (`+page.svelte` files in `src/routes/`).
- Reuse `@grove-dev/ui` primitives — the same 5 modules
  (`filterRecords`, `sortRecords`, `paginateRecords`,
  `scoreRecords`, `format`) work in any framework.
- Reuse `@grove-dev/core` types (`ProjectRecord`, `ResourceRecord`,
  `EntityRecord`, `IndexRecord`) directly.
- Re-implement the 22 `@grove-dev/astro` components as Svelte 5
  components. `ItemCard`, `IndexRow`, `RecordSection` are the three
  core record-rendering components to start with.
- Add SvelteKit build verification to the `test:scaffold` script.

## When to use this

**Don't**, in V1. Use the [Astro adapter](/adapters/astro/)
instead. The SvelteKit adapter is reserved as a
forward-compatibility boundary so consumers can write code that
imports `@grove-dev/svelte` today, and have it work when the
adapter ships in V1.1.

If you need a Svelte-rendered Grove site right now, the options are:

- **Build a custom integration** on top of `@grove-dev/core`. The
  core package is framework-agnostic. A custom SvelteKit
  integration is roughly 100-200 lines of glue code that reads
  `data/generated/records.full.json` and renders the same UI
  primitives Astro uses.

## Tracking

V1.1 work for the SvelteKit adapter is tracked in the project
roadmap. See [Roadmap](/roadmap/) for current status.

## Related docs

- **[Astro adapter](/adapters/astro/)** — the V1-supported choice.
- **[Next.js adapter](/adapters/nextjs/)** — same roadmap status
  as SvelteKit.
