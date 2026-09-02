# Changelog

All notable changes to Grove are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Grove publishes **four** packages on npm: `@grove-dev/core`,
`@grove-dev/astro`, `@grove-dev/cli`, and `@grove-dev/starlight`.
The repository also contains two private applications under `apps/`:
the canonical example/scaffold and the Starlight documentation site.

By default a version bump applies to all four packages in lockstep. The release
notes below describe the user-visible change; the affected packages are
called out in **Packages** lines.

For the developer workflow that produces these entries, see
[`apps/docs/src/content/docs/maintainers/release-process.md`](./apps/docs/src/content/docs/maintainers/release-process.md).

---

## [Unreleased]

> Working buffer for the next release. Targets are tracked in
> [`apps/docs/src/content/docs/project/roadmap.md`](./apps/docs/src/content/docs/project/roadmap.md)
> until they ship.

---

## [0.9.0] — Unreleased

A record can finally say when it joined the directory, and the update
channel a consumer needs to receive that change is reachable again.

### Added

- **`addedAt` on every record** (`resourceBaseSchema`). The date the record
  joined the directory, distinct from `curation.reviewedAt` (when a human
  last reviewed it). Optional; carried into the index payload, llms.txt's
  `added:` line, and the sitemap `lastmod` chain — all three of which read
  the field already but had nothing writing it.
  **Packages:** `@grove-dev/core`
- **`grove update --adopt`** — writes `.grove/registry.lock.json` from the
  files already on disk, so a project scaffolded before the lockfile existed
  can join the registry update channel. Adoption locks every upstream file
  at upstream's hash, which classifies local edits as `locally_modified`
  (preserved forever) and missing files as `new`. Nothing is overwritten.
  **Packages:** `@grove-dev/cli`
- **Registry items declare the `@grove-dev/*` version they need**
  (`meta.requiresGrove`). The scaffold's components read a typed model the
  packages build, so a `grove update` that runs ahead of the package upgrade
  used to fail the type-check inside a component with nothing pointing at the
  cause. `grove update` now names the mismatch and the command that fixes it.
  **Packages:** `@grove-dev/cli`, `@grove-dev/registry`
- The record sidebar's Source card shows an **Added on** line.
  **Packages:** `@grove-dev/registry` (scaffold 1.1.0)
- The submission form stamps `addedAt` on the YAML it generates, so a record
  arrives sortable instead of needing a hand-written date.
  **Packages:** `@grove-dev/registry` (scaffold 1.1.0)

### Fixed

- **`sort=recently-added` sorted on the wrong field.** It read
  `curation.reviewedAt`, so a record added today and not yet reviewed scored
  0 and landed *last* — in the one sort whose job is to surface it. It now
  reads `addedAt`, falling back to `reviewedAt` and then the repository's
  creation date for records written before the field existed.
  **Packages:** `@grove-dev/core`
- **JSON-LD `dateCreated` published the review date as the project's
  birthday.** It now uses the repository's `created_at`, which is what
  schema.org means by the field — the previous value was off by years on
  most records.
  **Packages:** `@grove-dev/astro`
- **The record sidebar's Source card was hidden whenever `reviewedAt` was
  absent**, taking the "Also in" collection list and the notes word count
  with it. Visibility no longer hinges on the review date, and the
  "Reviewed by" line renders only when there is a review to report.
  **Packages:** `@grove-dev/astro`, `@grove-dev/registry`
- **Date sorts break ties by name.** Records missing the sort key all scored
  0 and came out in index-build order — stable, but arbitrary enough to read
  as a bug.
  **Packages:** `@grove-dev/core`
- **`.gitignore` swallowed consumer lockfiles.** The repo's `.grove/` entry
  was meant for `<root>/.grove/run/` scratch projects but matched at every
  depth, including `apps/example/.grove/registry.lock.json`. Consumers that
  copied the line could not run `grove update` at all. Now anchored as
  `/.grove/`.

---

## [0.8.0] — 2026-09-01

