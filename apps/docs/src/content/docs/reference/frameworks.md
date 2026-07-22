---
title: Framework status
description: Which frameworks Grove supports today, and which are coming in V1.1 and V1.2.
---

| Framework | Status | Description |
|---|---|---|
| **Astro** | Available | Production-ready default adapter and template |
| **Next.js** | Coming soon | Planned framework adapter for V1.2 |
| **SvelteKit** | Coming soon | Planned framework adapter for V1.1 |

The Astro adapter is the only V1 supported renderer. The Next.js and SvelteKit packages exist as skeleton workspaces in the monorepo but the V1 CLI refuses `--framework nextjs` and `--framework svelte` at scaffold time.

The data, schema, and CLI work is identical regardless of renderer — when the SvelteKit adapter lands, existing records and config will work without changes.