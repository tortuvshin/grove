---
title: Spaces & blueprints
description: How Grove models a community's knowledge as a space, and how the three V1 blueprints map different knowledge shapes to a record schema.
---

A **space** is a single Grove-powered site: one repository, one community, one
set of records, one brand. The space is the unit of ownership — it has its
own `grove.config.ts`, its own `data/` tree, its own deploy workflow, and its
own contribution rules.

A **blueprint** is the shape of a space. It binds:

- A `kind` discriminator on every record (`project`, `resource`, or `entity`).
- The record schema that kind uses.
- The default routes and filters the site exposes.
- Which optional commands make sense for that space.

Grove V1 ships **three fixed blueprints**. They are not extensible — if a
real space needs fields the V1 schemas do not carry, Wave 2 extends the union
with a new shape. The per-site API stays small.

## The three V1 blueprints

### `project-directory` — kind: `project`

Structured collections of projects, tools, apps, packages, services,
repositories, or internal systems. GitHub metadata is **optional** — a
project record can stand on its own with just a name, description, and links,
and pick up stars, language, license, and release date from `grove sync
github` later.

**Built first, fully reusable.** This is the shape most existing "awesome
list, but with a real schema" spaces fit.

Records carry: `name`, `description`, `category`, `tags`, `links`,
`repoUrl`, `logoUrl`, `stack` / `stacks[]`, `platforms[]`, `projectType`,
`difficulty`, `codebaseSize`, `bestFor[]`, `whyListed[]`, `caveats[]`,
`distribution.channels[]`, optional `github: { ... }` enrichment block,
optional `health: { ... }` block.

**Example spaces:** Open Apps (production-ready OSS applications), any
awesome-list-style directory.

### `resource-hub` — kind: `resource`

Guides, comparisons, explainers, links, learning resources, public datasets,
research collections. Knowledge artifacts that may or may not have a
GitHub repo.

**MVP in V1, full implementation in Wave 2.** The schema and importer work
in V1; the curio of curation signals (relevance, freshness, authority) lands
in Wave 2 alongside the second real space.

Records carry: `title`, `description`, `type` (guide, comparison, link,
explainer, tool, video, article, course, book, podcast, other), `topic`,
`related[]` (slugs of other resources), `publishedAt`, `author`, `links`.

**Example spaces:** [Open Apps](https://github.com/tortuvshin/open-apps) (production-ready OSS applications), a
company-internal learning hub, a public reading list.

### `ecosystem-map` — kind: `entity`

Organizations, products, people, communities, schools, services, ecosystem
actors. The "who is in this ecosystem" shape.

**MVP in V1, full implementation in Wave 2.** This blueprint carries the
most schema — `founded`, `location`, `members`, `parent` — so it exercises
the discriminated `Resource` union more than the other two.

Records carry: `name`, `description`, `type` (company, organization,
community, school, university, research-lab, agency, service, product,
person, other), `founded`, `location`, `members`, `parent` (slug of a
parent entity for hierarchies), `links`.

**Example spaces:** an open-source ecosystem, a local tech / startup
ecosystem map, any "local ecosystem" map.

## How a blueprint is set

The blueprint is declared once, in `grove.config.ts`, at the root of a
space:

```ts
// grove.config.ts
import { defineGroveConfig } from "@grove-dev/core";

export default defineGroveConfig({
  blueprint: "project-directory",
  site: {
    name: "Open Apps",
    tagline: "Production-ready open-source applications.",
  },
  // ...
});
```

The CLI's `grove new` command prompts for the blueprint at scaffold time
and writes the chosen value into the config. To switch a space to a
different blueprint, edit the `blueprint` field and re-run `grove validate`
to find the records that no longer fit.

## Why three fixed blueprints?

A few reasons:

1. **Each blueprint is its own discriminator.** A site running
   `project-directory` rejects records with `kind: resource` or `kind:
entity` at validation time. The schema, the importer, and the GitHub
   enrichment layer all branch on `blueprint`. Adding custom discriminators
   in V1 would mean a custom validator, a custom importer, a custom UI
   projection, and a custom sitemap entry for every space — that is
   framework-shaped work, not space-shaped work.
2. **The data model is the identity.** If we let every site invent its
   own kind, the framework stops being a framework and becomes a template
   generator. We want the records in every space to be shaped the same way
   so contributors and tooling
   can move between spaces without learning a new shape.
3. **Wave 2 extends the union, not the API.** When the first real space
   needs fields the V1 schemas do not carry, we add them to one of the
   three shapes. The per-site API stays simple.

If a community really needs a shape none of the three fit — say, a
time-series collection of "what changed this month" entries — that becomes
a new blueprint in a future wave, not a per-site config knob.

## Records and kinds

A **record** is one entry in the space. It is a single YAML file under
`data/records/`, named after its slug. The `kind` field on the record
selects which schema applies:

```yaml
# data/records/foyle.yml
kind: project
name: Foyle
# ...
```

The CLI and the build pipeline both check that the record's `kind` matches
the space's blueprint. A mismatch is a hard error, not a warning.

Records can also live together in a single YAML file as a list, or under
a `records:` key:

```yaml
# data/records/llm-tooling.yml
records:
  - kind: project
    name: Foyle
    # ...
  - kind: project
    name: aider
    # ...
```

The CLI and the build pipeline support both shapes. The recommended shape
in V1 is **one file per record** — it makes diffs and PR reviews cleaner,
and the build pipeline can stream records without loading the whole file
at once.

## The role of GitHub metadata

GitHub metadata — stars, forks, language, license, latest release date,
monthly commit activity — is **optional enrichment**, not the spine of the
data model. Only the `project-directory` blueprint carries a `github:`
block on its records, and only `project-directory` records benefit from
`grove sync github`.

A `resource-hub` space has no concept of "the GitHub repo for this guide".
An `ecosystem-map` space records organizations and people, not code. For
those blueprints, the `links.github` field is still useful when the entity
has a presence on GitHub, but the `grove sync github` command is a
no-op — there is no `github:` block to enrich.

This is what keeps Grove generic. Tying the data model to GitHub too
tightly would make Grove "the OSS directory tool" forever. It is not.

## The `health` and `decisions` layers

Every space gets a `data/health.yml` (auto-derived maintenance signals)
and a `data/decisions.yml` (human curation decisions). Both are
blueprint-agnostic: the schema is the same, regardless of which `kind`
the records use.

The visibility decision is the human curator's call. A record can be:

- `highlight` — featured on landing pages and topic indexes.
- `keep` — listed in browse and search.
- `needs_review` — surfaced to a review queue, not in the main listing.
- `hide` — kept in the data, not rendered.
- `remove` — excluded from the build entirely.
- `historical` — kept for context, not surfaced in browse.

A `decisions.yml` entry looks like:

```yaml
- id: foyle
  decision:
    visibility: highlight
    reason: Active project, clean architecture, frequent releases.
    reviewedBy: gardener-handle
    reviewedAt: 2025-09-14
```

The build pipeline folds these decisions in alongside the auto-derived
health signals. The framework emits signals, not final judgments — a
stale or inactive status invites review, it does not auto-hide the
record.

## What to read next

- **[Getting started](/guides/getting-started/)** — install the CLI and
  scaffold a space.
- **[The data model](/guides/data-model/)** — a guided tour of the
  resource schema, taxonomy, and the curation layer.
- **[Resource schema](/reference/schema/)** — the field-by-field
  reference for every record shape.
