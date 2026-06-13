# `@grove-dev/cli`

> The Grove command line.

Scaffolds Grove-powered spaces, orchestrates `@grove-dev/core` commands, and runs the framework's `build` / `dev` against the project's own framework adapter.

```bash
pnpm add -g @grove-dev/cli
```

## Design

The CLI is intentionally **framework-agnostic**. It depends on `@grove-dev/core` and on `commander`, and treats the framework adapter (`@grove-dev/astro`) as a peer dependency. Templates are copied from the framework adapter's `templates/` directory at scaffold time; the CLI does not import or execute framework code at runtime.

This means:

- `pnpm add -g @grove-dev/cli` only pulls in `@grove-dev/core` and `commander`.
- `grove new --framework astro` requires `@grove-dev/astro` to be installed.
- `grove build` and `grove dev` detect the framework from the project's `package.json` and spawn the matching command.

## V1 framework scope

`@grove-dev/cli` V1 scaffolds **Astro** projects only. `--framework` accepts `astro` and refuses `nextjs` / `svelte` with a clear error. The Next.js and SvelteKit adapters (`@grove-dev/nextjs`, `@grove-dev/svelte`) still exist as skeleton packages, but their templates are not yet functional (no pages / components / layouts). SvelteKit lands in V1.1; Next.js in V1.2.

## Commands

| Command | Purpose |
|---|---|
| `grove new [name] --framework astro [--template <t>] [--deploy <p>]` | Scaffold a new space from the Astro template. `--deploy` is `vercel`, `netlify`, `cloudflare`, `github-pages`, or `none` (writes a matching deploy workflow + config file). |
| `grove import <source>` | Parse a Markdown awesome list (GitHub URL, raw URL, or local path) into `data/records/*.yml`. |
| `grove validate` | Schema + reference checks. |
| `grove generate` | Compile `data/records/*.yml` and `grove.config.ts` into `data/generated/records.{full,index,site-config}.json`. |
| `grove sitemap` | Generate `public/sitemap.xml` from generated data. |
| `grove llms` | Emit `public/llms.txt` and `public/llms-full.txt`. |
| `grove sync github` | Optional: enrich records with GitHub metadata (stars, forks, last commit, license). |
| `grove cleanup stale` | List cleanup candidates to `data/generated/cleanup-report.json`. |
| `grove workflows sync` | Re-emit GitHub workflow files (with `--force` to overwrite). |
| `grove build` | Run the project's framework build command (`pnpm exec astro build`). |
| `grove dev` | Start the framework dev server (`pnpm exec astro dev`). |
| `grove run [action]` | Dev-internal: scaffold from LOCAL template and run it (`dev` / `build` / `init`). |

## Scaffolding flow

```bash
grove new my-space --framework astro --deploy vercel
# 1. resolves @grove-dev/astro/templates/default
# 2. copies it into ./my-space
# 3. renames the project in template package.json
# 4. writes grove.config.ts, README.md, .gitignore, data/, content/, public/, .github/
# 5. writes the deploy workflow + config file for the chosen provider
#    (vercel → vercel.json + .github/workflows/deploy-vercel.yml;
#     netlify → netlify.toml + .github/workflows/deploy-netlify.yml;
#     cloudflare → wrangler.jsonc + .github/workflows/deploy-cloudflare.yml;
#     github-pages → .github/workflows/build.yml with actions/deploy-pages;
#     none → no deploy workflow)
# 6. writes validate-data.yml, issue templates, LICENSE
```

## Peer dependencies

| Peer | Purpose |
|---|---|
| `@grove-dev/astro` *(required)* | Required for `--framework astro` and `grove build`/`dev` in Astro projects. |

## Development

```bash
pnpm --filter @grove-dev/cli build
pnpm --filter @grove-dev/cli check
pnpm --filter @grove-dev/cli dev   # tsx src/index.ts --help
```

## License

MIT
