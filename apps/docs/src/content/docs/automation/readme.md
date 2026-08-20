---
title: Generate README
description: Render an awesome-list formatted README block bounded by sentinels.
---

`grove readme generate` renders a `sindresorhus/awesome`-style README from `data/records/*.yml` and `data/taxonomy/categories.yml`, using its own record loader (a separate, simpler pass over the YAML files, not the same normalized pipeline that feeds the site or `llms.txt`). The command writes the result between `<!-- grove-readme:start -->` and `<!-- grove-readme:end -->` sentinels in `README.md`. Content outside the sentinel block survives untouched.

## Sentinel block

The generated block is not just a list of entries — it is a full markdown document: an H1, an optional badge, a tagline, an optional "browse the directory" link, an optional hand-written intro, a Contents TOC, and one `##` section per category. All of that is regenerated as a unit and lives *inside* the sentinels.

A README using this looks like:

```markdown
<!-- grove-readme:start -->
# Awesome Open-Source AI Tools

[![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

Hand-picked tools worth running, studying, and extending.

Browse the full directory → https://example.com

## Contents

- [Category A](#category-a)
- [Category B](#category-b)

## Category A

- [Record 1](https://github.com/me/record1) - short description.
- [Record 2](https://github.com/me/record2) - short description.

## Category B

...
<!-- grove-readme:end -->

## Contributing

Contributions welcome — open a PR against `data/records/`.
```

Everything from `## Contributing` down in that example — license text, a Contributing section, custom badges, whatever you write — sits after `<!-- grove-readme:end -->` and is written once, never touched by `grove readme generate` again.

Because the generated block already carries its own H1, don't also hand-write a title above `<!-- grove-readme:start -->` — you'd end up with two headings. If you want a curated lead paragraph, use the `readme.intro` config field (below) instead; it's rendered inside the block.

## Usage

```bash
pnpm exec grove readme generate            # write README.md in place
pnpm exec grove readme generate --stdout   # print to stdout (CI dry-run)
pnpm exec grove readme generate --check    # exit 1 if README drifted from generated
pnpm exec grove readme generate --path CONTRIBUTING.md   # write to a different path
```

A normal run prints:

```text
[grove readme] wrote README.md (12 records, 4 categories)
```

`--check` prints one of two lines and sets the exit code on drift:

```text
[grove readme] README.md is up to date.
[grove readme] README.md is out of date. Run 'grove readme generate' to update.
```

If `README.md` doesn't exist yet, the command does **not** throw — a missing file is treated as empty, and `generate` creates it with the sentinel block appended.

## How an entry is rendered

Each visible record becomes one line:

```
- [Label](url) - Description.
```

- **Label** is the record's `name` field, falling back to its `slug` if `name` is unset.
- **url** is `homepageUrl` if the record has one, otherwise `repoUrl`. If neither is set, the entry renders as plain text with no link.
- **Description** is the record's `description`, whitespace-collapsed, with any trailing punctuation stripped and a single period appended. If there's no description, the entry is just `- [Label](url)` with no trailing dash.

Stars, license, and other GitHub metadata are not rendered on the entry line — the generator only reads `slug`, `name`, `description`, `category`, `repoUrl`/`links.github`, `homepageUrl`/`links.website`, and `visibility` from each record file.

A record is skipped entirely (not printed anywhere) when its `visibility` field is `"hide"` or `"remove"`, or when it has neither a `name` nor a `slug` to label it with.

:::caution[decisions.yml is not consulted]
The site build applies `data/decisions.yml` overrides and, for `project` records, derives effective visibility from `health.visibility` — that's the pipeline behind the live site and `llms.txt`. `grove readme generate` does none of that: it reads only the record file's own top-level `visibility` field directly. A project hidden site-wide through `data/decisions.yml` can still show up in the README unless that record's YAML also sets `visibility: hide` (or `remove`) itself.
:::

## Categories

