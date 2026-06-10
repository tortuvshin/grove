# Contributing to Grove

First off, thank you for taking the time to contribute. Grove is an open-source framework for growing useful community knowledge, and every report, fix, idea, and PR makes it better for the people who rely on it.

This document covers the everyday workflow. For the deeper release / governance mechanics, see [`docs/RELEASING.md`](./docs/RELEASING.md) and the architecture overview in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Code of conduct

By participating, you agree to abide by our [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md). Please read it before you start.

---

## How can I help?

There are a lot of ways to contribute, and you don't have to write code to be useful.

- **Report a bug** — open an issue with a minimal reproduction.
- **Suggest a feature** — open an issue and describe the use case, not just the solution.
- **Improve the docs** — typo, missing example, clearer wording — all welcome.
- **Submit a resource or fix a record** — file an issue or PR in one of the [example spaces](./examples) or in a downstream space you maintain.
- **Triage issues** — reproduce a report, add missing context, suggest labels.
- **Write code** — see the area guides below.

If you're new, look for issues labelled [`good first issue`](https://github.com/tortuvshin/grove/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) or [`help wanted`](https://github.com/tortuvshin/grove/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22).

---

## Project layout

Grove is a pnpm workspace with six published packages and three side directories:

```txt
grove/
├── packages/
│   ├── core/       # Headless engine: schema, config, importers, validators, sitemap, llms.txt
│   ├── ui/         # Framework-agnostic UI primitives (filters, sort, stats) — roadmap only
│   ├── cli/        # `new`, `import`, `analyze`, `validate`, `build`, `dev`
│   └── astro/      # Astro adapter (components, layouts, tokens, template)
│       nextjs/     # Next.js adapter
│       svelte/     # SvelteKit adapter
├── examples/       # Real Grove-powered spaces (oss-dev-mn, open-apps, ...)
├── docs/           # Framework documentation site (Starlight)
└── scripts/        # release.mjs, test-scaffold.mjs
```

Each package is published independently under `@grove-dev/*`. Changes that affect multiple packages usually need updates in the right order: `core` → `ui` → `astro` / `nextjs` / `svelte` → `cli`.

---

## Development setup

### Prerequisites

- **Node.js** `>=20`
- **pnpm** `10.x` (the repo pins `packageManager` to `pnpm@10.12.1` — use Corepack to match: `corepack enable && corepack prepare pnpm@10.12.1 --activate`)
- A POSIX shell (macOS, Linux, or WSL)

### Clone and install

```bash
git clone https://github.com/tortuvshin/grove.git
cd grove
pnpm install
```

### Useful commands

```bash
# Build every package (tsc only — adapters copy assets during the CLI scaffold step)
pnpm -r build

# Type-check without emitting
pnpm -r check

# Run the CLI in dev mode (tsx)
pnpm --filter @grove-dev/cli dev

# Run the docs site locally
pnpm dev:docs

# Scaffold a smoke-test space into a temp dir
pnpm test:scaffold
```

### Working on a single package

```bash
# Build only one package
pnpm --filter @grove-dev/core build

# Watch + REPL-friendly mode for the CLI
pnpm --filter @grove-dev/cli dev

# Inspect what the CLI actually does against a real scaffold
node packages/cli/dist/index.js new examples/my-test --framework astro --deploy github-pages
```

---

## Coding conventions

- **Language** — TypeScript everywhere. Plain JS in `scripts/*.mjs` is fine for tooling.
- **Module system** — ESM (`"type": "module"` in every `package.json`).
- **Style** — Prettier is the source of truth (config at the root). Do not bikeshed formatting in review.
- **Naming** — `camelCase` for variables/functions, `PascalCase` for types and React/Svelte components, `kebab-case` for filenames of CLI flags and config keys.
- **Imports** — keep them sorted, no default-export components if a named export is enough.
- **No `any`** unless a third-party type forces it; add a comment if you must.
- **Comments** — explain *why*, not *what*. A reader who already knows the language doesn't need a translation of the code.

Editor setup:

