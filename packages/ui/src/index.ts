/**
 * @grove-dev/ui — framework-agnostic UI primitives for Grove.
 *
 * **Roadmap only — not in V1.**
 *
 * The V1 data model is a discriminated union of `ProjectRecord`,
 * `ResourceRecord`, and `EntityRecord` (see `@grove-dev/core/schema`).
 * The V0 UI primitives that hung off the flat `CuratedItem` type do
 * not carry over, and rebuilding them on top of the new schemas is a
 * Wave 2 task. The package remains in the workspace so consumers can
 * keep depending on `@grove-dev/ui` without breaking, but it ships
 * only this re-export and a no-op identity helper until V2 lands.
 *
 * For V1 list and detail page work, import `Resource`, `ProjectRecord`,
 * `ResourceRecord`, or `EntityRecord` directly from `@grove-dev/core`
 * and write the page logic against the blueprint the site configures.
 */
export const UI_VERSION = "0.0.0-roadmap";

export type { Resource, ProjectRecord, ResourceRecord, EntityRecord } from "@grove-dev/core";

/** No-op identity helper so existing imports do not break. */
export function identity<T>(value: T): T {
  return value;
}
