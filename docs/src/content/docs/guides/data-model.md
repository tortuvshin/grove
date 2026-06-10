---
title: The data model
description: A guided tour of the resource schema, taxonomy, and human-curation layer that holds a Grove space together.
---

A Grove space is, at its core, a directory of records, a taxonomy that
organizes them, and a curation layer that decides which records the public
site surfaces. This page walks through each of those three pieces and how
they fit together.

## The big picture

```txt
data/
├── records/                # one YAML per resource (recommended)
│   ├── foyle.yml
│   ├── aider.yml
│   └── ...
├── taxonomy/               # categories, topics, tags
│   ├── categories.yml
│   ├── topics.yml
│   └── tags.yml
├── health.yml              # auto-derived maintenance signals
├── decisions.yml           # human curation decisions
└── overrides.yml           # manual corrections to imports
```

Records are the truth. Taxonomy describes how the truth is organized.
Health and decisions are the signals and overrides that the build pipeline
folds in. Overrides are the escape hatch for cleaning up imports that did
not parse cleanly.

## Records

A record is one entry in the space. It is a YAML file under
`data/records/`, named after its slug (kebab-case by convention but not
required).

The shape of a record depends on its `kind`. Grove V1 ships three
discriminated shapes — `project`, `resource`, and `entity` — bound to the
three blueprints. See the [Spaces & blueprints](/guides/spaces/) page for
the high-level differences, and the [Resource schema](/reference/schema/)
page for the full field list.

Every record inherits a shared base:

```ts
{
  slug: string;            // unique identifier, matches the file slug
  description: string;     // short, single-sentence summary
  category: string;        // a curated category from taxonomy
  tags: string[];          // free-form tags
  links: {
    github?: string;       // GitHub project page
    website?: string;      // project home page
    docs?: string;         // documentation site
    source?: string;       // upstream source (for forks, mirrors)
    // ... and any other string-URL key
  };
  content?: string;        // path to a Markdown body under content/records/
  source?: {               // provenance: where did this record come from?
    type: 'manual' | 'github-topic' | 'awesome-list' | 'submit' | 'import';
    file?: string;
    url?: string;
    provider?: string;
    owner?: string;
    repo?: string;
  };
  curation: {              // human curator's marks
    reviewed: boolean;
    reviewedBy?: string;
    reviewedAt?: string;
    notes?: string;
    labels: ('new' | 'hot' | 'mature' | 'featured')[];
    lenses: string[];      // space-defined facets the record belongs to
  };
  scores?: {               // optional curator-assigned scores
    activity?: number;     // 0..100
    maturity?: number;     // 0..100
    learning?: number;     // 0..100
    contribution?: number; // 0..100
    docs?: number;         // 0..100
    overall?: number;      // 0..100
  };
}
```

The kind-specific extensions add the fields a community actually curates:

- **`project`** adds `name`, `repoUrl`, `logoUrl`, `stack`, `stacks[]`,
  `platforms[]`, `projectType`, `difficulty`, `codebaseSize`, `bestFor[]`,
  `whyListed[]`, `caveats[]`, `distribution.channels[]`, and an optional
  `github: { ... }` block plus an optional `health: { ... }` block.
- **`resource`** adds `title`, `type`, `topic`, `related[]`, `publishedAt`,
  `author`.
- **`entity`** adds `name`, `type`, `founded`, `location`, `members`,
  `parent`.

### One file per record vs. one file per kind

The build pipeline accepts two shapes:

**Recommended — one file per record:**

```txt
data/records/
├── foyle.yml
├── aider.yml
├── continue.yml
└── ...
```

Each file is a single YAML mapping. The slug in the YAML must match the
file slug. Diffs and PR reviews are clean, and the build pipeline can
stream records without loading the whole tree.

**Also supported — a list of records per file:**

```yaml
# data/records/llm-tooling.yml
records:
    - kind: project
      slug: foyle
      name: Foyle
      # ...
    - kind: project
      slug: aider
      name: aider
      # ...
```

Useful for grouping records that always ship together (a bundle, a curated
list, an imported awesome list before it is split). The CLI's `grove
import` command writes this shape initially; the recommended cleanup is to
split it into one file per record over time.

### Long-form content

A record can point to a Markdown body under `content/records/`:

```yaml
# data/records/foyle.yml
kind: project
name: Foyle
description: A simple IDE for working with LLM-generated code.
content: records/foyle.md
# ...
```

```markdown
<!-- content/records/foyle.md -->
# Foyle

A simple IDE for working with LLM-generated code. This page is a long-form
write-up the curator authored alongside the record — installation steps,
configuration tips, comparison to similar tools, anything that does not
fit the one-sentence description.
```

The body is rendered as the detail page's main content. It is the
recommended place for curator voice, deeper write-ups, and embed-able
content (screenshots, GIFs, comparison tables).

## Taxonomy

Taxonomy files live under `data/taxonomy/`. Three files, all optional, all
plain YAML:

```yaml
# data/taxonomy/categories.yml
- id: ai
  name: AI
  description: Tools, models, and libraries for AI and ML.
- id: web
  name: Web
  description: Web frameworks, libraries, and platforms.
- id: cli
  name: CLI
  description: Command-line tools, TUIs, and shell utilities.
```

```yaml
# data/taxonomy/topics.yml
- id: llm
  name: Large Language Models
  description: Anything specifically about LLMs and prompt engineering.
- id: devtools
  name: Developer Tools
  description: Tools that improve the developer experience.
