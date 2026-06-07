# `@grove-dev/cli`

> The Grove command line.

Scaffolds Grove-powered spaces, orchestrates `@grove-dev/core` commands, and runs framework-specific `build` / `dev` against the project's own framework adapter.

```bash
pnpm add -g @grove-dev/cli
```

## Design

The CLI is intentionally **framework-agnostic**. It depends on `@grove-dev/core` and on `commander`, and treats framework adapters (`@grove-dev/astro`, `@grove-dev/nextjs`, `@grove-dev/svelte`) as **optional peer dependencies**. Templates are copied from the framework adapter's `templates/` directory at scaffold time; the CLI does not import or execute framework code at runtime.

This means:

- `pnpm add -g @grove-dev/cli` only pulls in `@grove-dev/core` and `commander`.
- `grove new --framework <f>` requires `<f>`'s adapter to be installed.
- `grove build` and `grove dev` detect the framework from the project's `package.json` and spawn the matching command.

## Commands

| Command | Purpose |
|---|---|
| `grove new [name] --framework <f> [--template <t>] [--deploy <p>]` | Scaffold a new space from a framework template. `--framework` is `astro`, `nextjs`, or `svelte`. `--deploy` is `vercel`, `netlify`, `cloudflare`, `github-pages`, or `none`. |
| `grove import <source>` | Parse a Markdown awesome list (GitHub URL, raw URL, or local path) into `data/resources/*.yml`. |
| `grove analyze [--limit N]` | Fetch GitHub metadata for each resource that has a repository, write `data/health.yml`. |
| `grove validate` | Schema + reference checks. |
| `grove build-data` | Compile `data/resources/*.yml` and `curated.config.ts` into `data/generated/apps.{full,index}.json` and a typed `src/data/config.ts`. |
| `sitemap` | Generate `public/sitemap.xml` from generated data. |
| `grove build-llms-full` | Emit `public/llms.txt` and `public/llms-full.txt`. |
| `grove review` | List cleanup candidates from `data/health.yml` to `data/generated/review-report.json`. |
| `grove enrich [--limit N]` | Token-free HTML-scrape GitHub enrichment (license, language, topics, homepage). |
| `grove build` | Run the project's framework build command. |
| `grove dev` | Start the framework dev server. |

## Scaffolding flow

```bash
grove new my-space --framework astro --deploy vercel
# 1. resolves @grove-dev/astro/templates/default
# 2. copies it into ./my-space
# 3. renames the project in template package.json
# 4. writes curated.config.ts, data/, content/, public/, .github/
# 5. writes deploy.yml for the chosen provider
# 6. writes validate-data.yml, import.yml, issue templates, LICENSE
```

## Peer dependencies

| Peer | Purpose |
|---|---|
| `@grove-dev/astro` *(optional)* | Required for `--framework astro` and `grove build`/`dev` in Astro projects. |
| `@grove-dev/nextjs` *(optional)* | Required for `--framework nextjs` and `grove build`/`dev` in Next.js projects. |
| `@grove-dev/svelte` *(optional)* | Required for `--framework svelte` and `grove build`/`dev` in SvelteKit projects. |

All three are optional. The CLI only complains when you ask for a framework whose adapter is not installed.

## Development

```bash
pnpm --filter @grove-dev/cli build
pnpm --filter @grove-dev/cli check
pnpm --filter @grove-dev/cli dev   # tsx src/index.ts --help
```

## License

MIT
