---
title: Generate README
description: Render an awesome-list formatted README block bounded by sentinels.
---

# Generate README

`grove readme generate` renders a `sindresorhus/awesome`-style README from the same record stream used by `llms.txt`. The command writes it between `<!-- grove-readme:start -->` and `<!-- grove-readme:end -->` sentinels in `README.md`. Text outside the sentinel block survives untouched.

## Sentinel block

The README file has two markers:

```markdown
# Site Title

Curator-written intro goes here. This is NOT touched by `grove readme generate`.

<!-- grove-readme:start -->
(generated content goes here, replaced on every run)
<!-- grove-readme:end -->

Curator-written closing thoughts go here. Also NOT touched.
```

When the command runs:

- It reads the existing `README.md`.
- If the sentinel block is present, it replaces only the content between the markers.
- If the sentinel block is missing, it appends the generated content to the end of the file.
- If the file doesn't exist, the command throws.

## Usage

```bash
pnpm exec grove readme generate            # write README.md in place
pnpm exec grove readme generate --stdout   # print to stdout (CI dry-run)
pnpm exec grove readme generate --check    # exit 1 if README drifted from generated
pnpm exec grove readme generate --path CONTRIBUTING.md   # write to a different path
```

## What it produces

The generated block looks like:

```markdown
<!-- grove-readme:start -->

# Title from site.name or readme.title

> Tagline from site.tagline or readme.tagline.

Brief description from site.description or readme.description.

Browse the catalog: https://example.com

## Contents

- [Category A](#category-a)
- [Category B](#category-b)

## Category A

- [Record 1](https://github.com/me/record1) — short description. `MIT`
- [Record 2](https://github.com/me/record2) — short description. `Apache-2.0`

## Category B

...

## Contributing

[Contributions welcome — open a PR against data/records/](https://example.com/contribute)

<!-- grove-readme:end -->
```

## Configuration

`readme.*` in `grove.config.ts` overrides individual fields:

```ts
readme: {
  title: "Awesome Open-Source AI Tools",
  tagline: "Hand-picked tools worth running, studying, and extending.",
  description: "Each tool below is actively maintained, well documented, and useful in production.",
  url: "https://example.com",
  browseLabel: "Browse the catalog →",
  intro: "## Why this list\n\nEach entry is curated by the maintainers.",
  showBadge: true,
  showToc: true,
  showBrowseLink: true
}
```

Unset fields fall back to the matching `site.*` field. `showBadge` controls the sindresorhus-style badge; `showToc` controls the contents section; `showBrowseLink` controls the "browse the catalog" link.

## Categories

The command uses `data/taxonomy/categories.yml` to group records by `category`. Records without a matching `category` are omitted from the README — they're still on the site but the README produces a more compact surface by category.

A category's display label comes from `categories.yml` (`name:` field); each entry inside the category is the record's `name` (for `project`) or `title` (for `resource`, `entity`).

## What survives a re-run

The command does not touch anything between `<!--grove-readme:start -->` and `<!--grove-readme:end -->` markers' *exterior*:

- Curator-written intro above the block.
- Curator-written outro below the block.
- Sections like "Contributing" that live outside the block.
- Custom content pages, custom navigation, custom badges.

If the curator moves a sentinel marker by accident, `grove readme generate --check` exits 1 to alert the maintainer.

## When to use `--check`

`--check` is the CI gate. Wire it into a workflow that runs after a normal README commit:

```yaml
- uses: actions/checkout@v4
- run: pnpm install --frozen-lockfile
- run: pnpm exec grove readme generate --check
```

If the README is behind the latest `data/records/*.yml`, CI fails. The maintainer can either run `grove readme generate` to update, or restore the previous version of README.

## What this page does not promise

- **Edit protection for blocks inside the sentinels** — the generated content is fully rewritten on every run.
- **A separate `CONTRIBUTING.md`** — the command respects `--path` but the generated block is the same shape; if you want a different shape for `CONTRIBUTING.md`, edit the consumer-side write logic.
- **Multi-file output** — one sentinel block per file. If you want multiple generated sections (e.g., a TODO list, a calendar), set them up as separate files.

## See also

- [Outputs overview](/outputs/overview/) — the README block is a derived output.
- [Reference: programmatic API](/reference/api-core/) — `buildAwesomeReadme` and `injectAwesomeReadmeBlock` from `@grove-dev/core`.
- [`packages/core/src/awesome-readme.ts`](https://github.com/tortuvshin/grove) — implementation.
