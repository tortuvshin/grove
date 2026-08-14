# AGENTS.md

## Grove

Grove is a **file-first publishing system for structured knowledge**.

It turns structured content such as YAML and Markdown into rich outputs for both humans and machines, while helping keep those outputs synchronized and current.

Think in terms of:

```text
Files / structured data
        ↓
      Grove
        ↓
Website + rich pages + collections
README + SEO + sitemap
Machine-readable + LLM outputs
        ↓
Automated maintenance
```

## Product principles

- Files remain the source of truth.
- Write content once and derive multiple outputs from it.
- Prefer portable, transparent formats over proprietary storage.
- Static publishing should remain a first-class workflow.
- Generated outputs should not become separate sources of truth.
- Automation should reduce stale content and repeated manual maintenance.
- Human-readable and machine-readable outputs are both important.
- Rich Markdown content and structured metadata should work together.
- Avoid adding infrastructure or abstractions without a real use case.

## Positioning

Do not define Grove by a single presentation format or use case.

A directory, catalog, resource library, knowledge base, or curated collection can all be built with Grove, but none of them alone defines the product.

Avoid positioning Grove primarily as:

- directory starter
- directory generator
- directory template
- YAML website builder
- Astro theme

Prefer language around:

- structured content
- structured knowledge
- file-first publishing
- rich knowledge sites
- multiple outputs
- automated maintenance
- human and machine-readable content

When writing product copy, describe **what Grove enables**, not just how it is implemented.

## Architecture

Before introducing a new architectural decision, ask:

- Does it preserve file-first ownership?
- Does it improve publishing, synchronization, or maintenance?
- Does it work across different Grove use cases?
- Does it introduce unnecessary server or database requirements?
- Is there a simpler solution?

Do not turn Grove into a traditional CMS or generic platform unless explicitly required.

## Product-facing work

For landing pages, README, docs, examples, and onboarding:

- Keep the full Grove mental model intact.
- Do not reduce Grove to directories.
- Show the relationship between source content, generated outputs, and automation.
- Prefer concrete outcomes over abstract technical terminology.
- Use animation and visuals to explain how Grove works, not as decoration.

## Core mental model

> **Maintain structured knowledge in files. Grove publishes it into useful human- and machine-readable outputs and keeps everything in sync.**

When uncertain about a product or implementation decision, return to this model.
