# Open Apps to Grove Migration Design

## Summary

Create `/Users/turtuvshin/Projects/research/open-apps-grove` as a fresh,
standalone Grove application. The application will preserve Open Apps data,
routes, features, SEO, editorial rules, GitHub enrichment, and deployment
behavior while adopting Grove's default Astro UI directly.

This is not a visual-parity migration. Existing Open Apps components,
layouts, and global styles will not be copied into the new application.
Grove owns the UI.

## Goals

- Use Grove as the application framework.
- Use Grove's default layouts, components, pages, and styling.
- Preserve the Open Apps catalog and its public behavior.
- Preserve `/apps` and `/apps/<slug>` as canonical public routes.
- Preserve SEO metadata, structured data, sitemap, robots, and LLM outputs.
- Preserve GitHub metadata enrichment, contributor synchronization, health
  signals, validation, cleanup reporting, and automated update workflows.
- Keep Open Apps-specific data, copy, rules, enrichment, and deployment
  outside Grove core.
- Improve Grove only when a missing capability is reusable by other Grove
  applications.
- Avoid Open Apps-specific component overrides during the initial migration.

## Non-goals

- Recreating the current Open Apps visual design.
- Copying the current Open Apps Astro components or CSS.
- Adding an Open Apps theme package to Grove.
- Introducing a custom Grove blueprint.
- Preserving the old repository's Git history in the new repository.
- Publishing Grove packages before the local migration proves the required
  framework behavior.

## Repository Strategy

The migration uses two sibling repositories:

- `/Users/turtuvshin/Projects/research/grove`: the framework and default UI.
- `/Users/turtuvshin/Projects/research/open-apps-grove`: the new consumer
  application.

`open-apps-grove` will be initialized as a fresh Git repository. It will
initially consume local Grove packages through relative links so framework
changes can be developed and verified without prematurely publishing npm
packages.

After Grove and Open Apps pass their full verification suites, Grove package
versions will be aligned and released together. The consumer application will
then replace local links with the verified published versions.

## Architecture and Ownership

### Grove owns

- Astro integration and build-time data generation.
- Default page layouts and navigation.
- Home, browse, detail, about, submit, contributors, 404, and sitemap page
  structures.
- Cards, index rows, filters, facets, sorting, pagination, score displays,
  GitHub signal displays, and responsive behavior.
- Base styling, theme tokens, dark mode, accessibility behavior, and SEO
  layout primitives.
- Generic project-record schema and generated index/full payloads.
- Generic GitHub synchronization and health capabilities.
- Generic sitemap and LLM output generation.

### Open Apps owns

- `grove.config.ts`.
- Open Apps records and taxonomy.
- Open Apps-specific editorial copy and methodology.
- Inclusion rules and submission guidance.
- Open Apps GitHub metadata and enrichment policy.
- Contributor/repository enrichment configuration.
- Open Apps-specific automation scripts that cannot be expressed through a
  reusable Grove command.
- Cloudflare deployment configuration.
- Public brand assets and minimal brand tokens.

### Boundary rule

If a required capability can serve multiple Grove applications, implement it
in Grove with generic naming, tests, and documentation. If it expresses Open
Apps policy or content, implement it in `open-apps-grove`.

No Open Apps-specific component override will be added during the initial
migration. A custom page is allowed only when a required feature cannot be
represented by Grove's default page set or content/configuration mechanisms.

## Grove Package Alignment

The local Grove checkout currently has inconsistent package generations:
package manifests and templates reference a mixture of `0.2.16`, `0.2.18`,
`0.2.20`, `0.2.21`, and `@grove-dev/ui` `1.0.x`.

Before treating npm packages as the migration target:

1. Audit package dependency relationships and release policy.
2. Replace stale internal dependency pins with the correct coordinated
   versions or workspace references used by Grove development.
3. Ensure the default Astro template consumes one coherent Grove package set.
4. Run Grove unit, integration, scaffold, type-check, and build gates.
5. Delay npm release until the migrated Open Apps application passes against
   the same local source.

The migration must not paper over a Grove package mismatch inside
`open-apps-grove`.

## Target Application Shape

The target repository will remain close to a standard Grove scaffold:

```text
open-apps-grove/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   └── workflows/
├── astro.config.mjs
├── grove.config.ts
├── content/
│   ├── pages/
│   └── records/
├── data/
│   ├── records/
│   ├── taxonomy/
│   ├── generated/
│   ├── decisions.yml
│   └── health.yml
├── public/
├── scripts/
├── src/
│   ├── data/
│   ├── pages/
│   └── styles/
│       └── global.css
├── package.json
├── pnpm-lock.yaml
└── wrangler.jsonc
```

