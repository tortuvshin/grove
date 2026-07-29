---
title: Framework status
description: Which renderers Grove supports today, and which are planned for a future release.
---

| Framework | Status | Description |
| --- | --- | --- |
| **Astro** | **Stable** | The only v0.4.0 renderer. `@grove-dev/astro` is the integration; the Astro scaffold is the source for `grove init`. |
| **SvelteKit** | **Planned** | No package or template exists. Will land in V1.1 only if a real community space asks for it. |
| **Next.js** | **Planned** | No package or template exists. Same status as SvelteKit. |

The Astro renderer is the only renderer in v0.4.0. `pnpm dev` and
`pnpm build` invoke `astro dev` and `astro build`; the
`@grove-dev/astro` integration prepares the generated JSON before
each renderer run.

The data, schema, and CLI work is identical regardless of renderer —
when a future SvelteKit or Next.js adapter lands, existing records
and config will work without changes. See [Roadmap](/roadmap/) for
the current V1.1 backlog.

## "Coming soon" is not the same as "shipped"

Earlier versions of this page listed Next.js and SvelteKit as
"coming soon" with skeleton workspaces in the monorepo. As of
v0.4.0 those packages have been removed from the workspace. If you
see a docs page or release note that still references them, file a
PR — the canonical story is the table above.