---
title: Audit
description: Lighthouse scoring against audit.pages[] with the default quality budget.
---

`grove audit` runs Lighthouse against every page listed in `grove.config.ts` → `audit.pages[]` and asserts each score against the framework's default quality budget. Pages can opt into or out of profiles via flags; output can be JSON or JUnit for CI integration.

## Prerequisites

- A running dev or preview server. The default `baseUrl` is `http://127.0.0.1:4321`; override with `--base-url` or `audit.baseUrl`.
- An `audit.pages[]` entry in `grove.config.ts` (at least one page).
- Chrome/Chromium available in the environment.

## Usage

```bash
pnpm exec grove audit                              # default run against all audit.pages
pnpm exec grove audit --page /                     # audit only the home page
pnpm exec grove audit --page /projects/ --page /   # audit two pages (repeatable)
pnpm exec grove audit --mobile                     # mobile profile only
pnpm exec grove audit --desktop                    # desktop profile only
pnpm exec grove audit --runs 5                     # 5 runs per page (max 5)
pnpm exec grove audit --json reports/lighthouse.json
pnpm exec grove audit --junit reports/lighthouse.xml
pnpm exec grove audit --base-url https://staging.example.com
```

By default, the command runs the **mobile** profile **3 times** per page. Run count is configurable up to 5.

## `audit.pages[]`

The audit manifest is configured in `grove.config.ts`:

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

Each entry has:

| Field | Required | Type | Description |
|---|---|---|---|
| `path` | yes | string | URL path relative to `baseUrl`. |
| `type` | yes | enum | One of `home`, `directory`, `collection`, `record`, `content`, `empty`, `404`. |
| `label` | yes | string | Human-readable label, used in `--json` / `--junit` reports. |
| `sample` | no | `Record<string, string>` | Optional sample data used for parametrized paths. |

The `type` enum is what the audit pipeline keys off — it lets the budget account for page-kind-specific behavior (e.g., the homepage can have different LCP targets than a record detail page).

## The default budget

`evaluateBudget()` from `packages/core/src/audit.ts` enforces a baseline. The threshold values come from the Lighthouse "good" ranges:

- Performance score ≥ 0.9
- Accessibility score ≥ 0.9
- Best-practices score ≥ 0.9
- SEO score ≥ 0.9
- LCP ≤ 2500 ms
- CLS ≤ 0.25
- TBT ≤ 200 ms

A page that drops below the threshold on any score or metric fails the audit. `process.exitCode = 1` unless every page passes.

## JSON output

```bash
pnpm exec grove audit --json reports/audit.json
```

The JSON is the Lighthouse JSON shape — one entry per page per profile per run. The CLI walks the array after the runs finish and prints the pass/fail summary.

## JUnit output

```bash
pnpm exec grove audit --junit reports/audit.xml
```

JUnit XML is the format CI platforms use to render test results inside PRs. Each page maps to a `<testcase>`; failures become `<failure>` elements with the violation messages.

## How it runs in CI

Two patterns:

1. **`ci.yml`** runs `grove audit` as part of `pnpm check`. Pages are scored on every PR; failures block merging.
2. **`lighthouse-audit.yml`** runs the same audit weekly against a preview deploy. The weekly job is informational — it posts a scorecard to the PR or a Slack channel.

Both jobs require a running server. `ci.yml` typically uses `pnpm build && pnpm preview` first.

## When to extend the audit

- **Adding a new page kind** — extend `auditPageTypeSchema` in `packages/core/src/schema.ts:586` (currently `home | directory | collection | record | content | empty | 404`).
- **Per-page custom thresholds** — fork `DEFAULT_BUDGET` in `packages/core/src/audit.ts` and pass it through `evaluateBudget`.
- **New metrics** — add to `LighthouseMetrics` and update `evaluateBudget` to read them.

These are framework-level changes and ship as named PRs against `@grove-dev/core`.

## See also

- [Reference: programmatic API](/reference/api-core/) — `evaluateBudget`, `DEFAULT_BUDGET`, the `PageType` and `LighthouseScores` types.
- [Reference: `grove.config.ts`](/reference/config/) — `audit.pages[]` field reference.
- [`packages/core/src/audit.ts`](https://github.com/tortuvshin/grove) — the budget implementation.
- [`packages/cli/src/audit.ts`](https://github.com/tortuvshin/grove) — the CLI command implementation.
