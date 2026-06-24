# Open Apps Grove Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/Users/turtuvshin/Projects/research/open-apps-grove` as a fresh Grove application using Grove's default UI while preserving Open Apps records, canonical `/apps` routes, SEO, enrichment, editorial rules, and Cloudflare deployment.

**Architecture:** First make Grove's configurable directory route work consistently across pages, aliases, sitemap, LLM files, package linking, and scaffold tests. Then scaffold a fresh consumer from Grove's default Astro template, migrate Open Apps data deterministically into canonical Grove project records, add only consumer-owned content and workflows, verify locally, release Grove coherently, and switch the consumer from local links to npm.

**Tech Stack:** Node.js 20+, pnpm 10.12.1, TypeScript 6, Astro 6, Zod 4, YAML, Vitest, Node test runner, Cloudflare Wrangler.

## Global Constraints

- Grove owns the UI.
- Do not copy or recreate the existing Open Apps components, layouts, or CSS.
- Do not add Open Apps-specific component overrides.
- Keep `/apps` and `/apps/<slug>` canonical.
- Keep reusable capabilities in Grove and Open Apps policy in `open-apps-grove`.
- Initialize `open-apps-grove` as a fresh Git repository.
- Develop against local Grove packages first.
- Switch to npm only after Grove and the consumer pass all verification.
- Preserve all current Open Apps slugs and required record data.
- Use atomic commits in each repository.

---

## File Structure

### Grove files modified

- `packages/core/package.json` — workspace dependency consistency is not needed here because core has no internal Grove dependencies.
- `packages/ui/package.json` — consume local core via `workspace:*`.
- `packages/astro/package.json` — consume local core/UI via `workspace:*`.
- `packages/nextjs/package.json` — consume local core/UI via `workspace:*`.
- `packages/svelte/package.json` — consume local core/UI via `workspace:*`.
- `packages/cli/package.json` — consume local adapters/core via `workspace:*`.
- `packages/astro/templates/default/package.json` — template carries workspace dependencies that the CLI rewrites to local links or published versions.
- `packages/nextjs/templates/default/package.json` and `packages/svelte/templates/default/package.json` — remove stale internal pins for release consistency.
- `packages/core/src/sitemap.ts` and `packages/core/src/sitemap.test.ts` — honor `config.routes.directory`.
- `packages/core/src/llms.ts` and `packages/core/src/llms.test.ts` — honor configured route and labels.
- `packages/astro/templates/default/src/pages/[slug]/index.astro` — generate configured list route.
- `packages/astro/templates/default/src/pages/apps/[recordSlug].astro` — skip the legacy alias when `/apps` is canonical.
- `packages/astro/templates/default/src/pages/about.astro` — render consumer-authored Markdown in Grove's default layout.
- `packages/astro/templates/default/src/data/records.ts` — expose sanitized page-content loading.
- `packages/astro/templates/default/src/pages/route-config.test.ts` — source-level route regression checks.
- `tests/integration/grove-new.test.ts` — prove file-mode scaffold links to current workspace packages.

### New consumer files

- `/Users/turtuvshin/Projects/research/open-apps-grove/package.json`
- `/Users/turtuvshin/Projects/research/open-apps-grove/astro.config.mjs`
- `/Users/turtuvshin/Projects/research/open-apps-grove/grove.config.ts`
- `/Users/turtuvshin/Projects/research/open-apps-grove/data/records/*.yml`
- `/Users/turtuvshin/Projects/research/open-apps-grove/data/taxonomy/*.yml`
- `/Users/turtuvshin/Projects/research/open-apps-grove/content/pages/*.md`
- `/Users/turtuvshin/Projects/research/open-apps-grove/scripts/migrate-open-apps.mjs`
- `/Users/turtuvshin/Projects/research/open-apps-grove/scripts/migrate-open-apps.test.mjs`
- `/Users/turtuvshin/Projects/research/open-apps-grove/scripts/verify-built-site.mjs`
- `/Users/turtuvshin/Projects/research/open-apps-grove/src/pages/*` — unmodified Grove default page set.
- `/Users/turtuvshin/Projects/research/open-apps-grove/src/styles/global.css` — minimal brand tokens only.
- `/Users/turtuvshin/Projects/research/open-apps-grove/.github/*`
- `/Users/turtuvshin/Projects/research/open-apps-grove/public/*`
- `/Users/turtuvshin/Projects/research/open-apps-grove/wrangler.jsonc`

