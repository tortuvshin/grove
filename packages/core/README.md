# `@grove-dev/core`

The framework-free engine behind Grove directories.

Core owns:

- `grove.config.ts` loading and validation
- project, resource, entity, taxonomy, health, and decision schemas
- YAML validation and normalized generated records
- GitHub repository and contributor metadata
- cleanup reports
- sitemap and `llms.txt` generation
- the unified `prepareDirectory()` pipeline used by Astro and the CLI

```ts
import { defineConfig, prepareDirectory } from "@grove-dev/core";
```

Core contains no UI or framework adapter. Application-facing code should normally use `@grove-dev/astro`; direct Core imports are useful for config, tooling, and custom integrations.

Browser controllers that need the shared discovery rules should use the browser-safe subpath. It exposes filtering, sorting, facets, display labels, and lens URL helpers without pulling config loading or filesystem dependencies into the client bundle.

```ts
import { filterRecords, hrefForLens } from "@grove-dev/core/directory";
```

```bash
pnpm --filter @grove-dev/core check
pnpm --filter @grove-dev/core test
```

MIT
