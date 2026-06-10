---
title: Resource schema
description: The field-by-field reference for the discriminated Resource union — every kind, every field, every default.
---

Grove V1 ships a discriminated `Resource` union with three concrete
shapes, bound to the three [blueprints](/guides/spaces/):

- `kind: 'project'` — `project-directory` blueprint
- `kind: 'resource'` — `resource-hub` blueprint
- `kind: 'entity'` — `ecosystem-map` blueprint

Every record inherits a shared base and adds a kind-specific
extension. The CLI and the build pipeline both check that a record's
`kind` matches the space's blueprint — a mismatch is a hard error.

This page documents every field, every default, and every constraint.

## The shared base

Every record, regardless of `kind`, carries the following fields:

### `slug`

**Type:** `string` (required, min length 1)

The unique identifier for the record. The build pipeline uses it as
the URL slug, the in-page anchor, and the cross-reference key
(`related[]`, `parent`).

**Convention:** kebab-case, matching the file name. A record in
`data/records/foyle.yml` has `slug: 'foyle'`. The CLI does not
enforce the convention, but a mismatch between the file name and
the slug produces a warning.

### `description`

**Type:** `string`
**Default:** `''`

A short, single-sentence summary. Used in the list cards, the meta
description, the search snippet, and the `llms.txt` index. Keep it
under 200 characters; the renderer truncates with an ellipsis after
that.

### `category`

**Type:** `string` (required, min length 1)
**Default:** `'uncategorized'`

A curated category from `data/taxonomy/categories.yml`. The CLI
rejects records whose `category` is not in the taxonomy file.

### `tags`

**Type:** `string[]`
**Default:** `[]`

Free-form tags. No curation, no validation. A record's tags are
open and unbounded — the community can introduce a new tag without
editing a taxonomy file.

### `links`

**Type:** `{ github?: string; website?: string; docs?: string; source?: string; [key: string]: string }`
**Default:** `{}`

A map of links to the resource. The four built-in keys are
`github`, `website`, `docs`, and `source`. The framework also
accepts any custom string-URL key, which the renderer surfaces as a
button on the detail page.

**Example:**

```yaml
links:
    github: https://github.com/jlewi/foyle
    website: https://foyle.dev
    docs: https://docs.foyle.dev
    source: https://github.com/foyle-mirror/foyle
    huggingface: https://huggingface.co/spaces/some/foyle-demo
```

### `content`

**Type:** `string` (optional)

A path, relative to the space's `paths.contentDir`, to a Markdown
body for the record. The renderer reads the file and renders it as
the detail page's main content.

**Example:**

```yaml
content: records/foyle.md
```

The referenced file lives under `content/records/foyle.md`. The
path is resolved relative to `paths.contentDir`, which defaults to
`content`.

### `source`

**Type:** `{ type: 'manual' | 'github-topic' | 'awesome-list' | 'submit' | 'import'; file?: string; url?: string; provider?: string; owner?: string; repo?: string }`
**Default:** `{ type: 'manual' }`

Provenance — where the record came from. The CLI writes the `type`
automatically on import; curators can refine or replace it.

- `type: 'manual'` — hand-authored by a curator.
- `type: 'github-topic'` — discovered by browsing a GitHub topic.
- `type: 'awesome-list'` — imported from an awesome-list README.
- `type: 'submit'` — submitted via the GitHub issue template.
- `type: 'import'` — imported by the `grove import` command from
  a Markdown source.

### `curation`

**Type:** `{ reviewed: boolean; reviewedBy?: string; reviewedAt?: string; notes?: string; labels: ('new' | 'hot' | 'mature' | 'featured')[]; lenses: string[] }`
**Default:** `{ reviewed: false, labels: [], lenses: [] }`

The human curator's marks on the record.

- `reviewed` — has a curator looked at this? The renderer surfaces
  un-reviewed records with a "needs review" badge.
- `reviewedBy` — the curator's handle, set when `reviewed: true`.
- `reviewedAt` — ISO 8601 date string.
- `notes` — free-form curator notes. Not rendered on the public
  page; visible in the JSON output for tooling.
- `labels` — one or more of `new`, `hot`, `mature`, `featured`. The
  renderer uses these for badges and for the "label" filter on the
  browse page.
- `lenses` — space-defined facets the record belongs to. Used for
  curated indexes; not validated.

### `scores`

**Type:** `{ activity?: number; maturity?: number; learning?: number; contribution?: number; docs?: number; overall?: number }`
**Default:** `{}`

