---
title: Audit
description: Lighthouse scoring against grove.config.ts audit.pages[], checked against a default quality budget.
---

`grove audit` runs Lighthouse against every page listed in `grove.config.ts` → `audit.pages[]` and checks each result against a default quality budget. Output can be written as JSON or JUnit XML for CI.

Source: `packages/cli/src/audit-cli.ts`, `packages/cli/src/audit.ts`, `packages/core/src/audit.ts`.

## Prerequisites

- A running dev or preview server. The default `baseUrl` is `http://127.0.0.1:4321`; override with `--base-url` or `audit.baseUrl` in `grove.config.ts`.
- An `audit.pages[]` array in `grove.config.ts` with at least one entry — `loadManifest()` throws `grove.config.ts must declare audit.pages[]` otherwise.
- Chrome or Chromium available (`chrome-launcher` looks it up; set `CHROME_PATH` to point at a specific binary).

## Usage

```bash
pnpm exec grove audit                              # both profiles, all audit.pages, 3 runs each
pnpm exec grove audit --page /                     # audit only the home page
pnpm exec grove audit --page /projects/ --page /   # audit two pages (repeatable)
pnpm exec grove audit --mobile                     # mobile profile only
pnpm exec grove audit --desktop                    # desktop profile only
pnpm exec grove audit --runs 5                     # 5 runs per page (max 5)
pnpm exec grove audit --json reports/lighthouse.json
pnpm exec grove audit --junit reports/lighthouse.xml
pnpm exec grove audit --base-url https://staging.example.com
```

By default — with neither `--mobile` nor `--desktop` — the command runs **both** profiles, **3** runs per page each (`profilesFromOptions()`, `packages/cli/src/audit-cli.ts:182-186`; the `--runs` default is `3`, clamped to the 1–5 range). Passing `--page` with a path that isn't in `audit.pages[]` silently filters the run down to zero pages and still exits `0` — there's no "unknown page" error.

## `audit.pages[]`

```ts
audit: {
  baseUrl: "http://127.0.0.1:4321",
  pages: [
    { path: "/", type: "home", label: "Homepage" },
    { path: "/projects/", type: "directory", label: "Directory index" },
    { path: "/collections/top-ai-agents/", type: "collection", label: "Top AI Agents collection" },
    { path: "/projects/open-webui/", type: "record", label: "Record detail" },
    { path: "/about/", type: "content", label: "About page" },
    { path: "/empty/", type: "empty", label: "Empty state" },
    { path: "/this-page-does-not-exist/", type: "404", label: "404 page" },
  ],
}
```

