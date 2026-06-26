---
title: Philosophy
description: Why Grove is built around files, static output, and reviewable data — and what we are not.
---

Grove is an opinionated framework. The opinions are not arbitrary — they're the result of watching a lot of community knowledge spaces grow, age, and break. This page is the short version of the longer position; the long version lives in [`vision.md`](https://github.com/tortuvshin/grove/blob/main/vision.md) in the repo.

If you read one page on this site, read this one. It explains why the rest of the docs are shaped the way they are.

## Files are the source of truth

A Grove space is a folder of YAML and markdown files. Records live in `data/records/*.yml`. Long-form content lives in `content/records/*.md`. Decisions live in `data/decisions.yml`. The configuration lives in `grove.config.ts`. The history lives in git.

This is a deliberate choice. It means:

- **Every change is reviewable.** A pull request that adds a record shows a diff. A pull request that *deletes* a record shows a diff. A pull request that changes a decision shows a diff.
- **Every change is reversible.** `git revert` works because the source of truth is the file, not a database.
- **Every change is auditable.** Six months later, you can read the PR that introduced a record and see why.
- **A fork is a first-class operation.** Forks aren't a deployment story for the platform; they're a way of life for the data. The model says: if you disagree with the editorial direction of a directory, copy it, change it, and host your own version. The license is MIT.

The cost is that you can't edit records in a web UI in V1. Every record edit is a PR. This is the trade-off. We think the right side of the trade-off is the file.

## Static is the deployment model

Grove builds a folder of HTML, CSS, JS, and JSON. That's the entire output. There's no server, no database connection, no API. The site you see is the result of running `astro build` on a folder of YAML.

This means:

- **Hosting is cheap.** GitHub Pages, Cloudflare Pages, Netlify, S3, a $5 VPS — anything that serves files works. The CLI lists four in `--deploy` (`vercel`, `netlify`, `cloudflare`, `github-pages`) and a `none` for self-hosting.
- **The build is deterministic.** Same input, same output. The site you can build locally is byte-identical to the site the CI builds.
- **The site is fast.** There's no database query, no server-side render, no cold start. The HTML is the HTML.
- **The site is durable.** A Grove space from 2026 will still work in 2036 as long as the YAML files are intact. No service to keep alive.

The cost is that anything dynamic — search-as-you-type, server-rendered facets, user comments — has to be added by the consumer. V1 ships search via Pagefind (a static, build-time index) and not much else. If you need more, see the [Customize the Astro template](/guides/customize-astro-template/) guide.

## Health is derived, not declared

A record's `status`, `tier`, and `visibility` are *not* something a maintainer types in. They are computed from the GitHub metadata Grove fetches on every sync run. Stars, last push date, archive state, license — these are the inputs.

This means:

- **The directory is honest by default.** A project that hasn't been touched in 18 months does not show up at the top of the index. A project that was archived upstream shows up as archived. The signal cannot be ignored, because it's not in the maintainer's hand to type.
- **Promotion is a function of adoption.** A new contributor's record starts at `experimental`. It climbs to `listed` at 50 stars, to `curated` at 500 stars, automatically. This is the right side of editorial fatigue.
- **Decisions are explicit.** When the auto-derived value is wrong (a feature-complete library that hasn't shipped in two years, a transferred repo), the maintainer writes a *decision* — a separate file that says "yes, I see the auto value, and I am overriding it for this reason". The override is auditable. See [Manage decisions](/guides/manage-decisions/).

The cost is that maintainers must run (or schedule) `grove sync github` to keep health current. V1 ships the workflow for this when you scaffold with `--github public`. See [Sync GitHub metadata](/guides/sync-github-metadata/).

## Review is the gate, automation is the assist

Grove is for *curated* knowledge spaces. Not every entry is good. Not every category is well-defined. Not every "submitted" record deserves a slot.

This means:

- **PRs are reviewed by a human.** A record submission is not auto-merged. The CLI's `submit` flow generates a record file, but the PR is reviewed by a maintainer who decides whether the record is a fit. See [Contributing](/maintainers/contributing/) for the contributor's side of this.
- **The CI runs validation, not judgment.** `grove validate` catches typos, wrong enums, missing fields. It does not catch "this is a low-effort SEO submission". That judgment is the maintainer's.
- **Decisions are visible.** When a record is hidden or removed, the decision is in `data/decisions.yml` with a reason. The reason is the maintainer's, not the framework's. A reader can see *why* a record was demoted.
- **The submitter gets a response.** The "report broken record" issue template and the "record submission" issue template are the contract between a maintainer and the community. Both sides know what to expect.

The cost is that you need maintainers. A Grove space without a maintainer reviewing PRs becomes a spam target. This is not a framework problem; it's the same problem as every other wiki. But it's worth saying.

## What we are not

The position has edges. Grove is **not**:

- **A CMS.** There is no web editor, no live preview, no "publish" button. The edit is a PR.
- **A real-time collaboration tool.** No two people can edit the same record at the same time. Use git's normal merge workflow.
- **A general-purpose database.** Records are not queries. Records are not relations. The `tags` field is a denormalized list, not a join.
- **A wiki engine.** Wikis are about prose; Grove is about records. The content body of a record is markdown, but the heart of the record is its structured fields.
- **A no-code platform.** You write YAML. You run `pnpm build`. You read errors. If that sounds like work, Grove is not for you.
- **A multi-tenant SaaS.** You run your own Grove space. The data lives in your repo. The hosting is yours.

If any of these are dealbreakers, that's fine — use a CMS, a wiki, or a database. Grove is the right tool for a specific kind of community knowledge space, and we think the right kind is the one that wants every change to be a PR.

## What "supported" means here

This site uses the word carefully. "Supported" means: the feature works in the current release, the docs cover it, and a maintainer will accept PRs against it. "Schema-ready" means: the Zod schema exists and the CLI accepts the data, but no polished template ships. "Roadmap" means: not in the current release; tracked in the [Roadmap](/roadmap/).

The homepage lists the current status. If a doc says "supported" but the code says otherwise, that's a bug — please [open an issue](https://github.com/tortuvshin/grove/issues). See the [Blueprints](/concepts/blueprints/) page for the current status of each blueprint, and the [Astro adapter](/adapters/astro/) / [Next.js adapter](/adapters/nextjs/) / [SvelteKit adapter](/adapters/svelte/) pages for the adapter status.
