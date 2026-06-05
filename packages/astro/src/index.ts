/**
 * @grove-dev/astro — Astro UI primitives for Grove.
 *
 * This package only owns Astro components, layouts, styles, and
 * Astro-specific integrations. Generic filter/sort/stats/score
 * helpers live in `@grove-dev/ui` and are re-exported from here for
 * convenience.
 *
 * Astro components are not exported from this barrel — consumers
 * import them by path, e.g.:
 *   import ItemCard from "@grove-dev/astro/components/ItemCard.astro";
 *   import BaseLayout from "@grove-dev/astro/layouts/BaseLayout.astro";
 *
 * That keeps the barrel type-only and lets `astro check` validate
 * the .astro files in their own context.
 */
export * from "@grove-dev/ui";
