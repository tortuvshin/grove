---
title: 2. Author records
description: Replace the seed record with realistic ones, learn the record file layout, the taxonomy that classifies them, and the validate → generate → preview loop.
---

In [Tutorial 1](/tutorials/01-bootstrap/) you scaffolded an empty space. In
this tutorial you will fill it with real records — five open-source projects
in three categories — and watch the site rebuild as you go.

A **record** is a single file under `data/records/` that describes one thing
in your community's knowledge. The `project-directory` blueprint uses the
`project` kind, with a fixed shape (see [Resource schema](/reference/schema/)
for the full field list). Here we focus on the practical authoring loop.

## Step 1 — Delete the seed

```bash
rm data/records/example.md
```

The seed is in your way. Real spaces only contain records that mean something.

## Step 2 — Author your first record

Create `data/records/2024-03-zod.md`:

```markdown
---
slug: zod
name: Zod
kind: project
category: runtime
topics: [validation, typescript]
tags: [schema, runtime-validation, dx]
links:
    homepage: https://zod.dev
    repo: https://github.com/colinhacks/zod
description: TypeScript-first schema validation with static type inference.
projectType: library
language: TypeScript
license: MIT
platforms: [node, deno, bun, browser]
stack: [typescript]
bestFor:
    - Validating untrusted input at the boundary of your system.
    - Inferring types from runtime values to keep client and server in sync.
whyListed:
    - Best-in-class TypeScript inference — types are derived, not annotated.
    - Tiny runtime, no dependencies, works in every JS environment.
caveats: []
dateAdded: 2024-03-12
---

Zod is a TypeScript schema declaration and validation library. You declare a
schema once, and Zod gives you both a runtime validator and a static type.
Because both come from the same source, they cannot drift.
```

Save the file. The dev server from Tutorial 1 should still be running — the
browser will hot-reload and Zod appears on `/projects` within a second or
two.

### Anatomy of a record

A record is just a Markdown file with YAML frontmatter. Three things are
mandatory for the `project` kind:

1. **`slug`** — unique identifier. Used in URLs (`/projects/zod`).
2. **`kind`** — must be `project` for this blueprint.
3. **`name`** — human-readable title.

Everything else is optional. Grove does not enforce a minimum number of
fields — a record with just `slug`, `kind`, and `name` is valid, it just
won't render very much.

The Markdown body is the long-form description. It supports the full
CommonMark spec plus GFM (tables, task lists, autolinks). Use it for context
that doesn't fit into structured fields.

## Step 3 — Add four more records

We'll author four more projects so the directory has something to browse.
These are all real, well-known open-source projects — feel free to swap
them for projects in your own community.

**`data/records/2024-03-drizzle.md`**

```markdown
---
slug: drizzle-orm
name: Drizzle ORM
kind: project
category: data
topics: [orm, typescript, sql]
tags: [typescript, sql, edge]
links:
    homepage: https://orm.drizzle.team
    repo: https://github.com/drizzle-team/drizzle-orm
description: TypeScript ORM that feels like writing SQL.
projectType: library
language: TypeScript
license: Apache-2.0
platforms: [node, deno, bun, edge]
stack: [typescript]
bestFor:
    - Type-safe database access without a heavy runtime.
    - Edge runtimes where every kilobyte matters.
whyListed:
    - Generated types match the actual SQL dialect, not a generic subset.
    - Migrations are plain SQL files you can read and edit by hand.
caveats:
    - Smaller ecosystem than Prisma; expect to write more glue code.
dateAdded: 2024-03-15
---
```

**`data/records/2024-03-astro.md`**

```markdown
---
slug: astro
name: Astro
kind: project
category: framework
topics: [ssg, islands, content]
tags: [mpa, partial-hydration]
links:
    homepage: https://astro.build
    repo: https://github.com/withastro/astro
description: Content-driven web framework with islands architecture.
projectType: framework
language: TypeScript
license: MIT
platforms: [node, edge]
stack: [typescript, vite]
bestFor:
    - Documentation sites, blogs, marketing pages where most pages are static.
    - Mixing multiple UI frameworks in the same app.
whyListed:
    - Zero client-side JS by default — opt into hydration per component.
    - Content collections give Markdown and MDX first-class support.
caveats: []
dateAdded: 2024-03-15
---
```

**`data/records/2024-04-bun.md`**

```markdown
---
slug: bun
name: Bun
kind: project
category: runtime
topics: [runtime, bundler, package-manager]
tags: [javascript, typescript, performance]
links:
    homepage: https://bun.sh
    repo: https://github.com/oven-sh/bun
description: All-in-one JavaScript runtime, bundler, transpiler, and package manager.
projectType: runtime
language: Zig
license: MIT
platforms: [macos, linux, windows]
stack: [zig, javascript, typescript]
bestFor:
    - Replacing Node, npm, and esbuild with one fast binary.
    - TypeScript and JSX run natively — no transpile step.
whyListed:
    - 3-4× faster installs than pnpm in our tests.
    - Native APIs (Bun.serve, Bun.sql) make it a real platform, not just a runner.
caveats:
    - Some Node compatibility gaps — long-tail packages may break.
dateAdded: 2024-04-02
---
```

