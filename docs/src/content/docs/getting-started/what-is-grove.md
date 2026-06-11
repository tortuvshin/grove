---
title: What is Grove?
description: Grove is an open-source framework for building living community knowledge spaces. This page is the 60-second pitch.
---

Grove is a framework for turning plain files into a living community
knowledge space.

A Grove space is:

- a static website
- a structured data repository
- a contributor workflow
- a maintenance system
- an LLM-friendly knowledge source

Grove is **not**:

- a CMS
- a database application
- a hosted SaaS
- a replacement for Product Hunt or Hacker News
- just an awesome-list renderer

## What you can build with Grove

Grove fits problems where a community needs to **curate** a long-lived
list of things — apps, resources, organizations, tools — and the
list needs to **stay useful** over months and years, not days.

Some examples:

- an open-source app directory (curate production-ready OSS apps)
- an AI tools directory (track tools, models, and resources)
- a local ecosystem map (companies, communities, schools in a city or industry)
- an internal knowledge hub (replace ad-hoc spreadsheets with versioned data)
- a learning resource hub (curated guides, courses, books, podcasts)

## Why not just an awesome list?

Awesome lists are great. Grove is a **workflow on top of an awesome
list**, not a replacement.

An awesome list is a single README. Grove gives you:

- **Schema per record.** Every record has typed fields. A `ProjectRecord`
  has `repoUrl`, `stack`, `license`, `bestFor`, `caveats`. A `ResourceRecord`
  has `title`, `type`, `topic`, `author`. Contributors cannot drift.
- **Health signals.** Grove can pull stars, last-commit dates, and
  license metadata from GitHub and surface stale or archived
  records for review.
- **Human curation layer.** A separate `decisions.yml` file holds
  curator judgments — *highlight this, mark that historical, hide
  this until someone looks at it*. The signal and the judgment are
  deliberately separated.
- **Validation.** `grove validate` checks every record against the
  schema. Broken links, missing fields, slug collisions, and stale
  forks all surface in CI.
- **Static output.** The site is plain HTML + JSON + `llms.txt`.
  No server, no database, no JavaScript runtime required. Deploy
  to any CDN.
- **Forkability.** A Grove space is a folder of YAML. To propose a
  change, you open a pull request. To fork the whole space, you fork
  the repo. There is no vendor.

## What Grove is good at

Grove shines when:

- the data is small enough to read in a text editor (hundreds, not
  millions of records)
- the data has structure but not all records are the same
- humans curate the data and need a review surface
- the output should be static, fast, and self-hostable
- the audience includes both humans and LLMs (`llms.txt` is built in)

## What Grove is not good at

Grove is the wrong tool if:

- the data changes many times per minute (use a database)
- contributors need a WYSIWYG editor (use a CMS)
- the site needs server-side logic, auth, or personalization
  (Grove is static-first; adapters like Next.js are roadmap-only in V1)
- the content is unstructured prose with no list-of-things component

## Where to go next

- **[Create a space](/getting-started/create-a-space/)** — scaffold
  your first Grove space in under 10 minutes.
- **[Add your first record](/getting-started/add-your-first-record/)** —
  write a YAML record and see it render.
- **[Blueprints](/concepts/blueprints/)** — the three space shapes
  Grove V1 supports.
