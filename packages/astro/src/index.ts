/**
 * @grove-dev/astro — Astro framework adapter for Grove.
 *
 * Provides:
 *  - `default` export: an Astro integration that wires the
 *    `@grove-dev/astro/components/*` and `@grove-dev/astro/layouts/*`
 *    subpath imports into Vite so consumer projects can write:
 *        import ItemCard from "@grove-dev/astro/components/ItemCard.astro";
 *    and have Vite resolve the source `.astro` file (the package's
 *    `dist/` only contains TypeScript helpers, not the components
 *    themselves).
 *  - Re-exports the framework-agnostic `Resource` types from
 *    `@grove-dev/core` so the component prop signatures stay
 *    type-safe without forcing a dependency on the core package
 *    in every consumer file.
 *  - Re-exports the generic `lib/` helpers (search, lenses, scores,
 *    repo, format, display, taxonomy-counts) under a single import
 *    path so consumers can `import { ... } from "@grove-dev/astro"`.
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { AstroIntegration } from "astro";

export * from "@grove-dev/core";

// Generic lib helpers — repo URL parsing, formatting, search /
// facet / sort / paginate, lens application, score tiers, taxonomy
// counts, and pretty-print display maps. All dependency-free and
// typed against `@grove-dev/core`.
export * from "./lib/index.js";

const here = dirname(fileURLToPath(import.meta.url));
// `here` is the compiled `dist/` directory. The components and
// layouts live in the source tree (the `dist/` is for the
// integration helper only). Walk up one level to reach `src/`
// before resolving the subpath roots.
const srcRoot = resolve(here, "..", "src");
const componentsDir = resolve(srcRoot, "components");
const layoutsDir = resolve(srcRoot, "layouts");

export default function groveAstro(): AstroIntegration {
  return {
    name: "@grove-dev/astro",
    hooks: {
      "astro:config:setup": ({ updateConfig }) => {
        // Alias the components/layouts source directories so
        // consumer builds can import from
        //   @grove-dev/astro/components/ItemCard.astro
        // without us shipping a glob-shaped `exports` map that
        // Vite/Rollup does not expand reliably.
        updateConfig({
          vite: {
            resolve: {
              alias: {
                "@grove-dev/astro/components": componentsDir,
                "@grove-dev/astro/layouts": layoutsDir,
              },
            },
          },
        });
      },
    },
  };
}
