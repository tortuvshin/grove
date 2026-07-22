# `@grove-dev/astro`

Composable Astro UI and generated-data adapters for Grove-powered directories.

The integration prepares generated data before Astro runs, aliases generated files, and loads Grove's shared styles. It does not inject routes. Every route lives in the consumer's `src/pages`, where it can be reordered, replaced, or extended without a Grove sync overwriting it.

```js
import { defineConfig } from "astro/config";
import grove from "@grove-dev/astro";

export default defineConfig({ integrations: [grove()] });
```

`grove init` copies a complete working set of home, directory list, record detail, about, contributors, submit, 404, and legacy redirect pages from the canonical `apps/example/` scaffold. `grove.config.ts` determines the directory route and branding.

The package exports granular components and layouts plus `@grove-dev/astro/server` view-model functions. Framework-independent filtering, sorting, lenses, scoring, formatting, and taxonomy logic live in `@grove-dev/core`.

```bash
pnpm --filter @grove-dev/astro check
pnpm --dir apps/example build
```

MIT