- VS Code: the repo includes no `.vscode/` to avoid overriding your own setup. Recommended extensions: **ESLint**, **Prettier**, **Astro**, **Svelte**, **Stylelint**.
- The `.editorconfig` at the root sets indent style per file type.

---

## Tests

Right now the test posture is **honest and minimal**:

- `pnpm -r test` runs per-package test scripts. Most currently `echo "No <pkg> package tests yet"` — that's a real status, not a stub we forgot to fill in.
- `pnpm test:scaffold` (`scripts/test-scaffold.mjs`) builds every package, then runs the freshly built CLI in a temp dir to scaffold a space per framework and assert the install works. **This is the only test that catches the "did the tarball rewrite `workspace:*`?" regression class.** Add a case here whenever you change template content, the scaffold flow, or the release script.

When you add new tests, prefer fast unit tests in the affected package over a top-level integration test.

---

## Pull request workflow

1. **Open an issue first** for non-trivial changes — features, refactors, anything that touches the public API. Bug fixes can usually skip this step.
2. **Branch off `main`** with a descriptive name:
   - `feat/core-add-license-detection`
   - `fix/cli-scaffold-windows-paths`
   - `docs/clarify-architecture-section`
3. **Keep the diff small.** One concern per PR. Several small PRs beat one big one.
4. **Run the local gates** before pushing:
   ```bash
   pnpm -r build
   pnpm -r check
   pnpm test:scaffold
   ```
5. **Write a good PR description.** Use the template (`.github/PULL_REQUEST_TEMPLATE.md` will load automatically). Explain the *why*, link the issue, and include a "How I tested" section.
6. **One approval + green CI** is the bar for merging. If your PR sits idle for more than a week, ping in a comment — we may have missed the notification.
7. **Squash-merge** by default. The PR title becomes the commit subject; the body becomes the extended description.

### Commit messages

We don't enforce a strict convention, but a Conventional Commits-style prefix helps the changelog tool later:

```txt
feat: add `grove add` command for appending a single resource
fix(cli): handle Windows path separators in scaffold template
docs: clarify the three-layer architecture
chore: bump @grove-dev/core to 0.2.3
```

---

## Adding a new framework adapter

This is the most common "big" contribution. The pattern is documented in `docs/ARCHITECTURE.md`, but the short version:

1. Create `packages/<framework>/` with a `package.json` named `@grove-dev/<framework>`.
2. Add a `peerDependencies` block for the framework version range.
3. Implement `src/index.ts` re-exporting the components/layouts from `src/components` and `src/layouts`.
4. Add a `templates/default/` containing the user-facing scaffold: pages, layouts, `curated.config.ts`, `astro.config.mjs` (or framework equivalent), and a starter `data/resources/` with one example record.
5. Add a `tests` block in `scripts/test-scaffold.mjs` that scaffolds the new framework into a temp dir and asserts `pnpm install` succeeds.
6. Add the package to `pnpm-workspace.yaml` (it's already a wildcard, but verify) and to the release script's `PACKAGES` array.
7. Update the root `README.md` "Repository layout" section and the docs site's framework list.

If you want, open an issue first describing the adapter and we'll help shape the API surface before you write a lot of code that has to be redone.

---

## Adding a new resource to a Grove-powered space

This is for contributors to **downstream spaces** (e.g. `examples/openapps`, `examples/grove-demo`), not the framework itself:

- A resource is a single YAML file in `data/resources/`. Look at the existing records for the schema.
- Validate locally with `grove validate` (or the `pnpm` script in the space's `package.json`).
- Open a PR. The space maintainer reviews, may ask for a `homepage` or `license` field, and merges.
- For new **categories** or **topics**, edit `data/taxonomy/` and add a short blurb in `content/methodology.mdx` if the space has one.

---

## Reporting security issues

**Please do not file a public issue.** Email **toroo.byamba@gmail.com** (see [`SECURITY.md`](./SECURITY.md) for the full policy). We'll respond within 72 hours.

---

## License

By contributing, you agree that your contributions will be licensed under the **MIT License** (see [`LICENSE`](./LICENSE)). The CLA / DCO story is intentionally light — Grove is small enough that an explicit license grant per file would just be noise.

Thanks again for helping Grove grow.
