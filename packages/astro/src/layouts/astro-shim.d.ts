/**
 * Type declarations for the .astro layout components.
 *
 * The `.astro` files are excluded from `tsc` (the build only emits
 * TypeScript helpers, not compiled components), so we declare the
 * module shape here for the rare consumer that wants to write:
 *
 *   import { BaseLayout } from "@grove-dev/astro/layouts";
 *
 * Consumers that just want the components should import them by
 * file:
 *
 *   import BaseLayout from "@grove-dev/astro/layouts/BaseLayout.astro";
 *
 * The `AstroComponentFactory` is the runtime type Astro uses for
 * every `.astro` module's default export. In a normal Astro project
 * this is declared by the generated `.astro/types.d.ts` (produced
 * by `astro sync`); the `@grove-dev/astro` package itself doesn't
 * run an Astro build, so we re-declare it here.
 */

declare module "*.astro" {
  // Pull the factory type from Astro's server runtime. The path
  // `astro/runtime/server` is a documented deep import that has
  // shipped across Astro 4 and 5.
  import type { AstroComponentFactory } from "astro/runtime/server";
  const component: AstroComponentFactory;
  export default component;
}
