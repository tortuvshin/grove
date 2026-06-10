/**
 * Type declarations for the .astro layout components.
 *
 * The actual `.astro` files are excluded from `tsc` (the build only
 * emits TypeScript helpers, not compiled components), so we declare
 * the module shape here for the rare consumer that wants to write:
 *
 *   import { BaseLayout } from "@grove-dev/astro/layouts";
 *
 * Consumers that just want the components should import them by
 * file:
 *
 *   import BaseLayout from "@grove-dev/astro/layouts/BaseLayout.astro";
 *
 * The `*.astro` module type comes from Astro's built-in
 * `astro/client` shim. We re-export the same shape here.
 */

declare module "*.astro" {
  import type { AstroComponentFactory } from "astro/runtime/server/index.js";
  const component: AstroComponentFactory;
  export default component;
}

export {};
