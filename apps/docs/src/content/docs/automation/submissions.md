---
title: Community submissions
description: The on-site /submit/ page generates a record draft and a pre-filled GitHub PR link; a human always reviews and merges.
---

Grove's submission surface is the scaffolded `/submit/` page. There is no submission bot and no automated issue-to-PR pipeline in this repository — the page is a client-side draft generator that hands the contributor a pre-filled GitHub link, and every record still lands as a pull request a maintainer reviews.

## How the submit page works

The page (`apps/example/src/pages/submit.astro`, rendered by `SubmissionClient.astro`) walks a contributor through three steps:

1. **Paste a GitHub URL.** Clicking "Generate draft" parses the URL and fetches repo metadata. By default (the static-build path the scaffold ships) this is a **direct browser call** to `https://api.github.com/repos/<owner>/<repo>` — no server, no token. If the response is `404`, the form shows "Repository not found or not public." If it's `403` or `429`, it shows: "GitHub rate limit reached (60 requests/hour per visitor). Try again later or fill the fields manually." Private repos are rejected client-side after the fetch succeeds ("Private repositories cannot be submitted.").

   `SubmissionClient` also accepts an optional `githubProxyPath` prop so an SSR-adapter consumer can route this call through a server endpoint that reads a server-only `GITHUB_TOKEN` (see `packages/astro/src/server/github-repo.ts`) instead of hitting the API from the visitor's browser. The scaffolded `submit.astro` does not pass this prop, so the shipped example always uses the direct, unauthenticated browser call.

2. **Review the auto-filled form.** A successful fetch fills in name, slug, description, primary stack (guessed from language/topics — Flutter/Dart, React Native, Swift/Objective-C → iOS, Kotlin/Java → Android), tags (up to 8, from GitHub topics), and website (from the repo's homepage). The contributor can edit any field; category, platforms, tags, and license inputs only appear if the site's `browse.facets` configuration enables them.

3. **Get the draft.** As the form changes, the client regenerates a `kind: project` YAML draft in the page and validates it:
   - the slug must not already exist among `existingSlugs`,
   - the description must be at least 40 characters,
   - category and stack (if enabled) must be chosen from the site's taxonomy,
   - at least one platform must be checked (if platforms are enabled).

   Any validation failure disables both action buttons and shows the first issue as status text. Once valid, "Copy YAML" copies the draft to the clipboard, and "Open PR draft" opens `<repoUrl>/new/main?filename=data/records/<slug>.yml&value=<yaml>` in a new tab — GitHub's own "create new file" editor, pre-filled with the path and content, which is where GitHub itself takes over the fork/commit/PR flow for a contributor who doesn't have push access.

The generated draft always looks like this shape (fields present depend on which `fields.*` are enabled in `getSubmissionPageModel`):

```yaml
kind: project
slug: ollama
name: "Ollama"
description: "Get up and running with large language models locally."
category: ai
projectType: real-app
stack: "go"
platforms:
  - macos
  - linux
tags:
  - llm
  - local-llm
repoUrl: https://github.com/ollama/ollama
links:
  github: https://github.com/ollama/ollama
  website: https://ollama.com
bestFor:
  []
source:
  type: manual
  owner: ollama
  repo: ollama
curation:
  reviewed: false
  labels: []
  lenses: []
```

`projectType: real-app` is always hardcoded by the generator — the form doesn't expose a way to pick a different project type.

## The submission copy

`grove.config.ts`'s `submission` block drives the page's headline, description, and the "good submissions" / "please avoid" lists (`copy.good` / `copy.avoid`), consumed via `getSubmissionPageModel` in `packages/astro/src/server/models.ts`:

```ts
submission: {
  eyebrow: "AI project submission",
  title: "Add an open-source AI project",
  description:
    "Generate a Grove record from a public GitHub repository, review the AI taxonomy, then open a pull request.",
  good: [
    "A usable open-source AI tool, agent framework, interface, or infrastructure project",
    "A public repository with a clear license and enough documentation to evaluate",
    "A category, stack, and tags chosen from this directory's taxonomy",
  ],
  avoid: [
    "Closed-source AI products or marketing-only landing pages",
    "Prompt collections, tutorials, snippets, or duplicate entries",
    "Abandoned experiments without documentation or a verifiable license",
  ],
},
```

If any field is omitted, `submit.astro` falls back to generic copy hardcoded in the page itself, not to anything from `@grove-dev/core`.

## The freeform issue template

`.github/ISSUE_TEMPLATE/record_submission.md` is a plain Markdown issue template (not a GitHub Issue Forms schema) for contributors who'd rather describe a suggestion than fill out the on-site form. It asks for the same broad shape of information — name, description, category, stack, platforms, project type, links, and a rationale — as free-text fields under Markdown headings, plus a small checklist (public repo, OSI license, maintained in the last 12 months, author-disclosure).

Nothing automated reads this template. Opening an issue with it does not generate a YAML draft, does not comment back, and does not open a PR — a maintainer reads the issue and, if it's in scope, either writes the record by hand or asks the submitter to use `/submit/` instead. `.github/ISSUE_TEMPLATE/bug_report.md` and `feature_request.md` are separate, unrelated templates for site bugs and feature requests.

## Review flow

Once a PR exists — whether opened through the `/submit/` "Open PR draft" link, hand-written from a copied YAML draft, or opened directly — `apps/example/.github/workflows/ci.yml` runs on every PR and push to `main`:

1. `pnpm install --frozen-lockfile`
2. `pnpm exec grove check` — schema validation against every record (including the new one), regenerating artifacts, and (internally) running `astro check`
3. `pnpm build` — the full Astro build

A red CI run blocks merge in the usual GitHub sense (branch protection has to be configured for that; the workflow itself just reports status). Once merged, the new record has no `github.*` block yet — that is filled in by the next scheduled run of [`grove sync github`](/automation/sync-github/), which runs weekly by default. A `health` entry is *not* filled in by anything; see [Maintain health signals](/content/health-classification/).

## What's not automated

- No bot writes, comments on, or closes issues.
- No bot merges PRs. A human always reviews and merges.
- No auto-labeling beyond the static `labels: ["submission"]` on the issue template's own frontmatter.
- `CODEOWNERS` is not part of the scaffolded `apps/example/` site — this repository's own `.github/CODEOWNERS` covers the Grove monorepo itself, not a site built with Grove. If you want required review on `data/records/`, add a `CODEOWNERS` entry yourself.

## Spam and quality gates

- The issue template's `labels: ["submission"]` frontmatter tags every issue opened from it, which you can use to filter or triage.
- `grove check` in CI rejects a PR whose record YAML doesn't match the schema — malformed submissions fail the build rather than merging silently.
- Branch protection requiring the CI check to pass (a GitHub repo setting, not something Grove configures) is the mechanism that actually blocks a bad PR from merging.
- A `CODEOWNERS` entry for `data/records/` (a plain GitHub feature) restricts who can approve changes there — add it if you want it; it isn't shipped by default.

## Related

- [Record schema](/reference/record-schema/) — every field a contributor's YAML draft needs to satisfy
- [`grove check`](/automation/check/) — what the CI gate validates
- [Sync GitHub metadata](/automation/sync-github/) — the enrichment that runs after a record merges
- [Contributing](/maintainers/contributing/) — the contributor-facing walkthrough of this same flow
