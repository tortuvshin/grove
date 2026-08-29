/**
 * @grove-dev/astro — Astro framework adapter for Grove.
 *
 * Provides:
 *  - `default` export: an Astro integration that wires the
 *    `@grove-dev/astro/components/*` and `@grove-dev/astro/layouts/*`
 *    subpath imports into Vite so consumer projects can write:
 *        import ProjectCard from "@grove-dev/astro/components/ProjectCard.astro";
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
 *
 * Also auto-loads the consumer's `src/styles/global.css` when it
 * exists. Without this hook the scaffold's global.css (which the
 * CLI generates for theme overrides) sits on disk unused, and any
 * custom theme tokens silently degrade to the package defaults —
 * which is the classic "I changed the brand color in global.css
 * and nothing happened" surprise.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, prepareDirectory } from '@grove-dev/core';
import type { AstroIntegration } from 'astro';
import { syncPackagedIcons } from './lib/packaged-icons.js';

export * from '@grove-dev/core';

// Generic lib helpers — repo URL parsing, formatting, search /
// facet / sort / paginate, lens application, score tiers, taxonomy
// counts, and pretty-print display maps. All dependency-free and
// typed against `@grove-dev/core`.
export * from './lib/index.js';

const here = dirname(fileURLToPath(import.meta.url));

// Virtual module id used to inject the consumer's `src/styles/global.css`.
// Resolved by the inline Vite plugin below to the absolute file path
// when the file exists, or to an empty module when it doesn't.
const CONSUMER_GLOBAL_CSS_VIRTUAL_ID = 'virtual:grove-consumer-global-css';
const CONSUMER_GLOBAL_CSS_EMPTY_ID = '\0virtual:grove-consumer-global-css:empty';

export default function groveAstro(): AstroIntegration {
  return {
    name: '@grove-dev/astro',
    hooks: {
      'astro:config:setup': async ({ config, updateConfig, injectScript, logger }) => {
        // Alias the components/layouts source directories so
        // consumer builds can import from
        //   @grove-dev/astro/components/ProjectCard.astro
        // without us shipping a glob-shaped `exports` map that
        // Vite/Rollup does not expand reliably.
        const consumerRoot = fileURLToPath(config.root);
        const groveConfigPath = resolve(consumerRoot, 'grove.config.ts');
        if (existsSync(groveConfigPath)) {
          await prepareDirectory(consumerRoot);
          // Data preparation and the icon sync below are the integration's
          // only site-level side effects. Routes belong to the consumer's
          // `src/pages`, where they remain visible, editable, and safe from
          // future Grove syncs.
          await loadConfig(consumerRoot);

          // `Icon.astro` resolves every mark to `/icons/**` in the
          // consumer's `public/`, so the packaged SVGs have to land there
          // before the build asks for them. Files the consumer edited are
          // left alone and reported.
          const icons = await syncPackagedIcons(fileURLToPath(config.publicDir));
          if (icons.adopted && icons.written.length > 0) {
            // One-time migration for a site that predates the sidecar.
            // Say so: the overwrite is safe for the scaffold set, but a
            // pre-sidecar hand edit would show up here, and version
            // control is what makes it recoverable.
            logger.info(
              `Adopted ${icons.written.length} icon(s) into public/icons/ and recorded them in ` +
                '.grove-icons.json. Review with `git diff public/icons` if you had edited any.',
            );
          }
          if (icons.skipped.length > 0) {
            logger.warn(
              `Kept ${icons.skipped.length} locally modified icon(s): ${icons.skipped.join(', ')}. ` +
                'Run `grove icons sync --force` to restore the packaged versions.',
            );
          }
        }
        const globalCssPath = resolve(consumerRoot, 'src/styles/global.css');
        const globalCssExists = existsSync(globalCssPath);

        updateConfig({
          vite: {
            resolve: {
              alias: {
                '@grove/generated': resolve(consumerRoot, 'data/generated'),
              },
            },
            // The OG image pipeline (`@grove-dev/core`'s og-image.ts)
            // dynamically imports satori + resvg's native binding.
            // They only ever run in `prepareDirectory` (Node, build
            // time) — never in page code — so keep the bundler away
            // from the .node binary.
            ssr: {
              external: ['satori', '@resvg/resvg-js'],
            },
            plugins: [
              {
                name: 'grove:consumer-global-css-resolver',
                resolveId(id) {
                  if (id === CONSUMER_GLOBAL_CSS_VIRTUAL_ID) {
                    return globalCssExists ? globalCssPath : CONSUMER_GLOBAL_CSS_EMPTY_ID;
                  }
                  return null;
                },
                load(id) {
                  if (id === CONSUMER_GLOBAL_CSS_EMPTY_ID) {
                    return '';
                  }
                  return null;
                },
              },
            ],
          },
        });

        // Always inject the virtual module so the build is symmetric
        // regardless of whether the consumer has a global.css yet.
        // Vite's CSS pipeline (with @tailwindcss/vite) handles the
        // resulting import as a stylesheet — no JS bundle weight.
        injectScript('page-ssr', `import "${CONSUMER_GLOBAL_CSS_VIRTUAL_ID}";`);
      },
    },
  };
}

// Re-export the virtual module id so consumers (and tests) can
// reason about it without copy-pasting the literal string.
export const CONSUMER_GLOBAL_CSS_ID = CONSUMER_GLOBAL_CSS_VIRTUAL_ID;
