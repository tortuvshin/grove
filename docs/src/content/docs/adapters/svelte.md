---
title: SvelteKit
description: Roadmap-only framework adapter. Why it exists, what's missing, and when to expect it.
---

The **SvelteKit** adapter (`@grove-dev/svelte`) is reserved as a
package boundary but is **not supported in V1**. Same status as
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
- a working `grove build` chain (the `package.json` scripts
  reference V0 commands like `grove build-data` and
  `grove build-llms-full` that do not exist in V1)

If you scaffold with `--framework svelte`, the project will install
successfully. Running `pnpm dev` or `pnpm build` will fail because
the `package.json` scripts call commands the V1 CLI does not
provide.

## What you'd need to ship a V1 SvelteKit adapter

The work mirrors the Next.js adapter:

- Replace the V0 command names in the template's `package.json`:
  - `grove build-data` → `grove generate`
  - `grove build-llms-full` → `grove llms`
  - `grove analyze` and `grove enrich` → `grove sync github`
- Port the Astro default template's home page, project index, and
  project detail page to SvelteKit (`+page.svelte` files in `src/routes/`).
- Port the design tokens from `src/styles.css` to a Tailwind config
  for SvelteKit.
- Re-implement the 20 Astro components as Svelte 5 components.
- Add SvelteKit build verification to the `test:scaffold` script.

## When to use this

**Don't**, in V1. Use the [Astro adapter](/adapters/astro/)
instead. The SvelteKit adapter is reserved as a
forward-compatibility boundary so consumers can write code that
imports `@grove-dev/svelte` today, and have it work when the
adapter ships in V1.1 or V1.2.

If you need a Svelte-rendered Grove site right now, the options
are:

- **Build a custom integration** on top of `@grove-dev/core`. The
  core package is framework-agnostic. A custom SvelteKit
  integration is roughly 100-200 lines of glue code.

## Tracking

V1.1 work for the SvelteKit adapter is tracked in the project
roadmap. See [Roadmap](/roadmap/) for current status and the
GitHub issues for the SvelteKit template under
`packages/svelte/templates/default/`.

## Related docs

- **[Astro adapter](/adapters/astro/)** — the V1-supported choice.
- **[Next.js adapter](/adapters/nextjs/)** — same roadmap status
  as SvelteKit.
