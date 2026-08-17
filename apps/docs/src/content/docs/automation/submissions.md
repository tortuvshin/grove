---
title: Community submissions
description: Accept new entries through GitHub issues and review them as pull requests before publishing.
---

Submissions follow a simple principle: **every change is a file, every file is reviewable.** The bot never edits records directly; a human reviewer always merges. This pattern scales better than bot-driven PRs and gives the community a clear point of contact.

## The submission flow

```
Submitter                Issue template          Maintainer              Bot
─────────                ──────────────          ──────────              ────
   │                          │                     │                    │
   │  fills form              │                     │                    │
   ├─────────────────────────►│                     │                    │
   │                          │                     │                    │
   │                          │  renders YAML draft │                    │
   │                          │  + bot response      │                    │
   │                          ├────────────────────►│                    │
   │                          │                     │                    │
   │  copies YAML             │                     │                    │
   │  into a PR               │                     │                    │
   ├──────────────────────────┴────────────────────►│                    │
   │                          │                     │                    │
   │                          │                     │  ci.yml: grove check + astro build
   │                          │                     │◄───────────────────┤
   │                          │                     │                    │
   │                          │                     │  merge + close issue
   │                          │                     │                    │
   │                          │                     │  sync-github.yml: enrich record
   │                          │                     │◄───────────────────┤
   │                          │                     │                    │
   │                          │                     │  deploy.yml: rebuild + redeploy
   │                          │                     │◄───────────────────┤
```

## The scaffolder writes four pieces

After `grove init`, four files wire this up:

### `.github/ISSUE_TEMPLATE/record_submission.md`

```yaml
name: Submit a record
description: Suggest a project, resource, or entity for the directory.
labels: ["submission"]
body:
  - type: input
    id: url
    attributes:
      label: URL
      description: Link to the project (repo, website, or article)
    validations:
      required: true
  - type: input
    id: category
    attributes:
      label: Category
      description: Existing category slug (e.g. ai, web, cli)
    validations:
      required: true
  - type: textarea
    id: description
    attributes:
      label: One-line description
      description: Factual, third-person, under 200 characters.
    validations:
      required: true
  - type: textarea
    id: notes
    attributes:
      label: Notes for the reviewer
      description: Anything that helps the reviewer (links, context).
    validations:
      required: false
```

When a contributor opens an issue with this template, GitHub renders the form. The fields mirror the record schema; the bot reads the form body and renders a YAML draft in a comment.

### `.github/ISSUE_TEMPLATE/bug_report.md` and `feature_request.md`

Generic feedback templates. They don't render a YAML draft; the maintainer triages manually.

### `src/pages/submit.astro`

The on-site submission page. Contributors who don't want to touch GitHub can fill the form on the site; the page generates a pre-filled GitHub issue link (via `?template=record_submission.md&...` query params) and a YAML draft they can copy into a PR.

The on-site form is optional; the issue template alone is enough for the flow.

### `.github/workflows/ci.yml`

Runs on every PR:

1. `pnpm install`
2. `grove check` — schema validation + sitemap + llms generation
3. `pnpm build` — Astro build

If any step fails, the PR can't merge. The maintainer reviews the diff and merges when green.

## Bot behaviour

The scaffold can include `.github/workflows/submission-bot.yml` (optional — opt in by adding it from the template gallery). When enabled, the bot:

1. Watches for new issues with the `submission` label.
2. Reads the form body.
3. Posts a YAML draft as a comment, with a "Create PR" link that pre-fills the record file.
4. Closes the issue when a PR referencing it is merged.

Without the bot, the maintainer writes the YAML by hand. For a directory with < 5 submissions/week, hand-writing is faster than configuring the bot.

## The submission page

The on-site submission page is at `/submit/`. It explains:

- What belongs in the directory (the inclusion criteria).
- What doesn't belong (the exclusion criteria).
- How to open a PR (the contributor path).
- How the review process works.

The page is generated from `grove.config.ts`'s `submission` block:

```ts
submission: {
  eyebrow: "Project submission",
  title: "Suggest an open-source project",
  description: "Generate a record, review it, and open a pull request.",
  good: [
    "Public source and a clear license",
    "Active maintenance (commit within the last 12 months)",
    "Functional software, not vaporware",
  ],
  avoid: [
    "Duplicates of existing records",
    "Marketing-only pages with no working software",
    "Vendor-sponsored forks without an active community",
  ],
},
```

The form on the submission page is a generator, not a submitter — it produces a GitHub issue link the contributor opens in their browser. This is deliberate: it avoids the bot needing write access to your repo, and it works for contributors who don't yet have a fork.

## Anti-patterns to avoid

- **Bot writes the record directly.** Loses human review, breaks the audit trail.
- **Form submits via a third-party service (Formspree, Netlify Forms).** Bypasses the issue tracker; submissions live outside GitHub.
- **A Slack/Discord channel for submissions.** Hard to track, easy to lose.
- **Email submissions.** Same — opaque, easy to lose.

The pattern above keeps every submission in GitHub, where it can be triaged, discussed, and traced back to the contributor.

## Spam protection

GitHub issues are not a high-volume spam target, but a few measures help:

- Require the `submission` label.
- Set a CODEOWNERS entry for `data/records/` — only maintainers can merge.
- The CI gate (`grove check` rejects malformed YAML) is itself a spam filter.
- For high-spam directories, enable [GitHub's required workflows](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-required-status-checks) to require the CI check.

For a directory that needs stricter moderation, add a `.github/ISSUE_TEMPLATE/config.yml` that limits who can open issues:

```yaml
contact_links:
  - name: Maintainer team
    url: https://example.com/contact
    about: For non-submission questions.
```

## What the maintainer does

A typical submission takes 5-10 minutes of maintainer time:

1. Triage the issue — is the project in scope? Has it been submitted before?
2. If yes, write the YAML record (the bot may have written a draft; revise it).
3. Open a PR with the new record file.
4. The CI runs `grove check` + `pnpm build`. If green, merge.
5. The next `sync-github.yml` run enriches the record with stars, license, language.
6. The site rebuilds and the record appears on the index, on category pages, and in `sitemap.xml`.

The whole round-trip from issue-opened to record-live is usually under a week; for an active directory, often under 24 hours.

## Related

- [Author a record](/content/author-a-record/) — the YAML schema a contributor needs
- [Validation](/automation/validation/) — what `grove check` enforces
- [Health classification](/content/health-classification/) — the post-merge enrichment that follows
- [Contributor path](/maintainers/contributing/) — what a contributor sees