Optional curator-assigned scores, each 0..100. The framework
**does not** auto-compute scores in V1 — the values are written by
curators. The renderer surfaces the `scores.overall` value on the
detail page when present.

This is the one place the framework is deliberately hands-off.
Curators decide what the scores mean in their community's context.

## Kind: `project`

The `project-directory` blueprint. Carries everything in the
shared base, plus:

### `name`

**Type:** `string` (required, min length 1)

The display name of the project. Shown in the header, the list
card, the page title, and the meta description.

### `projectType`

**Type:** `'real-app' | 'production' | 'reference' | 'library' | 'tool' | 'demo' | 'template' | 'historical'`
**Default:** not set (treated as `'reference'` by the renderer)

Curator-assigned project type. The renderer uses this to group
records in the browse page.

### `stack`

**Type:** `string` (optional)

A free-form string describing the project's primary stack. The
renderer surfaces this as a single chip. Use `stacks[]` for a
multi-stack project.

### `stacks`

**Type:** `string[]`
**Default:** `[]`

A list of stack tags. The renderer shows all of them as chips.
The CLI does not validate the values; convention is `['go', 'react',
'postgres', 'kubernetes']` style.

### `platforms`

**Type:** `string[]`
**Default:** `[]`

The platforms the project targets. Convention is
`['web', 'cli', 'macos', 'windows', 'linux', 'ios', 'android',
'kubernetes']`. Surfaced as a filter facet.

### `difficulty`

**Type:** `'beginner' | 'intermediate' | 'advanced'` (optional)

Curator-assigned difficulty for a newcomer trying to evaluate or
use the project. Used for the "level" filter on the browse page.

### `codebaseSize`

**Type:** `'small' | 'medium' | 'large' | 'huge'` (optional)

Curator-assessed size of the project's codebase. The renderer
surfaces this on the detail page; it is not exposed as a filter
facet in V1.

### `repoUrl`

**Type:** `string` (URL, optional)

The canonical repository URL. Distinct from `links.github` — the
latter is the human-facing link, this one is the single source the
build pipeline uses to extract the owner/repo, fetch the avatar
fallback, and render the "view repo" call to action. If the project
has a GitHub repo, set this to the GitHub URL; if not, leave it
unset.

### `logoUrl`

**Type:** `string` (URL, optional)

A direct URL to the project's logo or avatar. If unset, the
renderer falls back to the GitHub owner avatar (when `repoUrl` is
a github.com URL) and then to a 2-letter initials placeholder.

### `bestFor`

**Type:** `string[]`
**Default:** `[]`

Curator-written "best for" bullets. Shown on the detail page as a
highlighted list. Convention: 1-3 short phrases.

### `whyListed`

**Type:** `string[]`
**Default:** `[]`

Curator-written "why is this in the space" bullets. The detail
page renders this as a "Curator's note" block.

### `caveats`

**Type:** `string[]`
**Default:** `[]`

Curator-written "caveats" — what to know before adopting. The
detail page renders this as a "Caveats" callout.

### `distribution.channels[]`

**Type:** `Array<{ type: string; platform?: string; label?: string; url: string; verified?: boolean; notes?: string }>`
**Default:** `[]`

Where the project is distributed. The renderer shows each channel
as a "Get it on ..." link. Useful for apps that ship through
multiple package managers, app stores, or binary hosts.

**Example:**

```yaml
distribution:
    channels:
        - type: package-manager
          platform: npm
          label: npm
          url: https://www.npmjs.com/package/foyle
          verified: true
        - type: package-manager
          platform: homebrew
          label: Homebrew
          url: https://formulae.brew.sh/formula/foyle
        - type: binary
          platform: macos
          label: macOS
          url: https://github.com/jlewi/foyle/releases/latest
```

### `github`

**Type:** optional enrichment block

Auto-populated by `grove sync github`. The shape mirrors the
GitHub REST API response, plus a few normalized fields the build
pipeline computes (`fullName`, `stars`, `forks`, `openIssues`,
`watchers`, `archived`, `disabled`, `private`, `pushedAt`,
`updatedAt`, `createdAt`, `latestReleaseAt`, `license`, `topics`,
`language`, `defaultBranch`, `languages`, `monthlyCommits`). The
full schema is `githubRepositorySchema` in `@grove-dev/core`; the
runtime never validates unknown fields, so additional GitHub fields
pass through unchanged.

### `health`

