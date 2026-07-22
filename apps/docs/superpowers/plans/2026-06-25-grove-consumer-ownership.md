# Grove Consumer Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move taxonomy labels, generic maintenance behavior, and current CI runtime defaults into Grove so generated consumers remain configuration and data repositories.

**Architecture:** Extend Grove's generated site-config contract with taxonomy metadata, implement contributor aggregation in core/CLI, remove generic scripts from the Astro scaffold, and make CLI-generated workflows use Node 24 with packageManager-owned pnpm versions.

**Tech Stack:** TypeScript 6, Node.js 24, pnpm 10.12.1, Astro 6, Vitest, YAML.

## Global Constraints

- Grove owns reusable application behavior and default UI.
- Consumer repositories must not receive generic Grove maintenance scripts.
- Taxonomy IDs remain URL/data identifiers; taxonomy names are display labels.
- `packageManager` is the only pnpm version source.
- Generated GitHub Actions use Node 24.
- Every behavior change follows red-green TDD.

---

### Task 1: Generate and consume taxonomy display metadata

**Files:**
- Modify: `packages/core/src/build-data.ts`
- Modify: `packages/core/src/build-data.test.ts`
- Modify: `packages/astro/templates/default/src/data/records.ts`
- Modify: `packages/astro/templates/default/src/pages/index.astro`
- Modify: `packages/astro/templates/default/src/pages/[slug]/index.astro`
- Modify: `packages/astro/src/template-routes.test.ts`

**Interfaces:**
- Produces: `site-config.json.taxonomy`
- Produces: `taxonomyLabel(kind, id): string`

- [ ] Add a failing core test with category `{id: "news", name: "News and Magazine"}` and assert generated site config preserves the name.
- [ ] Run `pnpm exec vitest run --project unit packages/core/src/build-data.test.ts` and confirm failure.
- [ ] Load the four taxonomy YAML files in `generate()` and emit normalized arrays.
- [ ] Add a failing Astro source contract test for `taxonomyLabel`.
- [ ] Run the focused Astro test and confirm failure.
- [ ] Implement taxonomy lookup helpers and apply labels to category grids and facets.
- [ ] Run focused tests and commit `feat: generate taxonomy display metadata`.

### Task 2: Make contributor sync a Grove capability

**Files:**
- Create: `packages/core/src/contributors.ts`
- Create: `packages/core/src/contributors.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/cli/src/index.ts`

**Interfaces:**
- Produces: `syncContributors(options): Promise<ContributorSyncResult>`

- [ ] Write a failing core test using temporary `records.index.json` and a fake GitHub fetch.
- [ ] Run the focused test and confirm the missing API failure.
- [ ] Implement owner/repo extraction, aggregation, sorting, and JSON output.
- [ ] Export the function and replace the CLI consumer-script delegation.
- [ ] Run focused tests and commit `feat: own contributor sync in Grove`.

### Task 3: Remove generic scripts from generated consumers

**Files:**
- Modify: `packages/astro/src/template-routes.test.ts`
- Modify: `packages/astro/templates/default/package.json`
- Delete: `packages/astro/templates/default/scripts/*.mjs`
- Modify: `packages/astro/templates/default/.github/workflows/sync-contributors.yml`
- Modify: `packages/cli/src/template-loader.test.ts`

**Interfaces:**
- Consumer scripts call Grove commands directly.

- [ ] Add failing assertions that the template has no `scripts/` directory and package scripts contain `grove llms` / `grove sync contributors`.
- [ ] Run focused tests and confirm failure.
- [ ] Replace wrapper script calls with CLI commands and remove generic scripts.
- [ ] Update workflow contributor sync to invoke Grove directly.
- [ ] Run focused tests and commit `refactor: keep generic scripts inside Grove`.

### Task 4: Fix generated GitHub Actions runtime configuration

**Files:**
- Modify: `packages/cli/src/template-loader.test.ts`
- Modify: `packages/cli/src/index.ts`
- Modify: `packages/astro/templates/default/.github/workflows/*.yml`

**Interfaces:**
- Workflows use Node 24 and packageManager-owned pnpm.

- [ ] Add failing assertions that generated/template workflows contain `node-version: "24"` and no `version: 10` under pnpm setup.
- [ ] Run focused tests and confirm failure.
- [ ] Update every workflow generator and checked-in template workflow.
- [ ] Run focused tests and commit `fix: modernize generated GitHub Actions`.

### Task 5: Full verification

**Files:** Modify only for defects covered by this design.

- [ ] Run `pnpm test`.
- [ ] Run `pnpm check`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm test:scaffold`.
- [ ] Inspect the scaffold and confirm no generic `scripts/` directory.
- [ ] Confirm generated category UI uses taxonomy names.