```

```yaml
# data/taxonomy/tags.yml
- id: golang
  name: Go
- id: typescript
  name: TypeScript
- id: rust
  name: Rust
```

The framework treats `categories` and `topics` as **curated, finite**
lists. The build pipeline validates that every record's `category` is in
`categories.yml`, and every `kind: resource` record's `topic` is in
`topics.yml`. `tags` are **open and free-form** — a record's `tags: []`
list can contain any string, no validation, no curation.

The split keeps the curated axes clean (categories and topics are the
facets a space indexes on) while letting the community tag freely without
gating every new label through a curator.

## Health signals

A space can run `grove sync github` to enrich its records with GitHub
metadata, and the result is written to `data/health.yml`. The CLI fetches
stars, forks, language, license, the latest release date, and the
monthly commit history for every record whose `repoUrl` is a GitHub URL,
and derives a `health: { ... }` block:

```yaml
- id: foyle
  github:
    fullName: jlewi/foyle
    stars: 1234
    forks: 89
    openIssues: 12
    language: Go
    pushedAt: 2025-09-12T00:00:00Z
    latestReleaseAt: 2025-08-30T00:00:00Z
    license: Apache-2.0
    topics: [ai, llm, ide]
    monthlyCommits:
      - { month: '2025-08', commits: 42 }
      - { month: 2025-07, commits: 31 }
  health:
    status: active
    maturity: mature
    tier: curated
    visibility: keep
    cleanupCandidate: false
    confidence: high
    reasons: []
```

`status` is derived from the time since the last push (≤180d = `active`,
≤365d = `quiet`, ≤730d = `stale`, >730d = `inactive`; archived or
disabled repos get `archived` or `unavailable`). `tier` is derived from
stars and recent commit activity (≥500 stars or ≥4 active months =
`curated`, ≥50 stars = `listed`, otherwise `experimental`).

`cleanupCandidate: true` is set for any record whose `status` is
`stale`, `archived`, `inactive`, or `unavailable`. The build pipeline
uses this flag to surface the record in `grove cleanup stale` and in the
review queue on the rendered site.

`data/health.yml` is **gitignored** by default. It is a build artifact —
regenerating it is cheap, and the build pipeline regenerates it on every
`grove build` if it is missing. To pin a specific health snapshot, set
`integrations.github.health: true` in `grove.config.ts` and the file
becomes a regular tracked file.

## Decisions — the human curation layer

`data/decisions.yml` is where curators make the final visibility call.
The schema is the same regardless of which blueprint the space uses:

```yaml
- id: foyle
  decision:
    visibility: highlight
    reason: Active project, clean architecture, frequent releases.
    reviewedBy: gardener-handle
    reviewedAt: 2025-09-14
- id: some-abandoned-tool
  decision:
    visibility: historical
    reason: Project archived in 2023, kept for reference.
    reviewedBy: gardener-handle
    reviewedAt: 2025-09-14
```

The `visibility` field is one of six values:

- **`highlight`** — featured on landing pages and topic indexes.
- **`keep`** — listed in browse and search.
- **`needs_review`** — surfaced to a review queue, not in the main listing.
- **`hide`** — kept in the data, not rendered.
- **`remove`** — excluded from the build entirely.
- **`historical`** — kept for context, not surfaced in browse.

The build pipeline **folds decisions in on top of the auto-derived
health** block. A `decisions.yml` entry overrides whatever the health
derivation would have set. This is the human layer the auto-signals
deliberately stay out of — the framework emits signals, the gardeners
emit decisions.

`data/decisions.yml` is **git-tracked**. It is the contribution workflow
target. When a community member wants to flag a record, they open a PR
that adds an entry here. When a curator reviews, they update the entry
with their handle and the date.

## Overrides — the cleanup escape hatch

`data/overrides.yml` is a list of patches that the build pipeline applies
to imported records before validation:

```yaml
- id: some-imported-tool
  patch:
    description: A cleaner one-sentence summary that replaced the README blurb.
    tags: [ai, llm, rag]
```

Overrides are useful for:

- Replacing an imported description with a curator-written one.
- Adding tags the importer did not infer.
- Renaming a category to match the curated list.
- Setting the `curation.reviewed: true` flag after a curator has seen
  the record.

Overrides do not change the source file under `data/records/`. They are
a build-time patch. To make a change permanent, edit the source file and
remove the override.

## The build pipeline

Putting it all together, a `grove build` runs:

```txt
data/records/*.yml
  + data/taxonomy/*.yml
  + data/health.yml          (optional, auto-derived)
  + data/decisions.yml       (git-tracked, human layer)
  + data/overrides.yml       (git-tracked, escape hatch)
  → grove validate           (schema + taxonomy + decisions)
  → grove generate           (records.full.json, records.index.json)
  → grove sitemap            (public/sitemap.xml)
  → grove llms               (public/llms.txt, llms-full.txt)
  → framework build          (astro build / next build / vite build)
  → dist/                    (static site)
```

Every step is a separate command. You can run any of them in isolation —
the typical iteration loop is `edit record → grove validate → grove
generate → grove dev`. The full `grove build` is what CI runs.

## What to read next

- **[Spaces & blueprints](/guides/spaces/)** — what a blueprint is and
  how the three V1 blueprints differ.
- **[grove.config.ts](/reference/config/)** — every config field,
  explained.
- **[Resource schema](/reference/schema/)** — the field-by-field
  reference for the discriminated `Resource` union.
