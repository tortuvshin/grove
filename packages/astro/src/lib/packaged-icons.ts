/**
 * Locate the icon set that ships inside `@grove-dev/astro`.
 *
 * The component and the SVGs it points at live in the same package on
 * purpose: an upgrade that changes how `Icon.astro` resolves a name
 * carries the matching artwork with it, so a consumer can never end up
 * with a component asking for files their site does not have.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { IconSyncOptions, IconSyncResult } from "@grove-dev/core";
import { syncIconAssets } from "@grove-dev/core";

/**
 * `packages/astro/assets/icons` — two levels up, which holds for both
 * `src/lib/` (tests, Vite) and `dist/lib/` (published).
 */
export const packagedIconsDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "assets",
  "icons",
);

/** Copy the packaged icon set into a site's `public/`. */
export function syncPackagedIcons(
  publicDir: string,
  options?: IconSyncOptions,
): Promise<IconSyncResult> {
  return syncIconAssets(packagedIconsDir, publicDir, options);
}