The `src/pages` directory starts from Grove's default template. It will not
contain copied Open Apps UI files. `src/styles/global.css` will contain only
minimal Open Apps brand-token adjustments if configuration alone is
insufficient.

## Data Migration

Every current `open-apps/data/apps/<slug>.yml` file will become one Grove
project record at `open-apps-grove/data/records/<slug>.yml`.

The conversion preserves:

- Slug and display name.
- Description and category.
- Project type.
- Primary and secondary stacks.
- Platforms, tags, and distribution channels.
- Repository and homepage links.
- Full GitHub repository metadata accepted by Grove.
- Language statistics, release metadata, activity data, contribution files,
  labels, and synchronization metadata.
- Health status, tier, visibility, stale reason, confidence, and reasons.
- Curation state, review metadata, labels, lenses, notes, best-use cases,
  listing rationale, caveats, and scores when present.

Legacy wrapper fields such as `schemaVersion`, `id`, `app`, and the structured
legacy `stack` block will be translated into Grove's canonical project-record
fields. The migration will not retain duplicate legacy shapes after
conversion.

Taxonomy files for categories, stacks, platforms, and distribution channels
will be migrated to Grove's standard taxonomy directory. IDs and route-facing
values remain stable.

A deterministic migration script will perform the conversion. It must:

- Read every source record.
- Validate the source shape.
- Produce exactly one target record per source slug.
- Fail on slug collisions or lossy required-field conversion.
- Produce stable YAML ordering and formatting.
- Report source count, output count, warnings, and errors.

The migration test asserts that all source slugs exist in the output and that
representative rich records retain GitHub, health, curation, and taxonomy
data.

## Configuration and Routes

`grove.config.ts` will use the `project-directory` blueprint with:

- Site name `Open Apps`.
- Production URL `https://open-apps.dev.mn`.
- The current Open Apps repository URL during migration, updated to the new
  repository URL when the user moves the finished repository to its final
  remote.
- Route directory `apps`.
- Singular label `app`.
- Plural label `apps`.
- Facets for category, stacks, platforms, tags, license, and health/status
  where supported by Grove.
- GitHub integration enabled for metadata, contributors, and health.
- Open Apps navigation and copy.
- Minimal existing brand color expressed through Grove theme configuration.

The canonical routes remain:

- `/`
- `/apps`
- `/apps/<slug>`
- `/about`
- `/contributors`
- `/submit`
- `/sitemap.xml`
- `/llms.txt`
- `/llms-full.txt`

Grove's current V0 alias assumes `/apps/<slug>` redirects to `/projects/<slug>`
when the project-directory route is unchanged. Because Open Apps explicitly
configures the canonical directory route as `apps`, Grove must render
`/apps/<slug>` directly and must not create a redirect loop or alternate
canonical URL. Any fix required here belongs in Grove because configurable
canonical directory routes are a generic capability.

Existing query-string browse behavior should remain available through Grove's
default filters. Exact legacy query parameters are preserved when they map to
Grove's generic filters; obsolete presentation-only parameters are not
retained.

## UI and Content

The application uses Grove's default UI without copying:

- Open Apps layout components.
- Home-page components.
- App card/index components.
- Detail-page composition.
- Existing Tailwind class sets.
- Existing global CSS beyond minimal brand tokens.

Open Apps copy will be supplied through `grove.config.ts`, Markdown content,
and Grove-supported component props/configuration. The default Grove home
page remains structurally intact.

About and methodology content will be migrated into Grove content files.
Submission guidance and issue templates will preserve Open Apps' eligibility
rules, including the real-application requirement and current repository
quality thresholds.

If default Grove copy is hard-coded where consumer configuration or Markdown
content is appropriate, Grove will gain a generic configurable-copy
capability rather than an Open Apps component fork.

## GitHub Enrichment and Editorial Rules

The preferred steady state is to use Grove commands:

- `grove validate`
- `grove generate`
- `grove sync github`
- `grove cleanup stale`
- `grove sitemap`
- `grove llms`

Existing Open Apps scripts will be classified as:

1. Replaced by an equivalent Grove command.
2. Retained in `open-apps-grove` because they implement Open Apps policy.
3. Generalized into Grove because they provide a reusable missing capability.
4. Removed because they only supported the old UI or legacy data shape.

Open Apps-specific thresholds, editorial decisions, and submission bar remain
consumer policy. Generic GitHub API access, record updates, contributor
enrichment, and health calculation may live in Grove.

Automated workflows continue to open pull requests rather than push generated
editorial changes directly to the default branch.

