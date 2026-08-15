---
title: Philosophy
description: Why Grove is built around files, static output, and reviewable data — and what we are not.
---

Grove is an opinionated system. The opinions are not arbitrary — they're the result of watching a lot of community knowledge spaces grow, age, and break.

If you read one page on this site, read this one. It explains why the rest of the docs are shaped the way they are.

## Files are the source of truth

A Grove space is a folder of YAML and Markdown files. Records live in `data/records/*.yml`. Long-form content lives in `content/records/*.md`. Taxonomy lives in `data/taxonomy/*.yml`. Decisions live in `data/decisions.yml`. The configuration lives in `grove.config.ts`. The history lives in git.

This is a deliberate choice. It means:

- **Every change is reviewable.** A pull request that adds a record shows a diff. A pull request that *deletes* a record shows a diff. A pull request that changes a decision shows a diff.
- **Every change is reversible.** `git revert` works because the source of truth is the file, not a database.
- **Every change is auditable.** Six months later, you can read the PR that introduced a record and see why.
- **A fork is a first-class operation.** If you disagree with the editorial direction of a directory, copy it, change it, and host your own version. The license is MIT.

The cost is that you can't edit records in a web UI in V1. Every record edit is a PR. This is the trade-off. We think the right side of the trade-off is the file.

## Static is the deployment model

Grove builds a folder of HTML, CSS, JS, and JSON. That's the entire output. There's no server, no database connection, no API. The site you see is the result of running `astro build` on a folder of YAML.

This means:

- **Hosting is cheap.** GitHub Pages, Cloudflare Pages, Netlify, S3, a $5 VPS — anything that serves files works.
- **The build is deterministic.** Same input, same output. The site you can build locally is byte-identical to the site the CI builds.
- **The site is fast.** No database query, no server-side render, no cold start. The HTML is the HTML.
- **The site is durable.** A Grove space from 2026 will still work in 2036 as long as the YAML files are intact. No service to keep alive.

The cost is that anything dynamic — search-as-you-type, server-rendered facets, user comments — has to be added by the consumer. The Astro integration's `DirectoryIndexClient` ships a client-side filter enhancer; richer search is the consumer's choice. If you need more, see [Template customization](/customize/template-customization/).

## Health is derived, not declared

A record's status, tier, and visibility are *not* something a maintainer types in. They are computed from the GitHub metadata Grove fetches on every sync run. Stars, last push date, archive state, license — these are the inputs.

This means:

- **The directory is honest by default.** A project that hasn't been touched in 18 months does not show up at the top of the index. A project that was archived upstream shows up as archived. The signal cannot be ignored, because it's not in the maintainer's hand to type.
- **Promotion is a function of adoption.** A new contributor's record starts at `experimental`. It climbs to `listed` at 50 stars, to `curated` at 500 stars, automatically. This is the right side of editorial fatigue.
- **Decisions are explicit.** When the auto-derived value is wrong, the maintainer writes a *decision* — a separate file that says "yes, I see the auto value, and I am overriding it for this reason". The override is auditable. See [Decisions](/sources/decisions/).

The cost is that maintainers must run (or schedule) `grove sync github` to keep health current. The scaffold ships a `sync-github.yml` workflow that runs weekly on a cron. See [Sync deep-dive](/automation/sync-github-deep-dive/) and [Health classification](/sources/health-classification/).

## Review is the gate, automation is the assist

Grove is for *curated* knowledge spaces. Not every entry is good. Not every category is well-defined. Not every "submitted" record deserves a slot.

This means:

- **PRs are reviewed by a human.** A record submission is not auto-merged. The Astro template's submit page generates a YAML draft that the contributor copies into a PR; a maintainer then decides whether the record is a fit. See [Community submissions](/automation/submissions/).
- **The CI runs validation, not judgment.** `grove check` catches typos, wrong enums, missing fields. It does not catch "this is a low-effort SEO submission". That judgment is the maintainer's.
- **Decisions are visible.** When a record is hidden or removed, the decision is in `data/decisions.yml` with a reason. The reason is the maintainer's, not the framework's. A reader can see *why* a record was demoted.
- **The submitter gets a response.** The "report broken record" and "record submission" issue templates are the contract between a maintainer and the community. Both sides know what to expect.

The cost is that you need maintainers. A Grove space without a maintainer reviewing PRs becomes a spam target. This is not a framework problem; it's the same problem as every other wiki. But it's worth saying.

## What Grove is not

The position has edges. Grove is **not**:

- **A directory starter, generator, or template.** A directory is one possible use case — not the product definition.
- **A YAML website builder.** Records are not pages; pages are *outputs* derived from records.
- **An Astro theme.** Grove ships a renderer; the data layer is reusable beyond Astro.
- **A CMS.** There is no web editor, no live preview, no "publish" button. The edit is a PR.
- **A real-time collaboration tool.** No two people can edit the same record at the same time. Use git's normal merge workflow.
- **A general-purpose database.** Records are not queries. Records are not relations. The `tags` field is a denormalized list, not a join.
- **A wiki engine.** Wikis are about prose; Grove is about records. The content body of a record is Markdown, but the heart of the record is its structured fields.
- **A no-code platform.** You write YAML. You run `pnpm build`. You read errors. If that sounds like work, Grove is not for you.
- **A multi-tenant SaaS.** You run your own Grove space. The data lives in your repo. The hosting is yours.

If any of these are dealbreakers, that's fine — use a CMS, a wiki, or a database. Grove is the right tool for a specific kind of community knowledge space, and we think the right kind is the one that wants every change to be a PR.

## How Grove compares to other tools

| Tool | Best for | When to choose Grove instead |
|---|---|---|
| **Hugo** | Single content type, very fast builds | You need *structured* records with taxonomy, scoring, and JSON-LD |
| **Jekyll** | Simple blogs, GitHub Pages native | You need LLM-oriented outputs (`llms.txt`, JSON Feed) out of the box |
| **Eleventy** | Maximum flexibility, minimal JS | You want opinionated blueprints, schema validation, and curation tools |
| **Astro** | Multi-framework static sites | You want a *data layer* (3 blueprints, taxonomy, decisions) on top of the renderer |
| **Next.js / Nuxt** | Server-rendered apps with auth, DBs | Your content is read-mostly, fully static, and benefits from `llms.txt` |
| **Docusaurus** | API/SDK documentation | Your content is *records* (YAML + Markdown), not long-form prose |
| **Mintlify / ReadMe** | Hosted docs with search | You want self-hosted, MIT-licensed, file-first ownership |

## What "supported" means here

This site uses the word carefully.

- **"Supported"** means: the feature works in the current release, the docs cover it, and a maintainer will accept PRs against it.
- **"Planned"** means: not in the current release; tracked in the [Roadmap](/roadmap/).
- **"Roadmap-only"** means: the package or feature does not exist in the workspace today.

The homepage lists the current status. If a doc says "supported" but the code says otherwise, that's a bug — please [open an issue](https://github.com/tortuvshin/grove/issues).
