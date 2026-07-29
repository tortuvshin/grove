# Contributing to Grove

Grove intentionally has one supported application architecture. Please keep changes within these boundaries:

- `packages/core` owns schemas, config, validation, generation, GitHub metadata, sitemap, and LLM indexes.
- `packages/astro` owns the complete web application, routes, loaders, components, layouts, and styles.
- `packages/cli` owns only `init`, `check`, `sync`, `cleanup`, `audit`, `collection promote`, and `readme generate`.
- `apps/example` is both the real AI demo and the only scaffold source.
- `packages/starlight` and `apps/docs` own the documentation integration and site.

Do not add framework adapters, template variants, blueprint registries, copied consumer components, or consumer maintenance scripts. A directory should differ through config, YAML data, content, public assets, CSS overrides, and truly custom pages.

## Development

```bash
pnpm install
pnpm dev
pnpm check
pnpm test
pnpm build
pnpm test:scaffold
```

`pnpm dev` runs `apps/example` directly through workspace links. Do not create a generated playground or use the CLI to develop Grove itself.

When the scaffold changes, edit `apps/example` and run `pnpm test:scaffold`. The CLI build packages a clean snapshot from that same directory; there is no second template to update.

## Pull requests

Keep commits focused, explain the behavior change, and include the commands used to verify it. Add or update tests for schema, CLI, route, or packaging behavior. Never commit generated site data, build output, secrets, or local editor files.

MIT-licensed contributions are accepted under the repository license.
