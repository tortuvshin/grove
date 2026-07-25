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

## Audit contract

`@grove-dev/core` defines the page-manifest contract that `grove audit` consumes. An audit block is declared in `grove.config.ts` and lists the pages the CLI will run Lighthouse against.

### Page types

Every entry in `audit.pages[]` must declare one of seven `PageType` values:

| Type | Meaning |
| --- | --- |
| `home` | The site's landing page. |
| `directory` | The searchable/filterable index of records. |
| `collection` | A taxonomy or facet landing page. |
| `record` | An individual record detail page. |
| `content` | A long-form content page (about, blog post, etc.). |
| `empty` | A page that intentionally renders an empty state. |
| `404` | The not-found page. Audited for completeness but exempt from the 100×4 budget because Lighthouse cannot measure 404 responses. |

### `PageManifestEntry` shape

```ts
interface PageManifestEntry {
  path: string;            // e.g. "/", "/directory", "/about"
  type: PageType;          // one of the seven values above
  label: string;           // human-readable label used in audit output
  sample?: Record<string, string>; // optional path/query overrides
}
```

### Default budget

The audit enforces a perfect Lighthouse score across `performance`, `accessibility`, `best-practices`, and `seo`, plus the following metric ceilings:

- **LCP** ≤ 1800 ms
- **CLS** ≤ 0.05
- **TBT** ≤ 100 ms

The default is 4 runs per page/profile (mobile + desktop) — the 100×4 contract. `grove audit` returns a non-zero exit code on any violation, making it a drop-in CI check.

### Minimal example

```ts
// grove.config.ts
import { defineConfig } from "@grove-dev/core";

export default defineConfig({
  audit: {
    baseUrl: "http://127.0.0.1:4321",
    pages: [
      { path: "/", type: "home", label: "Home" },
      { path: "/directory", type: "directory", label: "Directory" },
      { path: "/records/awesome", type: "record", label: "Record" },
      { path: "/404", type: "404", label: "Not found" },
    ],
  },
});
```

MIT
