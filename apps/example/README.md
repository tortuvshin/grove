# Grove directory

This is a complete, customizable Astro directory powered by Grove. The pages
and product content live in this repository; Grove supplies reusable
components, data contracts, generated artifacts, and CI commands.

## Start locally

```sh
pnpm install
pnpm dev
```

Run the same validation used by CI:

```sh
pnpm exec grove check
pnpm build
```

## Customize

- `grove.config.ts` — site identity, navigation, footer, labels, facets,
  analytics, and theme
- `data/records/` — one YAML record per directory item
- `data/taxonomy/` — categories, stacks, platforms, and distribution channels
- `src/pages/` — consumer-owned Astro pages and custom routes
- `src/components/` — project-specific components
- `public/icons/` — custom stack and platform SVG assets

Generated data stays in `data/generated/`. Grove prepares it automatically
when Astro starts, so the project does not need consumer-owned generation
scripts.

## Refresh GitHub data

```sh
pnpm exec grove sync github
pnpm exec grove sync contributors
```

The included workflows run checks, refresh metadata, and prepare a deployable
static build. Adjust the deployment workflow for the hosting provider used by
your directory.

<!-- grove-readme:start -->
# Awesome Open-Source AI Tools

[![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

Hand-picked tools worth running, studying, and extending.

Browse the catalog → https://example.com

## Why this list

Each tool below is **actively maintained**, **well documented**, and
**useful in production**. Submit a new entry via `pnpm exec grove`
or by opening a pull request against `data/records/`.

## Contents

- [Local Models](#local-models)
- [Interfaces](#interfaces)
- [Agents](#agents)
- [Orchestration](#orchestration)
- [Data Tools](#data-tools)

## Local Models

- [Ollama](https://ollama.com) - Run and manage open language models locally through a small command-line and HTTP interface.

## Interfaces

- [Open WebUI](https://openwebui.com) - A self-hosted AI interface supporting Ollama and OpenAI-compatible model providers.

## Agents

- [CrewAI](https://crewai.com) - A Python framework for coordinating role-based autonomous agents, tasks, and multi-step crews.

## Orchestration

- [Dify](https://dify.ai) - A visual platform for building and operating LLM applications, workflows, agents, and retrieval pipelines.
- [Flowise](https://flowiseai.com) - A visual builder for AI agents and LLM workflows based on composable nodes.

## Data Tools

- [LlamaIndex](https://www.llamaindex.ai) - Data framework for connecting private and public data to language-model applications and agents.
<!-- grove-readme:end -->
