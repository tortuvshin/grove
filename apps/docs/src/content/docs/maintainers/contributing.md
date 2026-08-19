---
title: Contributing
description: How a contributor submits a record to a Grove-powered directory — the record template, the PR template, what review looks for.
---

This page is the contributor's path. The maintainer's path is in
[Governance](/maintainers/governance/).

The mechanics of writing a record are in
[Author a record](/content/author-a-record/). This page covers the
*editorial* side: what a reviewer is looking for, what's likely to be
rejected, and how to write a PR that lands on the first try.

## Two ways to contribute

- **Open an issue** with the `record_submission` template. The
  template asks for the URL, the category, and a one-line description.
  A maintainer reviews the issue and either asks for more context or
  scaffolds the record PR for you.
- **Open a PR directly** with a new `data/records/<slug>.yml` file.
  This is faster for experienced contributors. If your PR is
  well-formed, a maintainer reviews and merges.

Most first-time contributors start with the issue. Most repeat
contributors open PRs directly.

## What goes in a good record

The fields a reviewer is most likely to scrutinize:

- **`name` / `title`** — the project's official name, not the
  maintainer's preferred phrasing. "Astro", not "Astro — the awesome
  static site builder".
- **`description`** — one or two sentences, in the third person,
  factual. No marketing language, no "best in class", no
  superlatives.
- **`category`** — a single, existing category. New categories are
  easy to add but they look like orphans until the second record
  joins. Mention new categories in the PR description.
- **`repoUrl`** — the canonical GitHub URL. Not the GitHub Pages
  URL, not the docs URL. The repo URL.
- **`projectType`** — pick the closest value from the enum:
  `real-app`, `production`, `reference`, `library`, `tool`, `demo`,
  `template`, `historical`.
- **`tags`** — 2-5 tags. Match the existing tag vocabulary.
- **`bestFor` / `whyListed` / `caveats`** — optional, but they are
  the difference between a record that says "Astro is a static site
  generator" and one that says "Astro is a content-first static site
  generator, ideal for docs and marketing sites".

A record with only the required fields will validate, build, and
render. A record with thoughtful `bestFor` / `whyListed` / `caveats`
is the kind a directory is built from.

## What the reviewer is checking

In approximate order of importance:

1. **Does the project exist and is the URL correct?** A 404 on the
   repo is an instant rejection.
2. **Is the project a fit for this directory?** Every directory has
   a scope.
3. **Is the description accurate and unbiased?** Marketing language
   ("the world's best", "industry-leading") is a soft reject.
4. **Is the project actively maintained?** A project that hasn't seen
   a commit in 18+ months is still listable, but the reviewer will
   mark it `historical` via a decision in the same PR.
5. **Is the `category` right?** A miscategorized record clutters the
   index.
6. **Are the `bestFor` / `whyListed` fields substantive?** "Great
   for everyone" is not a `bestFor`.

The reviewer's job is not to be a gatekeeper; it's to be the editor.
A good review leaves the record better than the contributor sent it.

## The PR template

The repository's `.github/PULL_REQUEST_TEMPLATE.md` has the
structure. For a record PR, the relevant sections are:

```markdown
## Summary
<!-- One paragraph. What does this PR change, and why? -->

## Linked issue
<!-- "Closes #123" or "Refs #456" — leave blank if there is no issue. -->

## Type of change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [x] Documentation / docs site
- [x] Template / scaffold content
- [ ] Chore

## How I tested
<!-- For a record PR, "I clicked the repoUrl and the website link,
     and the description is taken from the project's README intro."
     is usually enough. -->

## Checklist
- [x] I read CONTRIBUTING.md and followed the local gates.
- [x] I added / updated tests where it made sense.
- [x] I updated the relevant docs (README, docs site, JSDoc).
- [x] I bumped the right package versions (only if the user-facing
      API changed; otherwise the release script handles it).
```

A PR that fills these out takes the reviewer 30 seconds to process.

## Common rejection reasons

- **The repo URL 404s or is wrong.** Check the URL by visiting it
  before opening the PR.
- **The record is a duplicate.** Search the index first. If a record
  for the project already exists, edit the existing one.
- **The description is marketing copy.** "The world's most
  powerful..." is a soft reject.
- **The `category` doesn't fit.** Look at the existing categories and
  pick the closest.
- **The project is too new.** A project with no GitHub stars and no
  history is listable, but the reviewer's bar is higher.
- **The project is too old / unmaintained.** A project that hasn't
  been touched in 5 years is a `historical` decision.
- **The PR bundles multiple records.** One record per PR.
- **The record edits an existing record's `health` block by hand.**
  Don't. The health block is auto-derived. See
  [Sync GitHub metadata](/automation/sync-github/).

## What happens after the PR lands

1. **CI runs `grove check` and `pnpm build`.** The record has to
   pass schema validation and the build has to succeed. If either
   fails, the reviewer asks for a fix.
2. **The maintainer merges.** Squash-merge is the default; the PR
   title becomes the commit subject.
3. **The next `grove sync github` run enriches the record.** If your
   site has `integrations.github: public`, this happens on a schedule
   (default weekly). The record picks up stars, contributors,
   language, license.
4. **The site rebuilds.** The Astro build picks up the new record on
   the next deploy. The record appears on the index, on category
   pages, and on `sitemap.xml`.

The whole round-trip — PR opened to record live — is usually under a
week. For an active directory, often under 24 hours.

## If your PR is rejected

Don't take it personally. The most common reasons for rejection are
scope, not quality.

- **If the rejection is "out of scope":** thank the reviewer, look
  for a more appropriate directory, and submit there. Grove is a
  framework; the data lives in many directories.
- **If the rejection is "needs changes":** read the reviewer's notes,
  push a fix, and reply in the PR thread.
- **If you disagree with the rejection:** reply in the PR thread with
  the specific point of disagreement.

## What this page is not

This page covers the contributor's path for a *record submission*.
For contributing to the framework itself (`@grove-dev/*` packages),
the rules are different — see the
[framework's CONTRIBUTING.md](https://github.com/tortuvshin/grove/blob/main/CONTRIBUTING.md).
For contributing to the docs site, see
[docs site README](https://github.com/tortuvshin/grove/tree/main/apps/docs/README.md).

The three paths share the same `Code of Conduct` and the same
etiquette, but the review bars, the test gates, and the merge
criteria are all different.

## CI gates for framework contributors

If you are opening a PR against `@grove-dev/core`, `@grove-dev/cli`,
`@grove-dev/astro`, or `@grove-dev/starlight`, a different set of
gates applies. What actually blocks a merge today, from
`.github/workflows/ci.yml`:

- **Build** — every workspace package builds.
- **Unit tests** — `pnpm test` (Vitest) must pass.
- **Scaffold test** — `pnpm test:scaffold` verifies `grove init`
  produces a working space.
- **Repo hygiene** — no committed `.DS_Store`, no stray
  `workspace:*` in published package manifests, `pnpm docs:check`
  (docs contract, sidebar orphans, internal links), and a check
  that the committed icon set is exactly what the sync script
  regenerates.

Lighthouse budgets run in a separate workflow when a PR touches
the core packages or `apps/example`.

[CI & quality](/maintainers/ci-quality/) covers the full
configuration, including the tooling that is configured in the
repo but not yet enforced in CI.

The contributor path for a *record* (this page) runs none of
these; its gate is `grove check --strict`.
