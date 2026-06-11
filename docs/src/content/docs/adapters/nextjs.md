---
title: Next.js
description: Roadmap-only framework adapter. Why it exists, what's missing, and when to expect it.
---

The **Next.js** adapter (`@grove-dev/nextjs`) is reserved as a
package boundary but is **not supported in V1**. The package
exists so consumers can install it and the CLI can scaffold a
Next.js shell, but the default template is a stub and `grove build`
refuses to run it.

## Status

**Roadmap only — not in V1.** The package is published (to reserve
the name and the import path) but the default template is
incomplete and the build pipeline is not wired up.

## What ships today

The Next.js default template is essentially `package.json` plus
a `README.md`. It does not include:

- any Next.js pages or layouts
- any `@grove-dev/nextjs` components
- a working `grove build` chain (the `package.json` scripts
  reference V0 commands like `grove build-data` and
  `grove build-llms-full` that do not exist in V1)

If you scaffold with `--framework nextjs`, the project will install
successfully. Running `pnpm dev` or `pnpm build` will fail because
the `package.json` scripts call commands the V1 CLI does not
provide.

## What you'd need to ship a V1 Next.js adapter

- Replace the V0 command names in the template's `package.json`:
  - `grove build-data` → `grove generate`
  - `grove build-llms-full` → `grove llms`
  - `grove analyze` and `grove enrich` → `grove sync github`
- Port the Astro default template's home page, project index, and
  project detail page to Next.js (App Router, React Server
  Components).
- Port the design tokens from `src/styles.css` to a Tailwind config
  for Next.js.
- Re-implement the 20 Astro components in React.
- Add Next.js build verification to the `test:scaffold` script.

This is roughly one to two weeks of focused work for a contributor
familiar with both Astro and Next.js.

## When to use this

**Don't**, in V1. Use the [Astro adapter](/adapters/astro/)
instead. The Next.js adapter is reserved as a forward-compatibility
boundary so consumers can write code that imports
`@grove-dev/nextjs` today, and have it work when the adapter
ships in V1.1 or V1.2.

If you need a server-rendered Grove site right now, the options are:

- **Use Astro with the SSR adapter** (out of scope for Grove
  V1, but supported by Astro itself).
- **Build a custom integration** on top of `@grove-dev/core`. The
  core package (`generate`, `validate`, `loadConfig`, etc.) is
  framework-agnostic. A custom Next.js integration is roughly
  100-200 lines of glue code that reads `records.full.json` and
  renders the same components Astro uses.

## Tracking

V1.1 work for the Next.js adapter is tracked in the project
roadmap. See [Roadmap](/roadmap/) for current status and the
GitHub issues for the Next.js template under
`packages/nextjs/templates/default/`.

## Related docs

- **[Astro adapter](/adapters/astro/)** — the V1-supported choice.
- **[SvelteKit adapter](/adapters/svelte/)** — same roadmap status
  as Next.js.
