# `@grove-dev/nextjs`

> Next.js framework adapter for Grove.

A thin layer of React components, layouts, and design tokens, on top of the framework-agnostic `@grove-dev/core` and `@grove-dev/ui`. Includes a default `templates/default/` directory that `grove new --framework nextjs` copies into a new project.

> **⚠️ Roadmap only — not in V1 — package is private.**
> Marked `"private": true` (line 5 of `package.json`) and the registry
> will refuse to publish it. Note: `publishConfig.access: "public"`
> is retained for if/when the package is later revived; it is gated
> by `private` at the registry level. Do not depend on the
> `@grove-dev/nextjs` name from outside this monorepo — there is no
> public artifact. The real V1 entry point is `@grove-dev/astro` (and
> the framework-agnostic `@grove-dev/core` / `@grove-dev/ui`).

```bash
# This will fail — the package is private:
pnpm add @grove-dev/nextjs   # 404 (not published) or 403 (private)
```

## Status

**Roadmap only — not in V1.** Grove V1 ships the Astro renderer only.
The V1 CLI refuses `--framework nextjs` at scaffold time (see
[`@grove-dev/cli/src/index.ts`](../../cli/src/index.ts) — the
`isFramework()` helper accepts only `"astro"` in V1). The Next.js
adapter is reserved for V1.2 once `@grove-dev/core` and `@grove-dev/ui`
(V1) are stable. See [`docs/roadmap.md`](../docs/roadmap.md) for the
schedule.

This package currently ships a skeleton only:

- `src/index.ts` — re-exports `@grove-dev/ui` (V1 primitives: `filterRecords`, `sortRecords`, `paginateRecords`, `scoreTier`, `scoreTierLabel`, `scoreLabel`, `format*`, `LENSES`, `SORT_OPTIONS`, etc.)
- `templates/default/package.json` — Next.js 15 + React 19 wiring (not exercised by V1)

The component library, app-router pages, and theme are still to be built. The architectural shape is locked: anything framework-specific lives in this package, anything generic stays in `@grove-dev/core` and `@grove-dev/ui`.

## What it will ship (roadmap, V1.2)

```txt
src/
├── components/        # ItemCard (V1 published name), IndexRow, RecordSection,
│                      # Pagination, ScoreBars, RefinePanel, Hero, …
│                      # (22 V1 surface, ported from @grove-dev/astro)
├── layouts/           # BaseLayout (RSC)
├── styles.css         # design tokens
└── index.ts           # re-exports @grove-dev/ui

templates/
└── default/           # full Next.js starter: app/, components/, public/,
                       # data/, .github/, next.config.mjs
```

## Usage in a space (planned)

```tsx
// app/page.tsx
import ItemCard from "@grove-dev/nextjs/components/ItemCard";
import BaseLayout from "@grove-dev/nextjs/layouts/BaseLayout";
import "@grove-dev/nextjs/styles.css";
import records from "@/data/generated/records.json";

export default function Page() {
  return (
    <BaseLayout title="My Grove space">
      {records.map((r) => <ItemCard key={r.slug} record={r} href={`/projects/${r.slug}`} />)}
    </BaseLayout>
  );
}
```

Components are imported by path. The barrel re-exports `@grove-dev/ui` so generic helpers (`filterRecords`, `sortRecords`, `paginateRecords`, `scoreTier`, `scoreTierLabel`, `scoreLabel`, `compact`, `formatStars`, `formatNumber`, `formatRelative`, `formatDate`, `LENSES`, `SORT_OPTIONS`) are available from the same import.

## Layering

`@grove-dev/nextjs` is the third layer of the Grove stack:

1. **`@grove-dev/core`** — schemas, importers, build pipeline (headless, V1 `Resource` union).
2. **`@grove-dev/ui`** — framework-agnostic UI primitives (V1: 5 typed modules over `IndexRecord`).
3. **`@grove-dev/nextjs`** ← you are here — Next.js components, layouts, template.

## Development

```bash
pnpm --filter @grove-dev/nextjs build
pnpm --filter @grove-dev/nextjs check
```

## License

MIT