The command uses `data/taxonomy/categories.yml` to group records by `category`, and orders sections the same way categories are declared in that file. A category's display heading comes from the matching `name:` field in `categories.yml`.

- Records with **no `category` field at all** are dropped from the README — they don't get an "Other" section.
- Records whose `category` value doesn't match any id in `categories.yml` are **not** dropped — they still get their own section, titled by title-casing the category id (e.g. `dev-tools` → "Dev Tools").

## Configuration

`readme.*` in `grove.config.ts` lets a curator override the generated preamble without touching generated content:

```ts
readme: {
  title: "Awesome Open-Source AI Tools",
  tagline: "Hand-picked tools worth running, studying, and extending.",
  description: "Each tool below is actively maintained, well documented, and useful in production.",
  url: "https://example.com",
  browseLabel: "Browse the full directory →",
  intro: "## Why this list\n\nEach entry is curated by the maintainers.",
  showBadge: true,
  showToc: true,
  showBrowseLink: true,
}
```

Every field is optional. Fallback behavior:

- `title` falls back to `site.name`.
- **Only one of `tagline` or `description` is ever rendered**, as a single line, in this priority order: `readme.tagline` → `readme.description` → `site.tagline` → `site.description`. Setting both `readme.tagline` and `readme.description` does not produce two lines — `readme.tagline` wins and `readme.description` is ignored.
- `url` falls back to `site.url`. If no URL resolves (from either field), the browse line is omitted even when `showBrowseLink` is true.
- `browseLabel` has no `site.*` fallback — it defaults to the literal string `"Browse the full directory →"`.
- `intro` has no fallback; when unset, no intro section is rendered.
- `showBadge`, `showToc`, and `showBrowseLink` each default to `true`.

## What survives a re-run

Only content strictly **before** `<!-- grove-readme:start -->` or strictly **after** `<!-- grove-readme:end -->` is left alone — everything between the two markers, including the H1 the generator writes, is fully replaced on every run.

If the sentinel pair goes missing or gets edited so the pattern no longer matches (e.g. only one marker survives), `grove readme generate` doesn't fail — it silently appends a fresh sentinel block to the end of the file, which can leave two copies of the generated content in `README.md`. Running with `--check` first is the way to catch that before it happens, since `--check` treats any file that doesn't already contain byte-identical sentinel content as out of date and exits 1.

## When to use `--check`

`--check` is a CI gate you wire in yourself — it is not part of any workflow Grove ships by default. A pattern that matches the shipped `ci.yml` steps:

```yaml
- uses: actions/checkout@v4
- uses: pnpm/action-setup@v4
- uses: actions/setup-node@v4
  with:
    node-version: "24"
    cache: pnpm
- run: pnpm install --frozen-lockfile
- run: pnpm exec grove readme generate --check
```

If the README is behind the latest `data/records/*.yml`, this step fails. The maintainer runs `grove readme generate` locally (or via the shipped `readme.yml` workflow — see [Scheduled maintenance](/automation/scheduled/)) and commits the result.

## What this page does not promise

- **Edit protection for content inside the sentinels** — everything between the markers, including the heading, is fully rewritten on every run.
- **A separate shape for `CONTRIBUTING.md`** — `--path` writes to a different file, but the generated block is exactly the same shape as for `README.md`.
- **Multi-file output** — one sentinel pair per file. Generating more than one derived file means running the command against more than one `--path`.

## See also

- [Scheduled maintenance](/automation/scheduled/) — how `readme.yml` runs this on a schedule and opens a PR.
- [Outputs overview](/outputs/overview/) — the README block is a derived output.
- [Reference: programmatic API](/reference/api-core/) — `buildAwesomeReadme` and `injectAwesomeReadmeBlock` from `@grove-dev/core`.
- [`packages/core/src/awesome-readme.ts`](https://github.com/tortuvshin/grove/blob/main/packages/core/src/awesome-readme.ts) — implementation.
