---
title: Blueprints
description: A blueprint defines the shape and behavior of a Grove space. V1 ships three fixed blueprints — one end-to-end, two schema-ready.
---

A **blueprint** defines the shape and behavior of a Grove space: the
record kind it accepts, the schema those records follow, and the
taxonomy the renderer expects. Blueprints are not extensible in V1 —
Grove ships three, and you pick one when you scaffold a space.

## The three blueprints

| Blueprint | Record kind | What it curates | V1 status |
|---|---|---|---|
| `project-directory` | `project` | Apps, libraries, tools, frameworks | **End-to-end supported.** Working Astro template, full UI, GitHub sync, decisions. |
| `resource-hub` | `resource` | Guides, comparisons, articles, courses, books | **Schema-ready.** Full Zod schema, CLI support, no polished default Astro template yet. |
| `ecosystem-map` | `entity` | Companies, communities, schools, products, people | **Schema-ready.** Full Zod schema, CLI support, no polished default Astro template yet. |

The mapping is **1:1** — each blueprint accepts exactly one record
kind, and the CLI rejects records whose `kind:` does not match the
space's blueprint. This is enforced by `blueprintKind` in
`core/src/schema.ts`:

```ts
export const blueprintKind: Record<Blueprint, ResourceKind> = {
  "project-directory": "project",
  "resource-hub": "resource",
  "ecosystem-map": "entity",
};
```

## `project-directory` (end-to-end)

The default choice. Use it when the unit of curation is a **thing
with a repository** — an app, a library, a framework, a tool.

- **Record kind:** `project` (`ProjectRecord`)
- **Typical fields:** `name`, `repoUrl`, `stack`, `stacks`,
  `platforms`, `projectType`, `bestFor`, `whyListed`, `caveats`
- **V1 UI:** the Astro template renders a list of cards with logo,
  stars, language, and a one-line description, plus a detail page
  per record with the full schema.
- **GitHub sync:** `grove sync github` enriches each record with
  live metadata: stars, forks, last commit, license, language,
  topics. The data is written back into the record YAML as a
  `github.repository` block, which is reviewable in a PR.

This is the blueprint Open Apps, the showcase Grove-powered space,
uses. It is the only blueprint with a polished default template in V1.

## `resource-hub` (schema-ready)

Use it when the unit of curation is a **piece of content** — a guide,
a comparison, an article, a course, a book, a podcast episode. The
record is not a project you link to; it is a thing you read.

- **Record kind:** `resource` (`ResourceRecord`)
- **Typical fields:** `title`, `type` (guide | comparison | link |
  explainer | tool | video | article | course | book | podcast |
  other), `topic`, `author`, `publishedAt`, `related` (array of
  slugs of related resources)
- **V1 UI:** the Astro template does not yet ship polished default
  pages for `resource` records. The CLI validates, generates, and
  writes `llms.txt` correctly. Rendering a resource hub requires a
  custom Astro page (or Phase 3 of the docs work, which will add
  default pages).

You can use `resource-hub` today, but plan to write a custom Astro
page (or accept the minimal default) until V1.1.

## `ecosystem-map` (schema-ready)

Use it when the unit of curation is an **organization or person** —
a company, a community, a school, a research lab, an agency, a
product, a person. The record is a profile, not a project.

- **Record kind:** `entity` (`EntityRecord`)
- **Typical fields:** `name`, `type` (company | organization |
  community | school | university | research-lab | agency | service
  | product | person | other), `founded`, `location`, `members`,
  `parent` (slug of a parent entity, for sub-communities)
- **V1 UI:** same status as `resource-hub` — schema and CLI
  complete, default Astro template not yet shipped.

## Picking the right blueprint

Pick the **unit of curation**, not the topic:

- "I am curating a list of **open-source apps**" → `project-directory`
- "I am curating a list of **guides and articles**" → `resource-hub`
- "I am curating a list of **companies and communities**" → `ecosystem-map`

If your space mixes projects and people, you have two options:

1. Pick the dominant unit and treat the other as a related field
   (e.g., a `project` record can have a `maintainers` field that
   links out to an external profile).
2. Wait for V2 — multi-blueprint spaces (a `project-directory` plus
   an `entity` map side-by-side) are a V2 feature, not V1.

## Changing blueprints

You can change `blueprint` in `grove.config.ts` at any time, but
**records in `data/records/` will need their `kind:` field updated**
to match the new blueprint. There is no automatic migration.

```ts
// grove.config.ts
export default defineConfig({
  blueprint: "project-directory",  // ← change this
  // ...
});
```

After changing, run `grove validate` — it will report every record
whose `kind:` is now wrong.

## Related docs

- **[What is Grove?](/introduction/)** — the
  60-second pitch.
- **[Create a space](/getting-started/create-a-space/)** — scaffold
  a new space; you pick the blueprint here.
- **[Record schema](/reference/record-schema/)** — every field, every
  default, every kind.
