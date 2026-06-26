---
title: Open Apps
description: A real-world Grove-powered directory. The reference implementation for the project-directory blueprint.
---

Open Apps is a curated, health-aware directory of production-ready open-source applications — built with Grove and used as the reference implementation for the framework's `project-directory` blueprint.

It is the one space that exercises every part of Grove end to end: the Astro template, the YAML record model, `grove sync github` for live metadata, the GitHub PR workflow for submissions, and the static build pipeline.

## What it shows

- **Hundreds of structured records.** Every entry is a YAML file under `data/records/` with a typed schema (`ProjectRecord`).
- **Search, filters, and detail pages.** Out-of-the-box from the Astro template. URL-driven filters — share `/projects?stack=TypeScript&label=hot` and it renders the same view.
- **GitHub health signals.** Stars, last commit, license, language, archive status are synced automatically and surfaced on every card.
- **Pull-request-based submissions.** Contributors open a PR with a new YAML file; `validate-data.yml` checks the schema before merge.
- **Static deployment.** The whole site is plain HTML + JSON + `llms.txt`. No server, no database.

## Try it

- **Browse the live site:** [github.com/tortuvshin/open-apps](https://github.com/tortuvshin/open-apps)
- **Inspect the data:** every record is a YAML file in [`data/records/`](https://github.com/tortuvshin/open-apps/tree/main/data/records)
- **Submit an entry:** open a PR following the [record schema](/reference/record-schema/)