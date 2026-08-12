---
title: Introduction
description: Grove turns structured files into a fast, searchable, contributor-friendly community knowledge space. A 60-second pitch.
---

Grove is a framework for building structured community directories.

It gives you:

- a ready-to-use directory website
- YAML-based project records
- search and filtering
- GitHub metadata updates
- pull-request-based submissions
- static deployment

Grove currently supports **project directories** built with **Astro**. Two more blueprints (resource-hub and ecosystem-map) ship schemas today and land polished templates in V1.1.

## What you can build

Grove fits problems where a community needs to curate a long-lived list of things — apps, tools, libraries, guides, organizations — and keep that list useful over months and years, not days.

Examples:

- an open-source app directory
- a developer tools index
- a local ecosystem map (cities, communities, schools)
- an internal knowledge hub (replacing spreadsheets with versioned data)
- a curated learning resources collection

## How it works

You start with `pnpm dlx @grove-dev/cli@latest init my-directory`. There are no prompts: the CLI copies the complete Astro example space — records, taxonomy, `grove.config.ts`, and GitHub Actions for validation, sync, and deployment — and renames it to your project. Run `pnpm install && pnpm dev` and the dev server starts at `http://localhost:4321`.

You add records as YAML files under `data/records/`. You push a pull request. `validate-data.yml` checks the schema. Merge. `build.yml` deploys.

Every record is a file. Every change is reviewable. The site is static. There is no database, no CMS, no admin dashboard.

## Ready to start?

**[Create a project directory →](/getting-started/create-a-space/)** — scaffold your first Grove space in under 10 minutes.