(`apps/example/grove.config.ts`, the CLI's own manifest under test.)

Each entry (`auditPageManifestEntrySchema`, `packages/core/src/schema.ts:596-601`):

| Field | Required | Type | Notes |
|---|---|---|---|
| `path` | yes | string | URL path relative to `baseUrl`. |
| `type` | yes | enum | One of `home`, `directory`, `collection`, `record`, `content`, `empty`, `404`. |
| `label` | yes | string | Human-readable label; carried through into JSON/JUnit output. |
| `sample` | no | `Record<string, string>` | Declared in the schema and the `PageManifestEntry` type, but `parsePageEntry()` in `audit-cli.ts` (the TypeScript-AST reader for `grove.config.ts`) never reads a `sample` property off the config — setting it currently has no effect on the audit run. |

`type` only changes behavior in two places (see below): a `404` page skips the budget entirely, and an `empty` page skips only the SEO score check. It otherwise has no effect on which thresholds apply — every other page type is checked against the same `DEFAULT_BUDGET`.

## The default budget

`evaluateBudget()` (`packages/core/src/audit.ts:78-105`) checks each result against `DEFAULT_BUDGET`:

- Performance score ≥ 0.9
- Accessibility score ≥ 0.9
- Best-practices score ≥ 0.9
- SEO score ≥ 0.9
- LCP ≤ 2500 ms
- CLS ≤ 0.25
- TBT ≤ 200 ms

Two exceptions, both hard-coded in `evaluateBudget()`:

- **`type: "404"`** pages skip the budget entirely — Lighthouse can't meaningfully score a 404 response (scores collapse to 0, metrics to `Infinity`), so the audit still runs the page but no violation is recorded for it.
- **`type: "empty"`** pages skip only the SEO score — empty-state fixtures intentionally ship `noindex`, which fails Lighthouse's SEO "is-crawlable" audit regardless of anything else on the page.

A page/profile combination that drops below the threshold on any remaining score or metric produces a `BudgetViolation`. `runAudit()` returns `1` if there is at least one violation, `0` otherwise, and `audit-cli.ts` assigns that to `process.exitCode`.

Each result is the **median across the `--runs` samples** for that page/profile, not one entry per individual run (`aggregateRuns()`, `packages/cli/src/audit.ts:222-251`).

## JSON output

```bash
pnpm exec grove audit --json reports/audit.json
```

This is not raw Lighthouse JSON — it's `{ "results": AuditResult[], "violations": BudgetViolation[] }`, Grove's own shape. `results` has one entry per page/profile combination (medianed across runs), each with `url`, `type`, `profile`, `scores`, `metrics`, `runs` (the sample count), and `durationMs`. `violations` lists every `BudgetViolation`: `page`, `profile`, `category` (`"score"` or `"metric"`), `name`, `expected`, `actual`.

## JUnit output

```bash
pnpm exec grove audit --junit reports/audit.xml
```

One `<testcase classname="grove.audit" name="{profile} {pathname}">` per page/profile combination; a combination with at least one violation embeds a `<failure>` listing them (`writeJunitReport()`, `packages/cli/src/audit.ts:257-278`).

## Passing output

When every combination clears the budget, the command prints (`packages/cli/src/audit.ts:102-105`):

```
✓ N page/profile combinations passed the budget (scores ≥ 0.9, lcp ≤ 2500ms, cls ≤ 0.25, tbt ≤ 200ms)
```

and each page prints a `✓ {profile} {path}` line as it finishes (`packages/cli/src/audit.ts:73`). On failure, it prints `✗ N budget violation(s)` to stderr followed by one `[profile] path category.name: expected X, got Y` line per violation (`packages/cli/src/audit.ts:90-93`).

## How it runs in CI

The `grove init` scaffold does **not** wire `grove audit` into any GitHub Actions workflow by default — `apps/example/.github/workflows/ci.yml` only runs `grove check` and `pnpm build`. What the scaffold does ship is a package script, `"audit": "grove audit --runs 1"` (`apps/example/package.json`), for a fast local/manual run against a server you already have up.

For a working CI example, this repository's own `.github/workflows/lighthouse-audit.yml` (part of Grove's own development CI, not something `grove init` copies into a new project) builds `apps/example`, boots `astro preview` on `127.0.0.1:4321`, runs `grove audit --runs 3 --json lighthouse-report.json --junit lighthouse-junit.xml`, uploads both reports as artifacts, and — on pull requests — posts a scorecard comment summarizing `results.length` and `violations.length`. Use it as a template if you want the same thing in your own project's CI.

## When to extend the audit

- **Adding a new page kind** — extend `auditPageTypeSchema` in `packages/core/src/schema.ts:586` (currently `home | directory | collection | record | content | empty | 404`), and the matching `ALLOWED_TYPES` set in `packages/cli/src/audit.ts:18`.
- **Per-page custom thresholds** — build your own `BudgetConfig` and pass it as the third argument to `evaluateBudget()`; there's no `grove.config.ts` field wired up for this yet.
- **New metrics** — add to `LighthouseMetrics` and extend `evaluateBudget()` to read them.

## See also

- [Reference: programmatic API](/reference/api-core/) — `evaluateBudget`, `DEFAULT_BUDGET`, and the `PageType`, `Profile`, `PageManifestEntry`, `LighthouseScores`, `LighthouseMetrics`, `AuditResult`, `BudgetConfig`, `BudgetViolation` types, all exported from `@grove-dev/core`.
- [Reference: `grove.config.ts`](/reference/config/) — `audit.pages[]` field reference.
- [`packages/core/src/audit.ts`](https://github.com/tortuvshin/grove/blob/main/packages/core/src/audit.ts) — the budget implementation.
- [`packages/cli/src/audit.ts`](https://github.com/tortuvshin/grove/blob/main/packages/cli/src/audit.ts) — the CLI command implementation.