## SEO and Generated Outputs

The migrated application must preserve:

- Canonical URLs under `https://open-apps.dev.mn`.
- Per-page title and description metadata.
- Open Graph and social metadata.
- `SoftwareSourceCode` JSON-LD for app detail pages.
- `robots.txt`.
- `/sitemap.xml` containing all visible app detail URLs.
- `/llms.txt` and `/llms-full.txt`.
- Static HTML output suitable for Cloudflare.

Where Grove already supplies equivalent or richer generic SEO, its output is
used directly. Any missing reusable field mapping is added to Grove's default
SEO implementation.

The migration does not require byte-for-byte metadata parity. It requires the
same public entities, canonical routes, discoverability, and structured
meaning.

## Deployment and Automation

The application remains a static Astro site deployed to Cloudflare using
`wrangler.jsonc`.

Workflows will cover:

- Install with the pinned pnpm version.
- Validate records.
- Run migration/unit tests.
- Generate Grove data.
- Type-check Astro.
- Build the production site.
- Refresh GitHub metadata on schedule.
- Synchronize repository contributor metadata.
- Report stale records.
- Deploy or produce deployment-ready output according to the existing
  Cloudflare setup.

During local development, workflow package references cannot use sibling
filesystem links. Before deployment automation becomes authoritative, Grove
must be published coherently and `open-apps-grove` must switch to npm
dependencies.

## Error Handling

- Migration failures identify the source filename and field.
- Invalid source or target records stop the migration.
- GitHub API failures preserve existing valid metadata and report affected
  records.
- Missing optional metadata renders through Grove fallbacks.
- Missing required links, names, categories, or slugs fail validation.
- Generated files are reproducible and are not treated as hand-edited source.
- Route generation fails if duplicate slugs would produce duplicate pages.

## Testing and Verification

### Grove

- Unit tests for any schema, route, config, SEO, enrichment, or template
  changes.
- Integration tests for custom project-directory route slugs.
- Scaffold test proving a generated consumer installs, generates, checks, and
  builds with a coherent package set.
- Existing Grove test, check, build, and scaffold suites remain green.

### Open Apps migration

- Source-to-target record-count equality.
- Complete slug-set equality.
- Representative field-preservation tests for simple and rich records.
- Grove validation of every migrated record.
- Generated full/index payload checks.
- Route checks for `/apps` and representative `/apps/<slug>` pages.
- No canonical `/projects/<slug>` output for the Open Apps configuration.
- SEO checks for canonical tags and app JSON-LD.
- Sitemap checks for visible app URLs.
- LLM-output checks.
- Astro type-check and production build.

### Manual acceptance

- Home page renders with Grove's default UI and Open Apps content.
- Browse, search, facets, sorting, and pagination work.
- A rich app detail page exposes repository, health, score, stack, platform,
  and editorial information through Grove's default components.
- About, submit, contributors, 404, robots, sitemap, and LLM endpoints work.
- Dark mode and responsive layouts use Grove behavior.
- No existing Open Apps component or layout has been copied.

## Delivery Sequence

1. Repair Grove package-version coherence and establish a clean baseline.
2. Add tests for configurable `/apps` canonical routing and any other proven
   reusable gaps.
3. Implement and verify the smallest generic Grove changes.
4. Scaffold `open-apps-grove` from Grove's default Astro template.
5. Initialize it as a fresh Git repository.
6. Link the consumer to local Grove packages.
7. Add the deterministic Open Apps record migration.
8. Migrate taxonomy, content, assets, configuration, workflows, and
   deployment files.
9. Remove or replace legacy scripts according to the ownership rules.
10. Run automated and manual acceptance verification.
11. Align and release Grove packages.
12. Replace local links with published npm versions.
13. Reinstall from a clean lockfile and rerun all consumer checks.

Each repository receives focused, atomic commits. Grove commits contain only
generic framework changes. Open Apps commits contain only consumer migration
work.

## Acceptance Criteria

The migration is complete when:

- `open-apps-grove` is a fresh Git repository.
- It builds as a Grove application using Grove's default UI.
- All current Open Apps slugs and required record data are present.
- `/apps` and `/apps/<slug>` are canonical and functional.
- Required SEO and generated outputs are present.
- GitHub enrichment and editorial automation have a clear working owner.
- Cloudflare production output builds successfully.
- No Open Apps UI components were copied or recreated.
- Grove contains no Open Apps-specific component or policy.
- Grove and the consumer pass their test, validation, type-check, and build
  gates.
- The consumer has switched from local links to a coherent published Grove
  release.
