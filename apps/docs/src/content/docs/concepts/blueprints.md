---
title: Three blueprints
description: Three schemas, one default scaffold, no init-time choice.
---

# Three blueprints

Grove has three blueprints — `project-directory`, `resource-hub`, `ecosystem-map` — each binding a site to a single record kind. The blueprint is set in `grove.config.ts` (`blueprint: "project-directory"` by default) and is never picked at init time. `grove init` always scaffolds the `project-directory` flavor.

| Blueprint | Record `kind` | Default scaffold contents |
|---|---|---|
| `project-directory` | `project` | The shipped scaffold at `apps/example/` — open-source tools, agents, libraries, infrastructure |
| `resource-hub` | `resource` | Articles, guides, podcasts, videos, papers |
| `ecosystem-map` | `entity` | Companies, communities, research labs, agencies, people |

## Why no init-time picker

`grove init` copies the same canonical scaffold regardless of the blueprint. Switching blueprints happens by editing `grove.config.ts` and re-validating records against the new schema. This keeps the scaffold itself a small, well-tested surface instead of multiplying it three ways.

The plan is not to add more blueprints or a "choose your blueprint" picker. The three current blueprints cover the shape of structured knowledge Grove targets today. New shapes should re-use the existing fields or fork the framework.

## Switching blueprints

```ts
// grove.config.ts — change this to switch.
export default defineConfig({
  blueprint: "resource-hub",
  // ...
});
```

After switching, `grove check` will report every record that fails the new schema. There are two paths from there:

1. **Rewrite the record** to fit the new schema.
2. **Split the record** into multiple records (an organization + a tool + a contributor are usually three entities, not one).

Switching is rare and intentional. Most sites pick one blueprint and stay.

## What the schema looks like per blueprint

Every record kind shares the [resource base](/concepts/records/) — slug, description, summary, sourceDescription, category, tags, links, content, source, curation, scores, visibility — and adds kind-specific fields:

### `project` (`project-directory`)

```yaml
kind: project
name: my-project
description: One-line summary.
repoUrl: https://github.com/me/my-project
stacks: [typescript]
platforms: [web]
licenses: [mit]
bestFor: ["Self-hosting", "Experiments"]
whyListed: ["Maintainable", "Documented"]
```

Project-specific fields: `name`, `projectType`, `stack`, `stacks`, `platforms`, `licenses`, `difficulty`, `codebaseSize`, `repoUrl`, `logoUrl`, `screenshots`, `bestFor`, `whyListed`, `caveats`, `distribution.channels`, `github.*`, `health.*`. Full reference at [Record schema](/reference/record-schema/).

### `resource` (`resource-hub`)

```yaml
kind: resource
title: "A guide to writing knowledge bases"
type: guide
topic: knowledge-management
related: [another-resource-slug]
```

Resource-specific fields: `title`, `type` (one of `guide`, `comparison`, `link`, `explainer`, `tool`, `video`, `article`, `course`, `book`, `podcast`, `other`), `topic`, `related`, `publishedAt`, `author`.

### `entity` (`ecosystem-map`)

```yaml
kind: entity
name: Grove Foundation
type: organization
founded: "2026-01-01"
location: "Ulaanbaatar, MN"
```

Entity-specific fields: `name`, `type` (one of `company`, `organization`, `community`, `school`, `university`, `research-lab`, `agency`, `service`, `product`, `person`, `other`), `founded`, `location`, `members`, `parent`.

## What blueprint controls

The blueprint primarily changes **the shape of new records** — what fields are required, what enums are accepted, and what `kind` discriminator value is mandatory. The blueprint also chooses sensible defaults for:

- The default slug collection (`projects` / `resources` / `entities` — overridable via `routes.directory`).
- The default display labels (`project` / `projects` — overridable via `labels`).

What it does **not** control:

- The site shell, navigation, components, layouts, theme — those come from your Astro project.
- The build pipeline — every blueprint runs through the same `prepareDirectory()` + Astro build.

## A worked example

A directory of open-source AI tools uses `project-directory`:

```yaml
# data/records/ollama.yml
kind: project
name: Ollama
description: Get up and running with large language models locally.
repoUrl: https://github.com/ollama/ollama
stacks: [go]
platforms: [macos, linux, windows]
licenses: [mit]
bestFor: ["Local LLM runtime", "GGUF model support"]
whyListed: ["Easy install", "Active releases", "Good docs"]
```

A research-collection site uses `resource-hub`:

```yaml
# data/records/attention-is-all-you-need.yml
kind: resource
title: "Attention Is All You Need"
type: paper
topic: transformers
author: Vaswani et al.
publishedAt: "2017-06-12"
```

An ecosystem map of the Mongolian open-source community uses `ecosystem-map`:

```yaml
# data/records/grove-foundation.yml
kind: entity
name: Grove Foundation
type: organization
founded: "2026-01-01"
location: "Ulaanbaatar, MN"
```

Same Grove. Same build. Different `kind`, different schema, different lenses.

## See also

- [Reference: record schema](/reference/record-schema/) — every field, every kind.
- [Reference: `grove.config.ts`](/reference/config/) — `blueprint`, `routes`, `labels`.
