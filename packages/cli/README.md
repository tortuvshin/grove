# `@grove-dev/cli`

The deliberately small CLI for Grove directories.

```bash
pnpm dlx @grove-dev/cli init my-directory
```

## Commands

- `grove init [directory]` copies the canonical working Grove site and installs it.
- `grove check [--strict]` validates YAML, prepares artifacts, and runs `astro check`.
- `grove sync github` refreshes record repository metadata.
- `grove sync contributors` refreshes directory-community metadata.
- `grove cleanup [--strict]` writes the human-review report.

There are no framework, blueprint, template, deployment, build, or dev commands. Use Astro's normal `pnpm dev` and `pnpm build`; the integration prepares data automatically. The CLI bundles a release snapshot of the repository's real `site/`, so the demo and generated project cannot drift into separate implementations.

MIT
