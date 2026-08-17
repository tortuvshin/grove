---
title: Files are canonical
description: Why Grove starts and ends with source files.
---

# Files are canonical

Every piece of truth in a Grove space lives in a file a human can edit. The build pipeline reads them; every generated artifact (HTML pages, JSON datasets, sitemap, OG images, `llms.txt`) is derived.

This is the single rule that makes Grove different from a CMS:

> If you want to know what is true on the site, look at the files.

The corollary is the discipline it asks for: editors don't log in, they edit. PRs are the change-of-record. Generated artifacts are disposable; running `grove check` regenerates them.

## What this buys you

- **Diffability.** Every change to your site is a `git diff`. Reviewers can read it. Tools can lint it. Backups are `git clone`.
- **Portability.** The state of your space is a folder of files. Move it to a new host, change deployment providers, hand it to a new maintainer. No vendor lock-in.
- **Auditability.** A record changed because someone changed a file. There is no other way it changed.
- **Recoverability.** If a build goes wrong, the build pipeline is reproducible from the source files. There is no operator pager for "the database is in a bad state."

## What this costs you

- **Discipline.** Editors need a git workflow. There is no browser-based WYSIWYG.
- **No realtime.** Changes ship when the next build runs. There is no live preview that the visitor sees.
- **No cross-record transactions.** Saving a record means running `grove check` again, not a single atomic update.

If those costs are too high, a different tool is the right tool. Files-first is a deliberate constraint, not a default.

## The three-tier model

Files in a Grove space fall into one of three tiers — see [Mental model](/start-here/mental-model/):

- **Author-owned** files humans edit by hand.
- **Derived** files Grove regenerates on every build.
- **Refreshed facts** fields that `grove sync github` writes into author-owned files.

The mental-model page walks each tier with examples.

## What you'll edit day-to-day

In a typical day, a curator touches:

- `data/records/<slug>.yml` — adding, renaming, retagging records.
- `data/taxonomy/*.yml` — adding category/stack entries.
- `data/decisions.yml` — overriding visibility, sort priority.
- `content/records/<slug>.md` — writing the long-form body.
- `data/collections/<slug>.yml` — curating a new collection.

Everything else is regenerated.
