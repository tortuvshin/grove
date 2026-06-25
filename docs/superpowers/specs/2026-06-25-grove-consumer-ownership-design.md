# Grove Consumer Ownership Design

## Goal

Make Grove-generated applications thin consumers: Grove owns taxonomy display
metadata, maintenance commands, generated discovery files, and CI workflow
defaults. Consumers own records, editorial content, configuration, and only
genuinely application-specific scripts.

## Root causes

1. Taxonomy YAML is validated but not included in generated site configuration.
   Astro therefore renders record IDs using generic title-casing instead of the
   configured taxonomy names.
2. The Astro template ships fifteen scripts. Several only proxy Grove CLI
   commands; others are old migration or repair utilities. `grove sync
   contributors` even shells back into a consumer script.
3. Generated workflows specify pnpm twice (`packageManager` and action
   `version`) and pin Node 20, causing current GitHub Actions failures.

## Design

### Taxonomy contract

`@grove-dev/core` loads YAML arrays from `config.paths.taxonomyDir` and emits a
normalized `taxonomy` object in `data/generated/site-config.json`:

```ts
type TaxonomyItem = {
  id: string;
  name: string;
  [key: string]: unknown;
};

type GeneratedTaxonomy = {
  categories: TaxonomyItem[];
  stacks: TaxonomyItem[];
  platforms: TaxonomyItem[];
  distributionChannels: TaxonomyItem[];
};
```

The Astro records module exposes lookup helpers. Home grids and filter facets
use configured names while URLs and filters continue using stable IDs.

### Framework-owned commands

The default consumer package uses only Grove CLI commands:

```json
{
  "validate:data": "grove validate",
  "build:data": "grove generate",
  "build:sitemap": "grove sitemap",
  "build:llms": "grove llms",
  "sync:github": "grove sync github",
  "sync:contributors": "grove sync contributors",
  "cleanup": "grove cleanup stale"
}
```

`grove sync contributors` becomes a real CLI/core capability and writes
`data/generated/contributors.json`. Generic wrapper, migration, repair, seeding,
enrichment, and icon-fetch scripts are removed from the default scaffold.

### Workflow runtime

Every generated workflow uses:

```yaml
- uses: pnpm/action-setup@v4
- uses: actions/setup-node@v4
  with:
    node-version: "24"
    cache: pnpm
```

The pnpm action receives no `version`; `packageManager` is the sole pnpm version
source.

## Verification

- Core generation test proves taxonomy names reach `site-config.json`.
- Astro template test proves taxonomy labels are consumed and scripts are not
  scaffolded.
- CLI workflow tests prove Node 24 and no duplicate pnpm version.
- Contributor sync unit tests use a fake fetch implementation and temporary
  generated index.
- Full `pnpm test`, `pnpm check`, `pnpm build`, and `pnpm test:scaffold` pass.

