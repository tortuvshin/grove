# `@grove-dev/nextjs`

> Next.js framework adapter for Grove.

A thin layer of React components, layouts, and design tokens, on top of the framework-agnostic `@grove-dev/core` and `@grove-dev/ui`. Includes a default `templates/default/` directory that `grove new --framework nextjs` copies into a new project.

```bash
pnpm add @grove-dev/nextjs
```

## Status

This package is a **skeleton** at the moment. It ships:

- `src/index.ts` — re-exports `@grove-dev/ui`
- `src/styles.css` — placeholder design tokens
- `templates/default/package.json` — Next.js 15 + React 19 wiring

The component library, app-router pages, and theme are still to be built. The architectural shape is locked: anything framework-specific lives in this package, anything generic stays in `@grove-dev/core` and `@grove-dev/ui`.

## What it will ship (roadmap)

```txt
src/
├── components/        # ItemCard, CategoryGrid, HealthBadge, ScoreBars,
│                      # DirectoryFilters, DirectoryHero, LensTabs, ...
├── layouts/           # BaseLayout (RSC)
├── styles.css         # design tokens + Tailwind entry
└── index.ts           # re-exports @grove-dev/ui

templates/
└── default/           # full Next.js starter: app/, components/, public/,
                       # data/, .github/, next.config.mjs, tailwind.config.mjs
```

## Usage in a space

```tsx
// app/page.tsx
import { ItemCard } from "@grove-dev/nextjs/components/ItemCard";
import { BaseLayout } from "@grove-dev/nextjs/layouts/BaseLayout";
import "@grove-dev/nextjs/styles.css";
import apps from "@/data/generated/apps.json";

export default function Page() {
  return (
    <BaseLayout title="My Grove space">
      {apps.map((app) => <ItemCard key={app.slug} item={app} />)}
    </BaseLayout>
  );
}
```

Components are imported by path. The barrel re-exports `@grove-dev/ui` so generic helpers (`filterRecords`, `slugForCategory`, etc.) are available from the same import.

## Layering

`@grove-dev/nextjs` is the third layer of the Grove stack:

1. **`@grove-dev/core`** — schemas, importers, build pipeline (headless).
2. **`@grove-dev/ui`** — framework-agnostic UI primitives.
3. **`@grove-dev/nextjs`** ← you are here — Next.js components, layouts, template.

## Development

```bash
pnpm --filter @grove-dev/nextjs build
pnpm --filter @grove-dev/nextjs check
```

## License

MIT
