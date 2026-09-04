# Contributing to Grove

Grove is a file-first publishing system with a strict separation between **engine** packages (imported by consumers at runtime) and **UI registry** (installed into the consumer's source at scaffold time). Keep changes within these boundaries:

- `packages/core` owns schemas, config, validation, generation, search, ranking, taxonomy, GitHub metadata, sitemap, and LLM indexes.
- `packages/astro` owns the Astro integration, server-side view-model builders, and the engine stylesheet. **It no longer ships `.astro` components or layouts.** UI source lives in `packages/registry`.
- `packages/cli` owns `init`, `check`, `sync`, `cleanup`, `audit`, `collection promote`, `readme generate`, and the new `update` command.
- `packages/registry` is the **canonical UI source**. It ships registry scaffolds (`@grove/default` in v1) consumed by `grove init` and updated by `grove update`. Consumers own the resulting `.astro` files in their `src/`.
- `apps/example` is a consumer-installed scaffold for local development and integration tests. It mirrors the registry scaffold byte-for-byte (enforced by `pnpm example:check`).
- `packages/starlight` and `apps/docs` own the documentation integration and site.

Do not add framework adapters, runtime UI subpath exports, or out-of-band template copies. The registry is the single source of truth for consumer-installed UI; engine packages import nothing from it. A directory should differ through config, YAML data, content, public assets, CSS overrides, registry-updated UI, and truly custom pages.

## Development

```bash
pnpm install
pnpm dev
pnpm check
pnpm test
pnpm build
pnpm test:scaffold
pnpm inventory
pnpm check-registry-invariants
```

`pnpm dev` runs `apps/example` directly through workspace links. Do not create a generated playground or use the CLI to develop Grove itself.

When the scaffold changes, edit files under `packages/registry/default/`. `apps/example` regenerates from that source via `scripts/check-example-mirrors-registry.mjs`. The CLI build packages the registry snapshot from `packages/registry` into `@grove-dev/cli` so a fresh `grove init` ships the same UI.

## Pull requests

Keep commits focused, explain the behavior change, and include the commands used to verify it. Add or update tests for schema, CLI, route, or packaging behavior. Never commit generated site data, build output, secrets, or local editor files.

### Commit messages

Commit subjects are [Conventional Commits](https://www.conventionalcommits.org/), and they are the input to the release. release-please reads them to pick the next version and to write `CHANGELOG.md`, so the subject you write is the changelog line a user reads:

```
feat(cli): add `grove update --adopt`
fix(astro): keep the record header legible on narrow viewports
feat(core)!: drop the deprecated `resourceSchema` export
```

- `feat:` is a minor bump, `fix:` / `perf:` / `refactor:` a patch, and a trailing `!` or a `BREAKING CHANGE:` footer a major.
- The scope names the package (`core`, `astro`, `cli`, `starlight`, `registry`), which is how the generated changelog attributes a change.
- `chore:`, `ci:`, `build:`, `test:`, and `style:` are hidden from the changelog. Use them for work with no user-visible effect — and not for work that has one.

There is no `.changeset/` file to add and no `[Unreleased]` section to edit. See [`apps/docs/RELEASING.md`](./apps/docs/RELEASING.md) for what happens after your commit lands.

MIT-licensed contributions are accepted under the repository license.