**Type:** optional health block

Auto-populated by `grove generate`. Carries the derived
`status`, `maturity`, `tier`, `visibility`, `cleanupCandidate`,
`confidence`, and `reasons` fields. See [The data
model](/guides/data-model/#health-signals) for the derivation
rules.

## Kind: `resource`

The `resource-hub` blueprint. Carries everything in the shared
base, plus:

### `title`

**Type:** `string` (required, min length 1)

The display title of the resource. Shown in the header, the list
card, the page title, and the meta description.

### `type`

**Type:** `'guide' | 'comparison' | 'link' | 'explainer' | 'tool' | 'video' | 'article' | 'course' | 'book' | 'podcast' | 'other'`
**Required.**

The shape of the resource. The CLI imports Markdown links with
`type: 'link'`; curators refine after import.

### `topic`

**Type:** `string` (required, min length 1)

A curated topic from `data/taxonomy/topics.yml`. The CLI rejects
resources whose `topic` is not in the taxonomy file.

### `related`

**Type:** `string[]`
**Default:** `[]`

Slugs of related resources. The renderer renders the related
resources as a "Related" block on the detail page. The CLI does not
validate that the slugs exist — broken references are surfaced as
warnings by `grove validate --strict`.

### `publishedAt`

**Type:** `string` (optional, ISO 8601 date)

When the resource was published. The renderer sorts the list page
by `publishedAt` descending when the user picks the "newest" sort
order.

### `author`

**Type:** `string` (optional)

The resource's author. Free-form string — a name, a handle, an
organization. The renderer surfaces this on the detail page.

## Kind: `entity`

The `ecosystem-map` blueprint. Carries everything in the shared
base, plus:

### `name`

**Type:** `string` (required, min length 1)

The display name of the entity. Shown in the header, the list
card, the page title, and the meta description.

### `type`

**Type:** `'company' | 'organization' | 'community' | 'school' | 'university' | 'research-lab' | 'agency' | 'service' | 'product' | 'person' | 'other'`
**Required.**

The shape of the entity. The CLI imports Markdown links with
`type: 'other'`; curators refine after import.

### `founded`

**Type:** `string` (optional, ISO 8601 year or full date)

When the entity was founded. Convention is `YYYY` for a year and
`YYYY-MM-DD` for a specific date. The renderer surfaces this on
the detail page as a "Founded" field.

### `location`

**Type:** `string` (optional)

Free-form location string. The CLI does not parse it — convention
is `'City, Country'` or `'Remote'`. Surfaced on the detail page;
not exposed as a filter facet in V1.

### `members`

**Type:** `number` (integer, ≥0, optional)

The number of members. The renderer uses this to group entities
on the browse page (e.g. "Small (≤10)", "Medium (≤100)",
"Large (>100)").

### `parent`

**Type:** `string` (optional)

The slug of a parent entity. The renderer renders the parent as
a "Part of" link on the detail page and uses it to build a
hierarchical browse view. The CLI does not validate that the
parent slug exists — broken references are warnings.

## Health and decision enums

These enums are shared across all three blueprints and are
documented here for completeness.

### `health.status`

`'active' | 'mature' | 'stale' | 'inactive' | 'archived' | 'unknown' | 'historical' | 'needs_review' | 'quiet' | 'unavailable'`

Derived from the GitHub metadata. See [The data
model](/guides/data-model/#health-signals) for the derivation
rules.

### `health.maturity`

`'experimental' | 'useful' | 'mature' | 'unknown'`

Curator-assigned or, in V1, derived from the `tier` and the
project's age.

### `health.tier`

`'curated' | 'listed' | 'experimental' | 'hidden'`

Derived from the GitHub metadata. Used to decide which list pages
the record appears on.

### `health.visibility`

`'highlight' | 'keep' | 'needs_review' | 'hide' | 'remove' | 'historical'`

Final visibility. By default derived from the `tier`; overridden
by `decisions.yml`. See [The data
model](/guides/data-model/#decisions--the-human-curation-layer)
for the full semantics.

### `decisions[].decision.visibility`

Same enum as `health.visibility`. A `decisions.yml` entry sets
this directly.

## What to read next

- **[Spaces & blueprints](/guides/spaces/)** — the high-level
  differences between the three blueprints.
- **[The data model](/guides/data-model/)** — how the schema
  composes with taxonomy, health, and decisions.
- **[grove.config.ts](/reference/config/)** — the space's identity
  file, where the blueprint is set.