Grove's UI stops being something you import and starts being something you
own. `@grove-dev/astro` no longer exports a single `.astro` file; the same
components ship through a [shadcn registry](https://withgrove.dev/r/) that
installs their source into your project. From then on the files are yours,
and `grove update` reconciles new upstream versions against your edits
instead of a package upgrade silently changing your site.

**This is a breaking change for every existing consumer.** See
[Migration guide](https://withgrove.dev/reference/migration/) before upgrading.

**Packages:** `@grove-dev/core`, `@grove-dev/astro`, `@grove-dev/cli`,
`@grove-dev/starlight`

### Removed

- **`@grove-dev/astro` exports no UI.** `./components/*`, `./ui/*` and
  `./layouts/*` are gone, along with the `.astro` sources behind them. Every
  `import X from "@grove-dev/astro/components/X.astro"` (and the `ui/` and
  `layouts/` equivalents) stops resolving. The package now exports only the
  Astro integration, the server-side view-model builders (`./server`), and
  `./styles.css`. The components did not disappear — they moved to the
  registry, which installs them into your `src/`.

### Added

- **A real shadcn registry.** Thirteen items — `ui`, `shell`, `project-card`,
  `taxonomy`, `collections`, `home`, `browse`, `record`, `submit`, `about`,
  `contributors`, `not-found`, and `default` (the whole 70-file site in one
  item) — served at `https://withgrove.dev/r/<item>.json` under the `@grove`
  namespace. It speaks the official schema, so `npx shadcn add @grove/browse`
  and `npx shadcn view @grove/home` work unchanged, with no React and no
  `shadcn init`.
- **`grove update`** — a three-way reconcile of your installed UI against the
  registry. Every file is classified against three states (what is on disk,
  what `.grove/registry.lock.json` recorded, what upstream now ships) as
  unchanged, upstream-changed, new, locally modified, conflicting, or removed.
  Upstream changes are applied; **files you edited are never overwritten**.
  `--check` prints the plan without writing, `--diff` prints a unified diff
  per changed file, `--json` emits a machine-readable summary, and `--force`
  takes the upstream side of a conflict. It exits `2` while a conflict is
  unresolved and keeps doing so until someone merges, so CI can gate on it.
- **`grove init` is a registry bootstrapper.** It writes `package.json`,
  `tsconfig.json`, `grove.config.ts`, `astro.config.mjs`, `components.json`
  and an empty `data/records/`, then drives the official shadcn CLI to install
  `@grove/default` from a copy bundled inside the CLI — so `init` needs no
  registry request and works offline. It finishes by recording a sha256 per
  installed file in `.grove/registry.lock.json`.

### Changed

These change the output or the structure of an existing site. Read them
before upgrading.

- **Your `src/` is plain Astro.** Pages, layouts and components are ordinary
  files in your repository with relative imports. You can remove
  `@grove-dev/astro` and the site still builds — you would lose the data
  pipeline, not the UI.
- **Engine and UI release independently.** A `@grove-dev/core` patch cannot
  change your UI, and a registry release does not require a package bump.
- **Server-side derivation moved into `@grove-dev/astro/server`.** Card and
  record-detail view models (`buildProjectCardModel`, `getRecordDetailModel`,
  `getTaxonomyPageModel`, and friends) are built there rather than inside
  components, so the installed `.astro` files stay presentational.

### Fixed

- **`@grove-dev/cli`:** the published package no longer depends on
  `@grove-dev/registry`. That package is not on npm, and `pnpm publish`
  rewrites `workspace:*` to a concrete version — so `pnpm dlx
  @grove-dev/cli@1 init` would have failed to install at all. The registry
  is now a private workspace build unit; the CLI's build copies the built
  items into its own `dist/r/`, which is also what makes `init` work
  offline. `grove init` no longer adds a registry dependency to the
  projects it scaffolds, because nothing there ever imported it.
- **Registry:** taxonomy pages built dead links on any site whose
  `routes.directory` is not the default. `taxonomy-list.astro` defaulted
  its back link — and every card `href` derived from it — to a hardcoded
  `/projects`, and no page passed the prop. On a directory that browses at
  `/apps`, that was 33 broken links across twelve pages. The default now
  comes from `indexSlug()`. The unused required `name` prop is gone.
- **`grove update`:** `--diff` did nothing. It was declared, typed, and
  documented, but never read. It now prints a unified diff for every file
  upstream moved.
- **`grove update`:** `--force` did not apply conflicts. It only changed
  the exit code. It now takes the upstream side of a conflict, and still
  never overwrites a `locally modified` file — upstream did not change
  that one, so there is nothing to merge.
- **`grove update`:** a conflict was reported once and then went quiet.
  The lockfile was stamped with the whole upstream item including files
  that were deliberately not written, so the next run reclassified the
  conflict as a plain local edit and dropped the exit code from `2` to
  `0` — and `scaffoldVersion` claimed a version the project was not on.
  The lock now carries the previous entry for any file that was
  preserved, and the version advances only once nothing is left
  unresolved.
- **`@grove-dev/astro`:** dropped the `./server/*` export, which pointed
  at `dist/server/*.js` — a directory the build excludes and has never
  produced. Nine `*.test.ts` files under `src/server/` no longer ship to
  consumers.
- **`grove init`:** checks for pnpm before writing anything. It drives
  pnpm for the shadcn install and the dependency install; without it the
  run used to die partway through with `spawn pnpm ENOENT`, leaving a
  half-written directory that then failed the "not empty" guard on
  retry.
- **Registry:** the scaffold's npm dependencies carry version ranges.
  They were bare names, so shadcn installed whatever `latest` happened to
  be — a new Astro major could land silently in a fresh scaffold.

- **Scaffold:** the consumer override stylesheet no longer imports
  Tailwind. `src/styles/system.css` already does, and Tailwind v4's Vite
  plugin treats every file that imports it as its own entry point — so
  `src/styles/global.css` was emitting a second complete Tailwind build.
  Every page downloaded ~35 KB of duplicate CSS on top of the real
  stylesheet. Found while migrating a real site onto this release.

### Internal

Gates that would have caught the bugs above, and did not exist.

- **CI:** a new `scripts/check-publishable.mjs` fails when a published
  package depends on a private one. The `grep` that was supposed to catch
  this could never fail: its own filter matched every line the search
  could emit. `pnpm test:scaffold` also builds a second site on
  non-default routes with real records — the shape that surfaces a
  hardcoded route.
- **CI:** `pnpm registry:install-check` installs `@grove/browse` off a
  loopback server, exercising the documented `shadcn add @grove/<item>`
  flow and its `registryDependencies` resolution. Only `@grove/default`,
  which inlines everything and declares no dependencies, had ever been
  installed by a test.
- **`pnpm example:sync`** copies the scaffold over `apps/example` instead
  of only rewriting the lockfile, and `pnpm example:check` now also
  reports files in the example that the registry does not ship.
- Removed four migration-era scripts that no workflow ran, one of which
  carried an absolute path from another machine, along with the
  `INVENTORY.{md,json}` artifacts they produced.

---

## [0.7.0] — 2026-08-21

Three data files that Grove validated, exported, or shipped a config flag
for turned out to have no reader at all, so the features they describe did
nothing at runtime. This release connects them. It also rebuilds the
documentation site against the source code — most pages are rewritten,
because a large amount of what was there did not match what the code does.

**Packages:** `@grove-dev/core`, `@grove-dev/cli`

### Added

- **`@grove-dev/cli`:** `grove sync github` derives a health entry per
  record via `classifyHealth` and writes `data/health.yml` at the end of
  the run, gated on `integrations.github.health`. That flag previously
  resolved to a value with no call sites anywhere in the codebase.
- **`@grove-dev/core`:** `data/overrides.yml` is applied by the build.
  Each entry's `patch` supplies top-level fields merged over the parsed
  record before validation, so a curator's correction survives every
  `grove sync github` run. The schema, the default path, and the public
  export have existed since the file was introduced; the reader had not.

### Changed

These change the output of an existing site. Read them before upgrading.

- **`@grove-dev/core`:** the build reads `data/health.yml`. `grove check`
  has always errored on a GitHub-linked record with no entry there, but
  nothing ever read the file back, so the health signals it carries never
  reached a rendered page. `generate()` now merges an entry onto any
  project record that carries no inline `health` block — an inline block
  still wins. **If your `health.yml` contains `visibility: hide` or
  `remove` entries, those records will now disappear from the index,
  the sitemap, and the llms outputs.**
- **`@grove-dev/cli`:** `grove readme generate` resolves visibility the
  way the build does — `data/decisions.yml`, then an inline `health`
  block, then `data/health.yml`, then the record's own field. It
  previously read only the record's top-level `visibility:`, which is not
  the signal a project record uses, so a record hidden by a curator
  decision still shipped in the generated README.
- **`@grove-dev/core`:** `llms-full.txt` carries record bodies. The
  `#### Detail` block that `buildDetailSection` has always supported was
  unreachable because `toLlmsRecord` never populated `detail`; it now
  reads the record's `content:` sidecar with frontmatter stripped. **This
  file now grows with your prose rather than your record count** — on the
  six-record reference space it goes from 9 KB to 53 KB.
- **`@grove-dev/core`:** `llms.txt` and `llms-full.txt` agree on their
  record count. `llms.txt`'s `Records indexed:` counted visible records
  while `llms-full.txt`'s header counted every parsed one, so the two
  disagreed on any space with a hidden record. Both use the visible count.
- **`@grove-dev/cli`:** `grove audit --page <path>` exits `1` and lists
  the declared paths when nothing matches. A path absent from
  `audit.pages[]` used to leave the page list empty, skip every loop, and
  still print a passing scorecard with exit `0` — **a typo in CI read as
  a green audit.**

### Fixed

- **`@grove-dev/core`:** `fetchGithubMetadata` resolves its token from
  `GH_TOKEN`, then `GITHUB_TOKEN`, matching `syncContributors`. It read
  only `GITHUB_TOKEN`, while the scaffolded `sync-github.yml` passes
  `GH_TOKEN` — so every scheduled sync ran unauthenticated against the
  rate-limited API path.
- **Scaffold:** `cleanup.yml`'s schedule is a plain monthly cron. The
  previous `0 5 1-7 * 1` fired roughly ten times a month rather than on
  the first Monday, because POSIX cron ORs day-of-month with day-of-week
  when both fields are restricted.

### Deprecated

- **`@grove-dev/core`:** `audit.pages[].sample`, on the
  `PageManifestEntry` type and in the config schema. Nothing has ever read
  it — `parsePageEntry()` does not look for it. It is retained so existing
  configs keep type-checking and will be removed in the next major.

### Documentation

- Every page of the documentation site was checked against `packages/`
  and rewritten where it did not match. Among the corrections: about
  fourteen function signatures on the programmatic API page that do not
  exist, six components documented on the customization page that are not
  in `packages/astro/src/components/`, an architecture page describing a
  caching layer that was never built, and a security page listing three
  supply-chain protections this repository does not have.
- The sidebar is reorganised from seven catch-all sections into nine
  grouped by reader intent. Starlight resolves sidebar items by slug, so
  no redirects were needed for the regrouping; six redirects cover merged
  and removed pages.
- Content teaching `resource-hub` and `ecosystem-map` as usable features
  was removed. Those schema shapes have no scaffold, no routes, and no
  authoring path, and are now described as schema-only.

---

## [0.6.1] — 2026-08-16

A patch release that stops the Lighthouse gate from flaking. The default
budget demanded a perfect score on every category, which a single
cold-cache run on a CI runner could not reliably hit even when nothing had
regressed.

**Packages:** `@grove-dev/core`, `@grove-dev/cli`, `@grove-dev/astro`

### Changed

- **`@grove-dev/core`:** the default audit budget moves from perfect
  scores plus `{ lcp: 1800, cls: 0.05, tbt: 100 }` to Google's "good"
  thresholds — `{ performance, accessibility, bestPractices, seo } ≥ 0.9`,
  `lcp ≤ 2500ms`, `tbt ≤ 200ms` — with CLS at the looser `0.25` bound.
  Typical single-run variance on a CI runner is ±0.05 on the score
  categories and ±50% on CLS; `--runs N` with a median is the variance
  absorber, and this budget is the floor beneath it.
- **`@grove-dev/cli`:** the audit command description and the passing
  scorecard describe the actual budget instead of claiming "100×4", which
  had stopped being true.

### Fixed

- **`@grove-dev/astro`:** the paginated browse description reads
  `pageCount` rather than the undefined `pages`, so "Browse page 2 of N"
  renders a real total.
- **CI:** `pnpm audit` ignores a specific advisory that has no fix path in
  the dependency tree, so the weekly job reports real findings instead of
  failing on a known, accepted one.

---

## [0.6.0] — 2026-08-16

The browse page is rebuilt so every directory of any size stays crawlable
without the client paying for the whole catalogue, and the **SEO surface**
lifts to the level the schema always implied — every page declares a
`PageDocument`, the framework emits a complete `<head>` (title,
description, canonical, OG, Twitter, JSON-LD) from one source, and the
per-page OG image moves from a single site-wide SVG to per-record PNG
cards rendered on the build.

**Packages:** `@grove-dev/core`, `@grove-dev/astro`, `@grove-dev/cli`

### Added

- **`@grove-dev/core`:** the JSON-LD registry — `siteSchema`,
  `breadcrumbSchema`, `collectionSchema`, `recordSchema`, `contentSchema`,
  `definePageDocument`, `buildJsonLd`, and a dev-time `validateJsonLd`.
  Every page in a Grove project declares a `PageDocument`; the framework
  emits all SEO metadata from one source instead of two (layout-side plus
  model-side) that drifted apart.
- **`@grove-dev/core`:** `site.locale`, `site.twitter.handle`,
  `site.image`, and `site.imageAlt` in `grove.config.ts`. `locale` feeds
  the JSON-LD site schema's `inLanguage`; twitter and image flow through
  the head block.
- **`@grove-dev/core`:** per-page OG image pipeline — `buildOgImages()`
  rasterizes every record, collection, and taxonomy page to a 1200×630
  PNG via satori + resvg, written under `public/og/` with a content-hash
  manifest so unchanged pages skip the rasterizer on rebuild.
- **`@grove-dev/core`:** Inter Regular + Inter SemiBold vendored as
  package assets so the OG rasterizer produces sharp glyphs without a
  network fetch.
- **`@grove-dev/core`:** the sitemap now lists collections, taxonomies,
  and every static page with trailing slashes (`build.format: 'directory'`).
  It matches the URLs the visitor actually sees and is no longer a
  separate hand-maintained fragment.
- **`@grove-dev/core`:** collection YAML loading moves here as
  `loadCollections()`. The sitemap, the OG-image pipeline, and the page
  server now read `data/collections/*.yml` from one implementation
  instead of three.
- **`@grove-dev/astro`:** `server/seo` — `seoTitle()`, `seoDescription()`,
  `titleCaseFirst()`, `recordSeoDescriptor()`, `ogPath()`, `absoluteUrl()`,
  `breadcrumbs()`, plus the `PageSeo` shape. Every page model exposes a
  `seo` block these helpers populate; `BaseLayout` consumes it verbatim.
- **`@grove-dev/astro`:** `Seo` and `BaseLayout` integrate the new SEO
  config — site locale, twitter handle, OG image override, image alt,
  JSON-LD registry. A dev-only `validateJsonLd` check fails fast on
  malformed structured data before it ships.
- **`@grove-dev/astro`:** browse pages are real, crawlable documents.
  `/{slug}/page/2/`, `/{slug}/page/3/` … are prerendered, each rendering
  only its own 20 records. The page used to print the entire directory
  into every response and let the client hide the rest; at 300 records
  that was a 1.2 MB document. It is now ~127 kB and flat with directory
  size. Filtered views — which exist only on the client — keep
  `?page=N`.
- **`@grove-dev/core`:** `hrefForFilters`, `hrefForPage`,
  `hrefForClearedFilters`, and `pagePathHref`. The page and the client
  controller each carried their own copy of this URL arithmetic.
- **`@grove-dev/astro`:** search filters as you type (150 ms debounce),
  with a clear button and a `/` shortcut. The `Search` button is gone —
  it was the strongest control on the page and its only job was to
  re-submit what the visitor could already see.
- **`@grove-dev/astro`:** applied filters are their own row of removable
  chips with `Clear all`, and the mobile filter sheet gained the same
  control.
- **`Repo / docs:** the SEO surface is documented at
  `apps/docs/src/content/docs/outputs/seo.md` so the schema, the
  per-page model, and the configuration all live next to each other.

### Changed

- **`@grove-dev/astro`:** every scaffold page consumes the new `seo`
  blocks. Bare `<title>` / `<meta name="description">` defaults
  disappear.
- **`@grove-dev/astro`:** SEO helpers tightened; the duplicate `hostOf`
  (one in core, one in astro) collapses to `@grove-dev/core/host.js` so
  the static OG SVG and the per-page PNG rasterizer print the same host
  for the same config.
- **`@grove-dev/astro`:** page-level descriptions are computed in the
  page model (`getHomepageModel`, `getDirectoryIndexModel`, etc.)
  instead of in the layout. The model owns copy; the layout owns markup.
  `recordFallbackSentence` is shared so `Sites`, an empty record
  description, and the homepage fallback don't drift.
- **`@grove-dev/core`:** `activeFilterChips` now returns
  `{key, value, label, href}` and takes the taxonomy, so a chip carries
  its own remove URL and a display name. The server rendered
  `Stack: react-native` while the client rewrote the same chip to
  `Stack: React Native`.
- **`@grove-dev/astro`:** the browse page dropped the lens tabs and the
  "All projects / Every item in the directory" heading pair. The tabs
  wrote `sort=` params, so they and the sort select were one state
  rendered twice, and the page named the same list three times. The
  result count is the heading now: `76 apps · sorted by … · page 2 of 4`.
- **`@grove-dev/astro`:** the record index moved out of the HTML into
  `/{slug}/page/records.json`, fetched on first intent (pointer or
  focus reaching the controls) rather than inlined on every page.

### Fixed

- **`@grove-dev/astro`:** the TOC active-item state drops its pill
  background in favour of a left-rail accent and the count chip is
  removed from the eyebrow. A flat list reads as navigation, not as a
  stack of buttons.
- **`@grove-dev/astro`:** the browse search field's `/` hint used to
  float 10px from the input's trailing edge and the input reserved
  `pr-16` (64px) of right-zone. It now anchors at `right-2` to match
  the clear button, and the input only reserves `pr-10`, so the
  placeholder reads up to the chip without pushing the layout.
- **`@grove-dev/example`:** the contributors page header no longer
  double-pads — the section already carries `py-12 sm:py-16`, and the
  inner div contributed another vertical block before any content ran.
- **`@grove-dev/example`:** the browse page (`/{slug}`) suppresses its
  JSON-LD until the SEO helpers are reachable. Previously it emitted an
  empty `PageDocument` placeholder.
- **`@grove-dev/core`:** `audit --profile=desktop` reported zero
  violations on a directory that previously left an empty
  `PageManifestEntry` for the empty route — a false-positive "everything
  passed" that masked the missing entry from the manifest.
- **`@grove-dev/astro`:** card and record-header logos had no `onerror`,
  which made the initials fallback unreachable for any record with a
  GitHub owner — a dead logo URL or a renamed org rendered the
  browser's broken-image glyph. Both now reveal initials, the same way
  `Icon` does.
- **`@grove-dev/astro`:** card descriptions are trimmed on a word
  boundary before the two-line clamp. A CSS clamp cuts at whatever
  character the box runs out of room on, which is how a grid ended up
  reading "…and multi-", "…and retrieval", "…an".
- **`@grove-dev/astro`:** the disabled pagination control sat at 3.37:1
  against the dark surface — a contrast failure, not a disabled state.

### Migration

- **No required changes.** The head block still reads `BASE_URL` and
  `SITE_NAME`. If a consumer relied on `site.twitter: { handle: '…' }`
  not flowing into the home JSON-LD, see the new `site.twitter.handle`
  config key.
- **Dev-only validation:** `validateJsonLd` logs the offending node to
  the dev console with a backtrace. Previous builds only learned about
  malformed structured data from Google Search Console's structured-data
  report, which arrives weeks after the bad node ships.
- **`@grove-dev/astro` consumers:** every page model now returns
  `{ seo: PageSeo, … }`. Layouts that previously accepted `title` /
  `description` / `image` / `jsonLd` props continue to work — `BaseLayout`
  forwards both shapes — but the canonical API is `seo.*`.

---

## [0.5.5] — 2026-08-16

**Packages:** `@grove-dev/core`, `@grove-dev/astro`

### Added

- **`@grove-dev/astro`:** `PoweredBy` — a "Powered by Grove" link with
  the Grove mark, rendered under the footer brand block. The mark is
  **inlined**, not served through `<img src>`: an SVG loaded as its own
  document cannot see page CSS, so `currentColor` would never resolve
  there — the same trap the packaged icon set fell into before 0.5.3.
  Inlined, it inherits the surrounding text colour and follows the
  site's theme toggle.
- **`@grove-dev/core`:** `footer.poweredBy` in `grove.config.ts`,
  default `true`. Set it to `false` to drop the attribution.
- **`@grove-dev/astro`:** `Hero` now exposes a named `eyebrow` slot.
  The current dot + text stays as the fallback, so nothing changes
  until a consumer fills it — useful for putting `PoweredBy` (or a
  release badge) on the eyebrow line without forking the component.

### Changed

- **`@grove-dev/astro`:** the header, the footer, and the stack,
  category, and license templates were pinned to a hardcoded 1400px
  while page content followed `theme.containerWidth`. On any site that
  configured a narrower container the shell overhung the body — 1400 vs
  1152 on a `72rem` site — and browse-style pages disagreed with the
  homepage. Every shell and page template now uses the configured
  container, so a site has **one** width. `Container`'s `size="wide"`
  survives as an opt-in but is clamped to the configured container, so
  a wide section can no longer overhang the shell.

---

## [0.5.4] — 2026-08-16

**Packages:** `@grove-dev/astro`

### Fixed

- **`@grove-dev/astro`:** icon `<img>` elements now carry an explicit
  CSS size, not just `width`/`height` attributes. The vendored SVGs
  ship a `viewBox` and no intrinsic size, so the browser re-derived the
  box once one loaded and the row reflowed — Lighthouse reports it as
  "media element lacking an explicit size".
- **Repo:** `grove-audit.test.ts` matched both the `integration` and
  `integration-audit` vitest projects, so `pnpm test` ran the Lighthouse
  gate twice at once — two `astro preview` servers racing for port 4321
  and two Chrome instances competing for CPU. The audit asserts a
  perfect 100 against a 0.05 CLS budget, which only holds on an
  unloaded machine, so the pair starved each other and one failed at
  random. The audit now runs once, after the other integration work.

---

## [0.5.3] — 2026-08-16

Brand and platform icons are now **real, vendored logos** that stay
legible in both themes. Marks with no colour of their own are painted
black on light and white on dark instead of shipping as a
hand-maintained light/dark file pair, and the packaged set is generated
from a declarative config rather than copied in by hand.

**Packages:** `@grove-dev/core`, `@grove-dev/astro`, `@grove-dev/cli`

### Added

- **`@grove-dev/astro`:** `Icon` classifies every packaged icon as
  `color` or `mono`. `color` is the default and every brand with a
  palette keeps it. `mono` is reserved for marks with no colour to
  lose — Apple, Rust, Tauri, Solidity, Deno, plus the concept glyphs —
  which render as a CSS-masked `<span>` painted from
  `--grove-foreground`: solid black on light, solid white on dark,
  matching how those brands are actually presented. Override
  `--grove-icon-mono` to tint one; pass the new `kind` prop to
  classify a consumer-supplied mark.
- **`@grove-dev/astro`:** the integration syncs its packaged icon set
  into the consumer's `public/icons/` during `astro:config:setup`, so
  the artwork arrives in the same build that starts requesting it.
  Ownership is tracked by sha256 in `public/icons/.grove-icons.json`;
  files you have edited are kept and reported.
- **`@grove-dev/cli`:** `grove icons sync [--force] [--check]` — restore
  the packaged set over local edits, or fail CI when it has drifted.
- **`@grove-dev/core`:** `site.logo` and `site.favicon` in
  `grove.config.ts`. Without them the header keeps its neutral mark and
  the favicon falls back to a square tinted with `theme.primaryColor`
  instead of a hardcoded near-black.
- **Repo:** `pnpm icons:sync` / `pnpm icons:check`, driven by
  `scripts/icons.config.mjs`. Artwork is vendored offline from
  `@iconify-json/simple-icons` and `@iconify-json/logos` (both CC0-1.0);
  concept glyphs live in `scripts/icons/local/`. `icons:check` runs in
  CI, and `packages/astro/src/icons.test.ts` enforces the structural
  invariants (no baked color in a mono mark, no orphan files, no
  `<text>`, no theme-variant leftovers).

### Fixed

- The Apple mark rendered **white on white** in light mode and black on
  black in dark: `apple-light.svg` was the white artwork but was served
  when the resolved theme was `light`. The light/dark file pair and the
  `img.src`-swapping script that drove it are both gone.
- `currentColor` never worked in any icon. An SVG loaded through
  `<img src>` is a separate document that page CSS cannot reach, so
  `platforms/{chromeos,desktop,embedded}.svg` and `stacks/ionic.svg`
  had been rendering black in dark mode since they were added.
- `platforms/ios.svg` (solid black) and `platforms/macos.svg` (solid
  white) were each invisible in one theme — `category="platform"` gets
  no alias, so neither reached the Apple theme-swap.
- `stacks/rust.svg` was white-only and `stacks/solidity.svg`
  black-only; `stacks/tauri.svg` had no fill at all.
- Five icons (`llm`, `sveltekit`, `django`, `node.js`, `clojurescript`)
  embedded a `<text>` element, which renders as an illegible smudge at
  10–18px. `llm` and `rag` were invented navy tiles rather than marks.
- Duplicate `node.js.svg`/`nodejs.svg`, and drift between the packaged
  icons and the `grove init` scaffold's copy — both are now generated
  from one source and asserted byte-identical.

### Removed

- The dead `icon:` field in `data/taxonomy/{stacks,platforms}.yml`. It
  serialized into `site-config.json` and was read by nothing, which
  made it look like a supported extension point. `Icon` resolves by
  taxonomy `id`.
- `Icon`'s `mode` prop is now a deprecated no-op, kept for one minor
  release so `mode="auto"` does not become a type error.

---

## [0.5.2] — 2026-08-16

The browse page's lens tabs stop being filters and become **ordering
views**. Every tab now shows the whole directory in a different order,
so a visitor can never land on an empty list by clicking a tab.

**Packages:** `@grove-dev/core`, `@grove-dev/astro`

### Added

- **`@grove-dev/core`:** new `recently-updated` lens, labelled
  **"Actively developed"**, which orders the directory by
  `github.pushedAt` (`toParams()` → `{ sort: "recently-updated" }`).
  It joins the existing `new` lens ("Recently added") as the second
  ordering view.
- **`@grove-dev/astro`:** `SmartLensTabs` and `RefinePanel` accept a
  `layout` prop (default `true`). Pass `layout={false}` when the caller
  owns the root's layout — e.g. `layout={false} class="contents"` to
  promote the tabs or filter triggers into the parent's flex row.

### Changed

- **`@grove-dev/core`:** **`PRIMARY_LENSES` is now
  `["all", "recently-updated", "new"]`** — previously
  `["all", "hot", "mature", "production-like", "good-to-learn"]`.
  The label-based (`hot`, `mature`) and curator-assigned
  (`production-like`, `good-to-learn`) lenses remain in `LENSES` and
  still work as `?label=` / `?lens=` deep links; they are no longer
  tabbed because they *filter* rather than *order*, and render empty
  on any directory that does not populate `curation.labels` /
  `curation.lenses`.

  Sites that want the old tab set back can pass the ids explicitly:

  ```astro
  <SmartLensTabs
    lensIds={["all", "hot", "mature", "production-like", "good-to-learn"]}
    currentParams={Astro.url.searchParams}
    pathPrefix={`/${slug}`}
  />
  ```

- **`@grove-dev/core`:** `hrefForLens()` now also clears `sort` when
  building a tab link. Lens tabs own the ordering, so a `sort` left
  over from another tab would otherwise keep that tab active next to
  the one just clicked. The refinement filters — `q`, `stack`,
  `platform`, `category`, `license`, `tag` — are still preserved
  across a view switch.

### Fixed

- **`@grove-dev/core`:** `isLensActive("all", …)` no longer reports the
  "All" tab as active when a sort-based lens already claims the current
  params. `"all"` had only checked `lens` / `label` / `status`, so
  `?sort=recently-updated` lit up both "All" and "Actively developed"
  at once.
- **`@grove-dev/astro`:** `class="contents"` on `SmartLensTabs` and
  `RefinePanel` silently did nothing. Both components hardcoded
  `flex …` on their root and appended the caller's class after it;
  because Tailwind v4 emits `.contents` *before* `.flex`, the `flex`
  rule won at equal specificity and the element never became
  `display: contents`. Any layout the parent expected to apply to the
  promoted children — wrapping, gaps, `max-md:flex-col` — was
  therefore inert. Use the new `layout={false}` prop.

---

## [0.5.1] — 2026-08-16

### Fixed

- **`@grove-dev/astro`:** the published tarball omitted `src/ui`, so
  **every consumer build failed** with
  `Could not resolve '../ui/button.js'` from
  `src/components/OriginalCollection.astro`. The `exports` map already
  declared `./ui/*`, but `files` never shipped the directory. Added
  `src/ui` to the `files` allowlist.

---

## [0.5.0] — 2026-08-07

### Added

- **`@grove-dev/cli`:** new `grove import <url>` command — wraps the
  existing `importAwesomeList` + `writeImportedRecords` parser from
  `@grove-dev/core` so contributors can turn an awesome-list README
  (URL or local path) into `data/records/<slug>.yml` files tagged
  `source: { type: "import" }`. Implements the v0.5.0 roadmap item
  "`grove import` CLI".
- **CI hygiene:**
  - `.github/workflows/ci.yml` now runs `pnpm test` as a separate
    `unit` job, so the 22 unit tests across
    `@grove-dev/{core,ui,astro,cli,starlight}` gate every PR.
    Previously only the scaffold smoke test ran on PRs.
  - `ci.yml` and `audit.yml` declare `permissions: { contents: read }`
    so the GitHub Actions token cannot accidentally write. The
    Lighthouse audit job alone escalates to `pull-requests: write`
    for its PR-comment step.
- **Docs lint:**
  - New `scripts/check-starlight-internal-links.mjs` walks every
    Markdown / MDX file under `apps/docs/src/content/docs/`,
    extracts markdown links, reference-style links, and HTML
    anchors, and asserts each `/path/to/page/` target resolves
    to an existing `.md` / `.mdx` file under that root.
  - `pnpm docs:check` now runs both sidebar and link checks;
    `ci.yml` invokes it on PRs.
- **Lighthouse PR feedback:** `.github/workflows/lighthouse-audit.yml`
  posts a Markdown scorecard (budget violations) as a single
  update-in-place comment on the PR. Previously only the artifact
  was visible.

### Changed

- **Docs edit links:** `apps/docs/astro.config.mjs` Starlight config
  now sets `editLink.baseUrl` explicitly to
  `https://github.com/tortuvshin/grove/edit/main/apps/docs/src/content/docs`,
  so the "Edit this page" link on every docs page resolves to the
  real source path (was previously inferring the wrong default).
- **YAML loader hardened:** every `parse(text)` call in
  `@grove-dev/core` (io.ts readYamlFile, validate.ts, build-data.ts,
  decisions.ts, schema.ts parseRecordYaml) now passes
  `{ schema: "core" }` so the `yaml` package does not interpret
  custom tags (`!!binary`, `!!js/function`, anchor expansion, etc.)
  from untrusted input. The default schema is YAML 1.2 + extras;
  `core` is the safer 1.2-only baseline.

### Fixed

- **Test:** `tests/integration/grove-audit.test.ts` now passes
  `--host 127.0.0.1` to `astro preview` so the audit previews bind
  on the IPv4 interface the test then polls. The previous default
  (`localhost` → IPv6 `[::1]`) silently produced timeouts on macOS,
  or worse, connected to a different project's IPv4 listener on
  the same port.

---

## [0.4.0] — 2026-07-30

### Added

- **`@grove-dev/cli`:** new `grove collection promote` command — promotes a
  filter URL (e.g. `/browse?stack=flutter&category=finance`) into a
  curated `data/collections/<slug>.yml` file. See the
  [CLI reference](apps/docs/src/content/docs/reference/cli.md#grove-collection-promote).
- **`@grove-dev/cli`:** new `grove readme generate` command — renders the
  project `README.md` between the `<!-- grove-readme:start -->` and
  `<!-- grove-readme:end -->` sentinels as a canonical awesome-list
  (sindresorhus/awesome format). Supports `--stdout`, `--path`, and
  `--check` for CI.
- **`@grove-dev/core`:** the `syncContributors` pipeline paginates the
  GitHub API end-to-end and writes `repo-stats.json` consumed by
  `generate()` for site stats.
- **`@grove-dev/core`:** browser-safe `@grove-dev/core/directory`
  subpath exposing `filterRecords`, `sortRecords`, `paginateRecords`,
  `scoreRecords`, `hrefForLens`, and display labels without pulling
  config loading or filesystem dependencies into the client bundle.

### Changed

- **`@grove-dev/cli`:** the `sync` command now takes a positional
  `<github|contributors>` argument instead of two separate commands.
- **`@grove-dev/astro`:** supports Astro 6 and Astro 7; reads the
  canonical build URL directly from `grove.config.ts`; consumer-owned
  pages are never overwritten by package maintenance.
- All four packages are pinned at `0.4.0` in lockstep. The `pnpm release`
  script (`scripts/release.mjs`) bumps `core → astro → cli → starlight`
  in dependency order.

### Fixed

- **`@grove-dev/core`:** contributor sync no longer silently stops at
  100 contributors; pagination handles large repos.
- **`@grove-dev/astro`:** custom stack and platform SVGs load without a
  package-owned icon registry; primary/supporting stacks are
  deduplicated consistently on cards, facets, and detail pages.

**Packages:** `@grove-dev/core`, `@grove-dev/astro`, `@grove-dev/cli`,
`@grove-dev/starlight`.

---

## [0.3.4] — 2026-07-23

### Added

- **`@grove-dev/core` / `@grove-dev/astro`:** adds optional config-wide GA4
  analytics and config-driven default `robots.txt` and social image artifacts.
  Replacing a generated marker file transfers ownership to the consumer and
  prevents Grove from overwriting custom assets.
- **`@grove-dev/cli`:** the single Astro scaffold now includes a practical
  consumer README and MIT license.

### Changed

- **`@grove-dev/astro`:** supports Astro 6 and Astro 7, reads the canonical
  build URL directly from `grove.config.ts`, and lets directories use their own
  noun for the unfiltered browse lens.
- Removes dead scaffold content pages and the Open Apps-specific legacy route;
  initialized projects contain only the working consumer-owned pages.

### Fixed

- **`@grove-dev/astro` / `@grove-dev/core`:** custom stack and platform SVGs
  now load without a package-owned icon registry, and primary/supporting stacks
  are deduplicated consistently on cards, facets, and detail pages.
- **`@grove-dev/core`:** contributor sync paginates the GitHub API instead of
  silently stopping after the first 100 contributors.

**Packages:** `@grove-dev/core`, `@grove-dev/astro`, `@grove-dev/cli`.

---

## [0.3.2] — 2026-07-23

### Added

- **`@grove-dev/core`:** adds the browser-safe `@grove-dev/core/directory` entry point for canonical filtering, sorting, facets, display labels, pagination, and curated lens URL rules.
- **`@grove-dev/astro`:** adds reusable directory view-models and a client controller so consumer-owned pages can stay thin while keeping URL-driven discovery behavior consistent.
- **`@grove-dev/core` / `@grove-dev/astro`:** adds config-driven footer columns, submission copy, and browse/submission facets; record tags are now a first-class facet separate from controlled taxonomy.

### Changed

- **`@grove-dev/cli`:** focuses the CLI on `init`, `check`, `sync`, and `cleanup`; `grove init` now copies the single working Astro example instead of selecting templates, frameworks, or blueprints.
- **`@grove-dev/astro`:** makes generated project routes permanently consumer-owned. Grove packages own domain logic, adapters, layouts, and components without overwriting application pages during maintenance.
- Groups the private applications under `apps/example` and `apps/docs`; the example remains the only scaffold source bundled into `@grove-dev/cli`.

### Fixed

- **`@grove-dev/astro` / `@grove-dev/core`:** makes search, sort, facets, active-filter chips, and all curated lenses use one canonical filter contract in static pages. Lens links now preserve unrelated query state, active UI state hydrates from the live URL, and empty demo lenses have real curated records.
- Treats Recently added as a true sort over every record instead of a `new` label filter, keeps sort state when clearing filters, and removes the duplicate Recently added lens tab.
- Keeps selected lens and facet text readable on hover and places curated views and configured facets in one responsive toolbar row.
- Aligns directory search, sort, lens, and filter control sizing across desktop and mobile layouts.
- Improves repository statistics, contributor presentation, icon fallback behavior, submission drafting, and homepage calls to action in the canonical example.

**Packages:** `@grove-dev/core`, `@grove-dev/astro`, `@grove-dev/cli`.

---

## [0.3.1] — 2026-06-30

> **Docs-only patch.** Every change since `v0.3.0` (2026-06-11) has been
> on the documentation site (`apps/docs/`), the production-side home page,
> and transitive dev-dependency bumps. **No `@grove-dev/*` package source
> code has changed.** Framework support, blueprints, CLI commands,
> generated outputs, and schema are unchanged from `v0.3.0`.

### Fixed

- **Production-site honesty pass on the standalone `/` page.** The home page no longer advertises commands, file names, or framework support that don't exist in the code:
  - The mock terminal prompt and the "Get Started" lifecycle section no longer show fake `grove add` and `grove deploy` commands. The lifecycle now reflects the V1.0 CLI commands (`import`, `validate`, `sync github`, `generate`, `sitemap`, `llms`, `build`, `cleanup stale`, `workflows sync`) and the real default Astro workflow.
  - The mock terminal writes `grove.config.ts`, matching the file the Astro default template actually emits. (The previous mock said `grove.config.yaml`.)
  - The eight-framework logo wall is replaced with an honest "Astro today, SvelteKit / Next.js planned" status card plus the actual public package list (`@grove-dev/core`, `@grove-dev/ui`, `@grove-dev/cli`). Tailwind / Node.js / GitHub are no longer presented as framework adapters — they're tooling, not adapters.
  - The "Integrate with your favorite tools" orbital diagram is replaced with "One source, multiple outputs" (static HTML, `sitemap.xml`, `llms.txt`, `llms-full.txt`).
  - The "Why Grove" features section is reframed around the maintenance problem Grove actually solves (structure drift, stale metadata, review-as-cleanup, discovery-as-software, AI-readable fragments, maintainer-memory dependence) instead of generic capabilities.
- **JSON-LD `SearchAction` removed.** The `WebSite` block in the home page (`apps/docs/src/layouts/HomeLayout.astro`) and the global Starlight `head` config (`apps/docs/astro.config.mjs`) no longer advertise a `https://grove.dev.mn/search?q=...` target. The route never existed; emitting it was invalid structured data.
- **Roadmap page renders correctly.** The `/roadmap/` route no longer prints the raw `import { Content } from '../../../roadmap.md';` statement as visible page text. The content is now inlined as a Starlight `.md` content file, evaluated through the Starlight content layer.
- **Wrong GitHub organisation.** All references to `grove-dev/grove` in source and content are replaced with the correct `tortuvshin/grove`. `https://github.com/grove-dev/grove/...` was returning 404.
- **Lucode / lucas-labs user-visible branding.** The "Lucode" and "lucas-labs" strings in the docs site footer and four content files are replaced with "Grove Starlight". Internal `packages/starlight/` source may keep upstream names with `@deprecated` aliases for downstream stability.
- **Two broken internal links in Getting Started.** `/getting-started/add-your-first-record/` (typo) → `/getting-started/add-your-first-project/`. `/getting-started/what-is-grove/` → `/introduction/`.
- **Software version drift on the home page.** The `softwareVersion` field in the homepage JSON-LD is corrected from `0.2.x` to `0.3.0`.
- **Home and roadmap images** carry explicit `width` / `height` attributes and `loading="lazy"` to prevent layout shift and reduce initial paint cost. The home images that are decorative carry `alt=""`.
- **Home sections** are now wired to their headings via `aria-labelledby`, every CTA links to a real destination (no `href="#"` placeholders), and the main landmark carries an `id="main-content"` skip target.
- **Open-graph / Twitter metadata** is emitted on every page through the Starlight `head` config.

### Changed

- **Roadmap document rewritten.** The new `/roadmap/` page groups content by shipping status (Shipped / Next release / Later / Out of scope) instead of by wave narrative. The historical Wave 0 → Wave 5 plan is preserved as a link to the GitHub history.
- **Dep bumps:** `astro` 6.4.6 → 7.0.3, `tailwindcss` 4.3.0 → 4.3.2, `@types/node` 25.9.2 → 26.0.1.

**Packages:** none (docs-only).

---

## [0.3.0] — 2026-06-11

> **Initial public release.** The first version of Grove that is ready to
> be picked up by a community. A real production space
> ([Open Apps](https://open-apps.dev.mn)) already runs on it.

This entry folds in the V0→V1 migration that had accumulated in the
`[Unreleased]` buffer through 0.2.3–0.2.16. Per-patch entries for that
range are intentionally not reconstructed; the git history of
`CHANGELOG.md` is the working record.

### Added

- **Three V1 blueprints.** Discriminated `Resource` union keyed by `kind`:
  - `project-directory` → `kind: project` — apps, packages, tools, services, repositories, internal systems. GitHub metadata optional. **V1 default, polished default pages.**
  - `resource-hub` → `kind: resource` — guides, comparisons, explainers, links, knowledge collections. Has a `type` and a `topic`. **Data flow only in V1; polished default pages deferred.**
  - `ecosystem-map` → `kind: entity` — organizations, products, communities, schools, ecosystem actors. Has a `type` and optional `founded` / `location` / `members` / `parent`. **Data flow only in V1; polished default pages deferred.**
- The `kind` field is required and validated against the blueprint in `grove.config.ts` at validation time.
- `--deploy <provider>` writes a provider-specific config file (`vercel.json`, `netlify.toml`, `wrangler.jsonc`, or a GitHub Pages workflow) plus a matching `.github/workflows/deploy-<provider>.yml`. The `none` value writes no deploy workflow.
- Project configuration: `.editorconfig`, `.prettierrc.json`, `.prettierignore`.
- `.github/` directory: issue templates (bug, feature, docs, question), pull request template, `FUNDING.yml`, `dependabot.yml`, `SUPPORT.md`.
- CI workflows: `ci.yml` (build, type-check, scaffold smoke test, repo hygiene checks) and `audit.yml` (weekly `pnpm audit`).
- Root `CHANGELOG.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `LICENSE` (MIT).
- `apps/docs/src/content/docs/maintainers/release-process.md` and `apps/docs/src/content/docs/maintainers/security.md` to round out the contributor-facing documentation.
- Dependabot configured to ignore `@grove-dev/*` workspace deps (the release script owns those rewrites).
- The Astro default template ships **22 components** (`Hero`, `ItemCard`, `IndexRow`, `Pagination`, `RecordSection`, `RefinePanel`, `ScoreBars`, `SmartLensTabs`, `ExploreByCategory`, `ExploreByStack`, `WhyThisExists`, `CurationGrid`, `ContributorsGrid`, `StackGrid`, `Icon`, `MinimalAbout`, `OriginalCollection`, `DecisionRow`, `FilterGroupMenu`, `FilterOptions`, `CategoryGrid`) and **one layout** (`BaseLayout`).
- 11 GitHub Actions workflows generated by `grove new --github public` mode (validate, build, deploy, sync-github-metadata, sync-contributors stub, cleanup-stale-records, update-records, …).
- `llms.txt` and `llms-full.txt` generated at build time (via `grove llms`).
- `sitemap.xml` generated at build time (via `grove sitemap`).

### Changed

- **V0→V1 naming migration.** Internal component and type names aligned with the V1 `record` / `IndexRecord` / `Resource` convention. The V0-published Astro package's `ItemCard` name is **retained** for downstream stability; all other V0→V1 renames are listed below. V0 `/apps/<slug>` URLs resolve via a static 301 redirect generated by the Astro template.
  - `@grove-dev/astro`: `AppsIndexRow.astro` → `IndexRow.astro`; `AppsPagination.astro` → `Pagination.astro`; `ItemSection` → `RecordSection`.
  - `@grove-dev/astro`: `ItemsFilters` → `IndexFilters`; `ItemsSort` → `IndexSort`; `AppsFilters` / `AppsSort` (type aliases) **removed**; `filterItems` → `filterRecords`; `filterApps` (alias) **removed**.
  - `@grove-dev/astro`: dynamic route files renamed from `[itemSlug].astro` to `[recordSlug].astro`; client-side `data-item-slug` / `dataset.itemSlug` → `data-record-slug` / `dataset.recordSlug`.
  - `@grove-dev/astro/templates/default`: `itemSlug()` → `recordSlugConfig()`; config field `itemSlug` (deprecated) → `recordSlug` (canonical, `itemSlug` kept for V0 backwards-compat).
  - `@grove-dev/core`: `curatedConfigSchema` → `blueprintSchema`; `defineGroveConfig` → `defineConfig`; `resourceSchema` (single) → `projectRecordSchema` / `resourceRecordSchema` / `entityRecordSchema` (split per `kind`); `itemsFileSchema` **removed**; `buildData` → `generate` (library form); `buildLlmsFiles` → `buildLlmsTxt` + `buildLlmsFullTxt` (split into two functions); `pickReviewCandidates` → `pickCleanupCandidates`; `buildReviewReport` **removed**; `parseAppYaml` / `normalizeAppRecord` / `toIndexApp` **removed**; `validateProject` / `validateAppRecord` **removed** (validation is part of `generate`); `ghFetch` / `pLimit` are now **internal** to `github-client.ts`, not part of the V1 public surface.
  - `@grove-dev/ui`: V0 `0.0.0-roadmap` stub replaced with V1 `1.0.x` — 5 typed modules over `IndexRecord`: `filterRecords`, `sortRecords`, `paginateRecords`, `scoreRecords`, `format`. Adapter barrels re-export the same primitives.
  - Astro template URL convention: canonical V1 detail URL is `/<blueprint>/<record-slug>` (e.g. `/projects/coolify`).
- `@grove-dev/cli`: `--framework` now refuses `nextjs` and `svelte` with a clear error (V1 supports `astro` only; `nextjs` lands in V1.2, `svelte` in V1.1).
- `@grove-dev/cli`: V1 scaffolds **Astro** projects only.
- `packages/nextjs/templates/default/package.json` and `packages/svelte/templates/default/package.json` rewritten to use V1 CLI commands.
- `scripts/test-scaffold.mjs` tests the Astro scaffold path only.
- All seven `@grove-dev/*` packages are now published with consistent metadata (`homepage`, `repository`, `bugs`, `publishConfig`).

### Removed

- `--framework nextjs` and `--framework svelte` from `@grove-dev/cli`. The `Framework` union is now `"astro"` only. The Next.js and SvelteKit adapter packages still exist (no source files changed) but their templates are skeleton-only and do not scaffold a runnable project. They return as scaffold options in V1.1 (SvelteKit) and V1.2 (Next.js).
- The `nextjs` and `svelte` branches in `FRAMEWORK_LABELS`, the framework select prompt, and the help text for `grove new` / `grove run`. The `detectFramework()` / `frameworkBuildCommand()` / `frameworkDevCommand()` helpers no longer have a non-astro branch.

### Fixed

- `grove new --framework nextjs` no longer silently produces a half-populated project. It exits with `Unknown framework: nextjs` and a hint to use `astro` (or wait for the relevant release).
- `scripts/test-scaffold.mjs` no longer attempts to scaffold `nextjs` / `svelte` projects. It is an Astro-only smoke test.
- Scaffold step now rewrites `workspace:*` deps only at publish time, avoiding the "404 on a version that doesn't exist yet" install failure.
- Layout-level tokens for container widths now align with Starlight's design system.
- Resolved the import path of Starlight's reset / util styles so the build no longer relies on a fragile `node_modules` lookup.

### Migration

- **Source code:** search-and-replace V0 names with the V1 canonical names in any custom Astro template that imports from `@grove-dev/astro`. See the table above.
- **URLs:** existing `/apps/<slug>` links continue to work via 301 redirect to `/projects/<slug>`. No action required.
- **Data:** records remain in `data/records/<slug>.yml` (no data migration needed). The V0 `data/apps/*.yml` layout is gone.
- **Config:** `grove.config.ts` shape is unchanged. The `blueprintConfig.itemSlug` field is kept as an alias of the V1 canonical `recordSlug` for backwards-compat.

**Packages:** all seven (with `@grove-dev/starlight` and `@grove-dev/nextjs` / `@grove-dev/svelte` published as skeleton-only at `0.2.20`).

---

## [0.2.2] — 2025-06-10

### Added
- Removal of the deprecated landing and showcase pages; the
  `@grove-dev/starlight` theme now serves as the docs site shell.
- `@grove-dev/astro` ships the V1 components, layouts, design tokens,
  and default template. Next.js and SvelteKit remain roadmap adapters.
- Optional `g-container-wide` layout class for wider landing-page
  sections.
- Virtual module stubs for Starlight components in `@grove-dev/astro`
  (improved theme integration).

### Changed
- All six `@grove-dev/*` packages are now published with consistent
  metadata (`homepage`, `repository`, `bugs`, `publishConfig`).

### Fixed
- Layout-level tokens for container widths now align with Starlight's
  design system.
- Resolved the import path of Starlight's reset / util styles so the
  build no longer relies on a fragile `node_modules` lookup.

**Packages:** all six.

---

## [0.2.1] — 2025-06-09

### Added
- `grove analyze` command: refreshes GitHub activity, release, and
  archive-state signals for every record in the space.
- `grove validate` command: strict-mode validation with detailed
  per-record issue reporting.
- `grove import` command: accepts GitHub awesome-list URLs and produces
  one YAML record per resource.

### Changed
- `@grove-dev/core` consolidates the resource schema, importers,
  validators, taxonomy, sitemap, and `llms.txt` generation in a
  single headless package.
- `@grove-dev/cli` orchestrates the `core` commands. The framework
  adapters (`astro` / `nextjs` / `svelte`) are now peer dependencies.

### Fixed
- Scaffold step now rewrites `workspace:*` deps only at publish time
  (via `pnpm publish`), avoiding the "404 on a version that doesn't
  exist yet" install failure.

**Packages:** `@grove-dev/core`, `@grove-dev/cli`.

---

## [0.1.0] — 2025-05-21

### Added
- Initial public release of the Grove monorepo.
- `@grove-dev/core` — headless engine.
- `@grove-dev/ui` — framework-agnostic UI primitives (filter, sort,
  stats, slug helpers). Roadmap-only at this version; not yet
  consumed by adapters.
- `@grove-dev/cli` — `grove new`, `grove import`, `grove analyze`,
  `grove validate`, `grove build-data`, `grove sitemap`, `grove build`,
  `grove dev`.
- `@grove-dev/astro` — first framework adapter, with a default
  template.
- Example space `examples/openapps`.

**Packages:** all six.

---

## Release tag format

- Repository tags use the form `vX.Y.Z` and are created **manually**
  after `scripts/release.mjs` finishes publishing. See
  [`apps/docs/src/content/docs/maintainers/release-process.md`](./apps/docs/src/content/docs/maintainers/release-process.md) for the full workflow.
- The `Versions` table in `SECURITY.md` describes the support window
  per release line.

[Unreleased]: https://github.com/tortuvshin/grove/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/tortuvshin/grove/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/tortuvshin/grove/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/tortuvshin/grove/compare/v0.5.0...v0.6.0
[0.4.0]: https://github.com/tortuvshin/grove/releases/tag/v0.4.0
[0.3.4]: https://github.com/tortuvshin/grove/releases/tag/v0.3.4
[0.3.2]: https://github.com/tortuvshin/grove/releases/tag/v0.3.2
[0.3.1]: https://github.com/tortuvshin/grove/releases/tag/v0.3.1
[0.3.0]: https://github.com/tortuvshin/grove/releases/tag/v0.3.0
[0.2.2]: https://github.com/tortuvshin/grove/releases/tag/v0.2.2
[0.2.1]: https://github.com/tortuvshin/grove/releases/tag/v0.2.1
[0.1.0]: https://github.com/tortuvshin/grove/releases/tag/v0.1.0