---

### Task 1: Make Grove workspace dependencies coherent

**Files:**
- Modify: `packages/ui/package.json`
- Modify: `packages/astro/package.json`
- Modify: `packages/nextjs/package.json`
- Modify: `packages/svelte/package.json`
- Modify: `packages/cli/package.json`
- Modify: `packages/astro/templates/default/package.json`
- Modify: `packages/nextjs/templates/default/package.json`
- Modify: `packages/svelte/templates/default/package.json`
- Modify: `packages/cli/src/template-loader.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: pnpm workspace package names under `@grove-dev/*`.
- Produces: local development manifests using `workspace:*`; published scaffolds rewritten by `renameProjectInTemplate()`.

- [ ] **Step 1: Extend the manifest rewrite test**

Add assertions in `packages/cli/src/template-loader.test.ts` that published mode rewrites core, UI, Astro, and CLI dependencies to non-workspace versions and file mode rewrites each present Grove dependency to an absolute `link:` path.

```ts
expect(pkg.dependencies["@grove-dev/core"]).not.toMatch(/^workspace:/);
expect(pkg.dependencies["@grove-dev/astro"]).not.toMatch(/^workspace:/);
expect(pkg.devDependencies["@grove-dev/ui"]).not.toMatch(/^workspace:/);
```

- [ ] **Step 2: Run the focused test and verify the stale-template case fails**

Run:

```bash
pnpm vitest run packages/cli/src/template-loader.test.ts
```

Expected: existing tests pass, while the new assertions expose any template dependency that is not rewritten coherently.

- [ ] **Step 3: Replace internal published pins with workspace references**

Use this rule in package and template manifests:

```json
"@grove-dev/core": "workspace:*",
"@grove-dev/ui": "workspace:*",
"@grove-dev/astro": "workspace:*",
"@grove-dev/nextjs": "workspace:*",
"@grove-dev/svelte": "workspace:*"
```

Only include dependencies already required by each package; do not add new cross-package dependencies.

- [ ] **Step 4: Refresh the lockfile**

Run:

```bash
pnpm install
```

Expected: lockfile workspace importers resolve local packages rather than stale `0.2.16`/`0.2.18` packages.

- [ ] **Step 5: Run package and template-loader tests**

Run:

```bash
pnpm vitest run packages/cli/src/template-loader.test.ts
pnpm --filter @grove-dev/cli build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/*/package.json packages/*/templates/default/package.json packages/cli/src/template-loader.test.ts pnpm-lock.yaml
git commit -m "fix: align Grove workspace dependencies"
```

---

### Task 2: Make configured routes and consumer copy generic across Grove

**Files:**
- Modify: `packages/core/src/sitemap.ts`
- Modify: `packages/core/src/llms.ts`
- Modify: `packages/core/src/sitemap.test.ts`
- Modify: `packages/core/src/llms.test.ts`
- Modify: `packages/astro/templates/default/src/pages/[slug]/index.astro`
- Modify: `packages/astro/templates/default/src/pages/apps/[recordSlug].astro`
- Modify: `packages/astro/templates/default/src/pages/about.astro`
- Modify: `packages/astro/templates/default/src/data/records.ts`
- Create: `packages/astro/templates/default/src/pages/route-config.test.ts`

**Interfaces:**
- Consumes: `GroveConfig.routes.directory`, `GroveConfig.labels.plural`, and generated `site-config.json.blueprintConfig.routeSlug`.
- Produces: one canonical list/detail route for any configured directory slug and consumer-authored about copy inside Grove's default layout.

- [ ] **Step 1: Write failing sitemap tests**

Add a test using:

```ts
const config = {
  ...baseConfig,
  routes: { directory: "apps" },
  labels: { singular: "app", plural: "apps" },
};
```

Assert generated XML contains:

```text
https://open-apps.dev.mn/apps
https://open-apps.dev.mn/apps/immich
```

and does not contain `/projects`.

- [ ] **Step 2: Write failing LLM tests**

Assert `buildLlmsTxt()` and `buildLlmsFullTxt()` use:

```text
Directory: https://open-apps.dev.mn/apps
> Source: https://open-apps.dev.mn/apps
## Apps
- url: https://open-apps.dev.mn/apps/immich
```

- [ ] **Step 3: Write failing Astro template route tests**

Create `route-config.test.ts` that reads the two Astro source files and asserts:

```ts
expect(listPage).toContain("siteConfig.blueprintConfig?.routeSlug");
expect(aliasPage).toContain('if (slug === "apps")');
expect(aliasPage).toContain("return []");
expect(aboutPage).toContain('getPageContentHtml("about")');
```

This pins the static-generation contract without starting Astro in the unit test.

- [ ] **Step 4: Run tests to verify failure**

Run:

```bash
pnpm vitest run packages/core/src/sitemap.test.ts packages/core/src/llms.test.ts packages/astro/templates/default/src/pages/route-config.test.ts
```

Expected: FAIL because sitemap/LLM/list routes currently default to blueprint routes and the alias always generates.

- [ ] **Step 5: Implement one route-resolution helper per core module**

In both `sitemap.ts` and `llms.ts`, resolve:

```ts
function directorySlug(config: GroveConfig): string {
  return config.routes.directory ?? BLUEPRINT_INDEX[config.blueprint] ?? "items";
}
```

For LLM headings resolve:

```ts
function pluralLabel(config: GroveConfig): string {
  return config.labels.plural
    ? config.labels.plural.replace(/^./, (value) => value.toUpperCase())
    : BLUEPRINT_PLURAL[config.blueprint] ?? "Items";
}
```

- [ ] **Step 6: Make the Astro list route use generated config**

Replace the hard-coded static path:

```ts
export function getStaticPaths() {
  const routeSlug = siteConfig.blueprintConfig?.routeSlug ?? "projects";
  return [{ params: { slug: routeSlug } }];
}
```

- [ ] **Step 7: Disable the legacy alias when `apps` is canonical**

Change the alias page:

```ts
export async function getStaticPaths() {
  if (indexSlug() === "apps") return [];
  return fullRecords.map((record) => ({
    params: { recordSlug: record.slug },
  }));
}
```

Keep the redirect behavior for consumers whose canonical route is not `apps`.

- [ ] **Step 8: Add reusable Markdown-backed about content**

In `src/data/records.ts`, add:

```ts
export function getPageContentHtml(page: string): string | null {
  const configuredRoot = resolve(process.cwd(), "content", "pages");
  const path = resolve(configuredRoot, `${page}.md`);
  if (!existsSync(path)) return null;
  const rawHtml = marked.parse(readFileSync(path, "utf8"), { async: false }) as string;
  return sanitizeHtml(rawHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
      }),
    },
  });
}
```

In `about.astro`, render the sanitized Markdown inside Grove's existing
`BaseLayout`, `Container`, breadcrumb, and prose styling. Keep the current
generic sections as the fallback when no `content/pages/about.md` exists.

- [ ] **Step 9: Run focused and full Grove verification**

Run:

```bash
pnpm vitest run packages/core/src/sitemap.test.ts packages/core/src/llms.test.ts packages/astro/templates/default/src/pages/route-config.test.ts
pnpm test
pnpm check
pnpm build
pnpm test:scaffold
```

Expected: all commands PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/sitemap.ts packages/core/src/sitemap.test.ts packages/core/src/llms.ts packages/core/src/llms.test.ts packages/astro/templates/default/src/pages packages/astro/templates/default/src/data/records.ts
git commit -m "fix: honor configured routes and page content"
```

---

### Task 3: Scaffold the fresh local-linked Open Apps repository

**Files:**
- Create: `/Users/turtuvshin/Projects/research/open-apps-grove/**`

**Interfaces:**
- Consumes: Grove CLI file mode and the default Astro template.
- Produces: a standalone Git repository linked to local Grove packages.

- [ ] **Step 1: Verify the target does not exist**

Run:

```bash
test ! -e /Users/turtuvshin/Projects/research/open-apps-grove
```

Expected: exit code 0.

- [ ] **Step 2: Scaffold from the local Grove checkout**

Run from Grove:

```bash
pnpm --filter @grove-dev/cli exec tsx src/index.ts new ../open-apps-grove \
  --yes \
  --framework astro \
  --deploy cloudflare \
  --github public \
  --local \
  --no-git \
  --no-install
```

Expected: the target contains the default Astro template and Cloudflare workflow/configuration.

- [ ] **Step 3: Initialize a fresh repository**

Run:

```bash
git -C ../open-apps-grove init -b main
```

Expected: `git -C ../open-apps-grove status --short` lists scaffold files as untracked.

- [ ] **Step 4: Confirm local links**

Assert package dependencies include absolute links:

```json
"@grove-dev/astro": "link:/Users/turtuvshin/Projects/research/grove/packages/astro",
"@grove-dev/cli": "link:/Users/turtuvshin/Projects/research/grove/packages/cli",
"@grove-dev/core": "link:/Users/turtuvshin/Projects/research/grove/packages/core"
```

- [ ] **Step 5: Install and run the clean scaffold baseline**

Run:

```bash
pnpm install
pnpm run build
pnpm run check
```

Expected: PASS before Open Apps data is introduced.

- [ ] **Step 6: Commit the untouched Grove scaffold**

```bash
git add .
git commit -m "chore: scaffold Open Apps with Grove"
```

---

### Task 4: Add deterministic Open Apps record migration

**Files:**
- Create: `/Users/turtuvshin/Projects/research/open-apps-grove/scripts/migrate-open-apps.mjs`
- Create: `/Users/turtuvshin/Projects/research/open-apps-grove/scripts/migrate-open-apps.test.mjs`
- Modify: `/Users/turtuvshin/Projects/research/open-apps-grove/package.json`
- Replace: `/Users/turtuvshin/Projects/research/open-apps-grove/data/records/*.yml`

**Interfaces:**
- Consumes: `/Users/turtuvshin/Projects/research/open-apps/data/apps/*.yml`.
- Produces: canonical Grove `ProjectRecord` YAML in `data/records/*.yml`.
- Produces function: `convertOpenAppsRecord(raw, fileSlug): ProjectRecordLike`.

- [ ] **Step 1: Write conversion unit tests**

Test a minimal synthetic record and the real `immich.yml` fixture. Assert:

```js
assert.equal(result.kind, "project");
assert.equal(result.slug, "immich");
assert.equal(result.name, "Immich");
assert.equal(result.repoUrl, "https://github.com/immich-app/immich");
assert.equal(result.stack, "flutter");
assert.ok(result.stacks.includes("typescript"));
assert.equal(result.github.repository.stargazers_count > 100000, true);
assert.equal(result.health.status, "active");
```

Also assert no legacy wrapper keys remain:

```js
assert.equal("app" in result, false);
assert.equal("schemaVersion" in result, false);
assert.equal("id" in result, false);
```

- [ ] **Step 2: Write catalog invariants**

The test reads all source files and asserts:

```js
assert.equal(outputSlugs.size, sourceSlugs.size);
assert.deepEqual([...outputSlugs].sort(), [...sourceSlugs].sort());
assert.equal(errors.length, 0);
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm test
```

Expected: FAIL because the migration module does not exist.

- [ ] **Step 4: Implement `convertOpenAppsRecord`**

Map the source shape as follows:

```js
return {
  kind: "project",
  slug: fileSlug,
  name: raw.app.name,
  description: raw.app.description,
  category: raw.app.category,
  projectType: raw.app.projectType,
  stack: raw.stack.primary,
  stacks: unique([
    ...(raw.stack.families ?? []),
    ...(raw.stack.technologies ?? []).map((technology) => technology.id),
  ]).filter((value) => value !== raw.stack.primary),
  platforms: raw.app.platforms ?? [],
  tags: unique([...(raw.app.tags ?? []), ...(raw.github?.repository?.topics ?? [])]),
  repoUrl,
  links: {
    github: repoUrl,
    ...(homepage ? { website: homepage } : {}),
  },
  distribution: raw.app.distribution ?? { channels: [] },
  github: raw.github,
  health: normalizeHealth(raw.health),
  curation: normalizeCuration(raw.curation),
  scores: raw.curation?.scores ?? {},
  bestFor: raw.curation?.bestFor ?? [],
  whyListed: raw.curation?.whyListed ?? [],
  caveats: raw.curation?.caveats ?? [],
  source: {
    type: "manual",
    provider: raw.source.provider,
    owner: raw.source.owner,
    repo: raw.source.repo,
    url: repoUrl,
  },
};
```

Normalize legacy visibility values:

```js
const VISIBILITY = {
  listed: "keep",
  hidden: "hide",
  keep: "keep",
  highlight: "highlight",
  needs_review: "needs_review",
  remove: "remove",
  historical: "historical",
};
```

- [ ] **Step 5: Implement deterministic migration output**

Use YAML with:

```js
stringify(record, {
  lineWidth: 100,
  singleQuote: false,
  defaultStringType: "PLAIN",
});
```

Delete scaffold sample records before writing, sort source filenames, fail on duplicate slugs, and print:

```text
[migrate] 147 source records -> 147 Grove records, 0 warnings, 0 errors
```

- [ ] **Step 6: Add scripts**

```json
"scripts": {
  "migrate:open-apps": "node scripts/migrate-open-apps.mjs",
  "test": "node --test scripts/*.test.mjs"
}
```

Preserve the scaffold's Grove build/dev/check scripts.

- [ ] **Step 7: Run migration and validation**

Run:

```bash
pnpm run migrate:open-apps
pnpm test
pnpm run validate:data
pnpm run build:data
```

Expected: source/output counts match, all tests PASS, Grove validation and generation PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json scripts data/records
git commit -m "feat: migrate Open Apps records to Grove"
```

---

### Task 5: Configure Open Apps content, taxonomy, and brand tokens

**Files:**
- Modify: `/Users/turtuvshin/Projects/research/open-apps-grove/grove.config.ts`
- Modify: `/Users/turtuvshin/Projects/research/open-apps-grove/astro.config.mjs`
- Replace: `/Users/turtuvshin/Projects/research/open-apps-grove/data/taxonomy/*.yml`
- Modify: `/Users/turtuvshin/Projects/research/open-apps-grove/content/pages/about.md`
- Modify: `/Users/turtuvshin/Projects/research/open-apps-grove/src/styles/global.css`
- Copy: `/Users/turtuvshin/Projects/research/open-apps/public/og-image.svg`
- Copy: `/Users/turtuvshin/Projects/research/open-apps/public/robots.txt`

**Interfaces:**
- Consumes: Grove configuration schema and default pages.
- Produces: Open Apps identity without component overrides.

- [ ] **Step 1: Write the Open Apps Grove config**

Use:

```ts
export default defineConfig({
  blueprint: "project-directory",
  site: {
    name: "Open Apps",
    tagline: "Open-source apps with real codebases.",
    description:
      "A curated directory of real open-source applications you can read, run, study, and contribute to.",
    url: "https://open-apps.dev.mn",
    repoUrl: "https://github.com/tortuvshin/open-apps",
  },
  nav: [
    { label: "Home", href: "/" },
    { label: "Browse", href: "/apps" },
    { label: "About", href: "/about" },
    { label: "Submit", href: "/submit" },
  ],
  routes: { directory: "apps", item: "app" },
  labels: { singular: "app", plural: "apps" },
  facets: ["category", "stacks", "platforms", "tags", "license", "status"],
  integrations: {
    github: { metadata: true, contributors: true, health: true },
  },
  theme: {
    primaryColor: "#1f6feb",
    radius: "soft",
    density: "comfortable",
    containerWidth: "72rem",
  },
  components: {},
});
```

- [ ] **Step 2: Set Astro's canonical site**

Use:

```js
site: process.env.SITE_URL || "https://open-apps.dev.mn"
```

- [ ] **Step 3: Copy taxonomy data without changing IDs**

Copy categories, stacks, platforms, and distribution channels from the old repository into Grove's taxonomy directory. Preserve file names and IDs.

- [ ] **Step 4: Migrate editorial copy**

Write `content/pages/about.md` covering:

- Why Open Apps exists.
- Inclusion and exclusion rules.
- What metadata is collected.
- How apps are reviewed.
- The stars/commit submission threshold.
- The project's origin from the legacy Flutter collection.

Do not create custom Astro layouts for this copy. Grove's default
`about.astro` renders this Markdown through `getPageContentHtml("about")`.

- [ ] **Step 5: Keep CSS minimal**

`src/styles/global.css` may only import Tailwind and set brand variables:

```css
@import "tailwindcss";

@theme {
  --color-grove-primary: #1f6feb;
}
```

Do not copy `open-apps/src/styles/global.css`.

- [ ] **Step 6: Generate and check**

Run:

```bash
pnpm run build:data
pnpm run build:sitemap
pnpm run build:llms
pnpm run check
pnpm run build
```

Expected: PASS and `dist/apps/index.html` exists.

- [ ] **Step 7: Commit**

```bash
git add grove.config.ts astro.config.mjs data/taxonomy content public src/styles/global.css
git commit -m "feat: configure Open Apps content and taxonomy"
```

---

### Task 6: Preserve workflows, editorial policy, and Cloudflare deployment

**Files:**
- Modify: `/Users/turtuvshin/Projects/research/open-apps-grove/.github/ISSUE_TEMPLATE/record_submission.md`
- Modify: `/Users/turtuvshin/Projects/research/open-apps-grove/.github/pull_request_template.md`
- Modify: `/Users/turtuvshin/Projects/research/open-apps-grove/.github/workflows/*.yml`
- Modify: `/Users/turtuvshin/Projects/research/open-apps-grove/wrangler.jsonc`
- Create: `/Users/turtuvshin/Projects/research/open-apps-grove/scripts/verify-built-site.mjs`
- Modify: `/Users/turtuvshin/Projects/research/open-apps-grove/package.json`

**Interfaces:**
- Consumes: Grove CLI maintenance commands and built static output.
- Produces: PR-based catalog maintenance and Cloudflare-ready assets.

- [ ] **Step 1: Adapt submission templates**

Use Open Apps language and preserve:

```text
stars >= 50
total commits >= 50
real application
public open-source license
not a tutorial, demo, template, or package-only library
```

Change paths from `data/apps/<slug>.yml` to `data/records/<slug>.yml`.

- [ ] **Step 2: Use Grove maintenance commands in workflows**

Workflows must run:

```yaml
- run: pnpm install --frozen-lockfile
- run: pnpm exec grove validate
- run: pnpm exec grove sync github
- run: pnpm exec grove sync contributors
- run: pnpm exec grove cleanup stale
- run: pnpm exec grove generate
- run: pnpm exec grove sitemap
- run: pnpm exec grove llms
```

Retain scheduled PR creation rather than direct default-branch pushes.

- [ ] **Step 3: Configure Cloudflare**

Use:

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "open-apps",
  "compatibility_date": "2026-06-07",
  "assets": {
    "directory": "./dist"
  }
}
```

- [ ] **Step 4: Write built-site verification**

Assert:

```js
await access("dist/index.html");
await access("dist/apps/index.html");
await access("dist/apps/immich/index.html");
await access("dist/about/index.html");
await access("dist/submit/index.html");
await access("dist/contributors/index.html");
```

Read representative HTML and assert:

```js
assert.match(appHtml, /<link rel="canonical" href="https:\/\/open-apps\.dev\.mn\/apps\/immich"/);
assert.match(appHtml, /"@type":"SoftwareSourceCode"/);
assert.doesNotMatch(appHtml, /\/projects\/immich/);
```

Read generated files and assert sitemap/LLM URLs use `/apps`.

- [ ] **Step 5: Add verification script**

```json
"verify:site": "node scripts/verify-built-site.mjs"
```

- [ ] **Step 6: Run the complete consumer suite**

Run:

```bash
pnpm test
pnpm run validate:data
pnpm run check
pnpm run build
pnpm run verify:site
pnpm exec wrangler deploy --dry-run
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add .github package.json scripts/verify-built-site.mjs wrangler.jsonc
git commit -m "chore: preserve Open Apps automation and deployment"
```

---

### Task 7: Verify Grove and consumer together

**Files:**
- Modify only if verification reveals defects covered by the approved design.

**Interfaces:**
- Consumes: local Grove packages and the migrated consumer.
- Produces: evidence that no Open Apps UI fork or route regression remains.

- [ ] **Step 1: Verify clean repository state**

Run:

```bash
git -C /Users/turtuvshin/Projects/research/grove status --short
git -C /Users/turtuvshin/Projects/research/open-apps-grove status --short
```

Expected: clean.

- [ ] **Step 2: Run Grove gates**

```bash
pnpm test
pnpm check
pnpm build
pnpm test:scaffold
pnpm release:dry
```

Expected: PASS; dry release packages workspace dependencies into publishable versions.

- [ ] **Step 3: Run consumer gates from a clean install**

```bash
rm -rf node_modules dist .astro
pnpm install --frozen-lockfile
pnpm test
pnpm run validate:data
pnpm run check
pnpm run build
pnpm run verify:site
```

Expected: PASS.

- [ ] **Step 4: Audit for forbidden UI copies**

Run:

```bash
find src/components -type f 2>/dev/null
rg -n "AppCard|AppsIndexRow|AppsPagination|src/components/layout|open-apps/src/styles" .
```

Expected: no copied Open Apps component files or imports.

- [ ] **Step 5: Manual browser acceptance**

Use the local browser against `pnpm dev` and verify:

- `/`
- `/apps`
- `/apps/immich`
- `/about`
- `/submit`
- `/contributors`
- `/404`
- dark mode
- mobile layout
- search/filter interaction

Expected: Grove's default UI with Open Apps data and copy.

---

### Task 8: Release Grove and switch Open Apps to npm

**Files:**
- Modify: Grove package manifests and lockfile through the release script.
- Modify: `/Users/turtuvshin/Projects/research/open-apps-grove/package.json`
- Modify: `/Users/turtuvshin/Projects/research/open-apps-grove/pnpm-lock.yaml`

**Interfaces:**
- Consumes: verified local package source.
- Produces: published Grove packages and a standalone consumer with no sibling filesystem dependency.

- [ ] **Step 1: Determine the coordinated release versions**

Run:

```bash
npm view @grove-dev/core version
npm view @grove-dev/ui version
npm view @grove-dev/astro version
npm view @grove-dev/cli version
```

Choose the next patch version for each package through the existing release script; do not manually invent a version lower than npm.

- [ ] **Step 2: Run release dry-run again immediately before publishing**

```bash
pnpm release:dry
```

Expected: all package tarballs build and contain resolved non-workspace dependencies.

- [ ] **Step 3: Publish using the repository release process**

Run:

```bash
pnpm release
```

If npm requires 2FA, export the current code without writing it to the
repository and rerun:

```bash
read -s NPM_OTP
export NPM_OTP
pnpm release
unset NPM_OTP
```

Expected: core, UI, adapters, CLI, and Starlight publish in dependency order.

- [ ] **Step 4: Commit Grove release changes**

```bash
git add packages pnpm-lock.yaml CHANGELOG.md
git commit -m "chore: release Grove for Open Apps migration"
```

Only include `CHANGELOG.md` if the release process or release notes update it.

- [ ] **Step 5: Replace consumer local links**

Read the exact versions just published and install them:

```bash
CORE_VERSION=$(npm view @grove-dev/core version)
ASTRO_VERSION=$(npm view @grove-dev/astro version)
CLI_VERSION=$(npm view @grove-dev/cli version)
pnpm add \
  "@grove-dev/core@$CORE_VERSION" \
  "@grove-dev/astro@$ASTRO_VERSION" \
  "@grove-dev/cli@$CLI_VERSION"
```

- [ ] **Step 6: Reinstall without sibling links and rerun all gates**

```bash
rm -rf node_modules pnpm-lock.yaml dist .astro
pnpm install
pnpm test
pnpm run validate:data
pnpm run check
pnpm run build
pnpm run verify:site
pnpm exec wrangler deploy --dry-run
```

Expected: PASS using registry packages only.

- [ ] **Step 7: Commit the standalone dependency switch**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: use published Grove packages"
```

- [ ] **Step 8: Final status and handoff**

Run:

```bash
git -C /Users/turtuvshin/Projects/research/grove status --short
git -C /Users/turtuvshin/Projects/research/open-apps-grove status --short
git -C /Users/turtuvshin/Projects/research/open-apps-grove log --oneline --decorate -8
```

Expected: both repositories clean; the new repository contains scaffold, data migration, content/configuration, automation, and npm-switch commits.
