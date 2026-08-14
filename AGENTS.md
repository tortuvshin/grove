# Grove

Grove is a **file-first publishing system for structured knowledge**.

## What Grove does

Files are the source of truth — YAML, Markdown, and other structured sources owned by the user. Grove turns that content into multiple useful outputs:

- Websites and rich pages
- Collections, indexes, and curated views
- README content, SEO metadata, sitemaps, structured data
- LLM-oriented and other machine-readable outputs

Automation keeps these outputs synchronized with the source files and reduces stale content.

## Product principles

- Files are the source of truth; generated outputs are derived from them.
- One piece of content should produce many useful outputs, not be re-entered per surface.
- Automation and synchronization are core, not optional.
- Prefer portable, transparent formats over proprietary storage.
- Static-first workflows are the default.
- Avoid adding infrastructure (databases, servers, abstractions) without a real use case.

## What Grove is not

A directory is one possible use case — not the product definition.

Do not position Grove primarily as a:

- directory starter, generator, or template
- YAML website builder
- Astro theme

When writing product copy, describe what Grove **enables** — file-first publishing of structured knowledge into multiple outputs — not just one presentation format.

## Architecture guardrails

Before introducing a new architectural decision, check that it:

- preserves file-first ownership
- supports static publishing and portability
- improves publishing, synchronization, or maintenance
- works across Grove use cases (not just one)
- does not introduce unnecessary database or server requirements

Do not turn Grove into a traditional CMS or generic platform unless explicitly required.

## Product-facing work

For landing pages, README, docs, examples, and onboarding:

- Keep the full mental model intact: source content → Grove → multiple outputs → ongoing maintenance.
- Do not reduce Grove to directories.
- Show the relationship between source files, generated outputs, and automation.
- Prefer concrete outcomes over abstract technical terminology.

## Mental model

> Maintain structured knowledge in files. Grove publishes it into useful human- and machine-readable outputs and keeps everything in sync.

When uncertain about a product or implementation decision, return to this model.
