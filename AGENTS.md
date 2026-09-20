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

## How Grove is positioned

Grove has one model and one front door.

- **The model** — what Grove is: file-first publishing of structured knowledge. Source files → Grove → many outputs → ongoing maintenance.
- **The front door** — what people come for: curated directories and catalogs. Open-source project directories, awesome lists that outgrew a README, curated resource sites, technical catalogs.

Nobody searches for a "structured knowledge publishing system". They search for a way to build and maintain a directory. So market-facing surfaces — the landing hero, site title and meta description, the README lead, "What is Grove?" — lead with the front door, in the words a maintainer would use: _build a curated directory from files_. The model is the explanation underneath, and it stays whole in the Introduction, the concept docs, and every "how it works" section.

## What Grove is not

Do not position Grove as a:

- CMS or database-backed directory service
- YAML website builder
- Astro theme

Do not widen the first fold to "knowledge base", "content hub", or "LLM publishing platform". The data layer supports more than directories; say so once, further down the page, not in the pitch.

The directory framing is for copy, not for architecture. Engine packages stay use-case neutral — see the guardrails below.

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

- Order the message: use case → pain → solution → architecture. Not the reverse.
- Lead with the directory or catalog the reader wants to build, then the pain of maintaining it in several places.
- Keep the full mental model intact where the product is explained: source content → Grove → multiple outputs → ongoing maintenance.
- Show the relationship between source files, generated outputs, and automation.
- Prefer concrete outcomes over abstract technical terminology.
- Open App Scout is the proof. Point at it rather than describing what Grove could do.

## Mental model

> Maintain structured knowledge in files. Grove publishes it into useful human- and machine-readable outputs and keeps everything in sync.

When uncertain about a product or implementation decision, return to this model.