**`data/records/2024-04-effect.md`**

```markdown
---
slug: effect
name: Effect
kind: project
category: runtime
topics: [concurrency, typescript, fp]
tags: [error-handling, dependency-injection, streams]
links:
    homepage: https://effect.website
    repo: https://github.com/Effect-TS/effect
description: TypeScript library for typed async, errors, and dependency injection.
projectType: library
language: TypeScript
license: MIT
platforms: [node, deno, bun, browser]
stack: [typescript]
bestFor:
    - Replacing try/catch and ad-hoc error handling with a typed Effect type.
    - Structured concurrency and resource safety in long-running services.
whyListed:
    - Solves real production problems — error channels, cancellation, retries.
    - TypeScript types are precise enough to model the runtime behaviour.
caveats:
    - Steep learning curve; the documentation assumes FP familiarity.
dateAdded: 2024-04-18
---
```

Save all four. The dev server rebuilds; you now have five records spread
across three categories.

## Step 4 — Declare the taxonomy

The records above reference categories (`runtime`, `data`, `framework`) and
topics (`validation`, `typescript`, `sql`, `concurrency`, …) that the
taxonomy needs to know about. Open `data/taxonomy.yml`:

```yaml
# data/taxonomy.yml
categories:
    - id: runtime
      label: Runtimes & libraries
      description: JS/TS runtimes, validation, effect systems, and similar foundational libraries.
    - id: data
      label: Data layer
      description: ORMs, query builders, migration tools, and database clients.
    - id: framework
      label: Web frameworks
      description: Full-stack web frameworks and meta-frameworks.

topics:
    - id: typescript
      label: TypeScript
    - id: validation
      label: Validation
    - id: orm
      label: ORM
    - id: sql
      label: SQL
    - id: ssg
      label: Static site generation
    - id: islands
      label: Islands architecture
    - id: content
      label: Content sites
    - id: runtime
      label: JavaScript runtime
    - id: bundler
      label: Bundler
    - id: package-manager
      label: Package manager
    - id: concurrency
      label: Concurrency
    - id: fp
      label: Functional programming

tags: []  # free-form, no declaration needed
```

Three rules to remember:

- **Categories** are declared and a record must pick exactly one. They drive
  the primary navigation.
- **Topics** are declared and a record can have several. They drive filters
  and faceted search.
- **Tags** are free-form — you don't need to declare them. Use them for
  cross-cutting concerns that don't deserve their own topic.

## Step 5 — Validate and generate

```bash
pnpm grove validate
pnpm grove generate
```

`validate` checks that every record is well-formed and that every
`category` and `topic` it references exists in `taxonomy.yml`. `generate`
rebuilds `data/generated/records.full.json` and `records.index.json`, which
are what the Astro pages read at build time.

If `validate` reports a category or topic that isn't in the taxonomy, the
error message tells you which record and which field — go add the entry to
`taxonomy.yml` or fix the record.

## Step 6 — Browse the result

Open `http://localhost:4321/projects` in your browser. You should see:

- All five records listed.
- The category filter in the sidebar (Runtime & libraries, Data layer,
  Web frameworks).
- The topic facets under each category.

Click into a record (e.g. `/projects/zod`) to see the detail page. The
frontmatter fields are rendered as a definition list at the top, and the
Markdown body below.

## What you learned

- A record is a Markdown file with YAML frontmatter, one file per thing.
- The `project` kind has a fixed shape: required `slug`, `kind`, `name`,
  optional everything else.
- Taxonomy lives in `data/taxonomy.yml` and is **declared** for categories
  and topics, **free-form** for tags.
- `grove validate` catches taxonomy mismatches; `grove generate` rebuilds
  the JSON the UI reads.

## Common pitfalls

- **Frontmatter uses spaces, not tabs.** Tabs are a YAML 1.1 thing and the
  parser will reject them.
- **`kind` must match the blueprint.** A `resource` record in a
  `project-directory` space fails validation. This is intentional — it keeps
  the schema simple.
- **`dateAdded` is `YYYY-MM-DD`, not full ISO.** `2024-03-12T10:00:00Z`
  fails parsing; `2024-03-12` is fine.
- **Two records with the same `slug`** fails validation. The CLI catches
  this on save.

**Next: [Tutorial 3 — Customize the look](/tutorials/03-customize/)** —
turn the default theme into something that feels like your community.
