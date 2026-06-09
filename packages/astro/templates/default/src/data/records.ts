/**
 * Source of truth: data/generated/records.json, produced at build
 * time by `grove generate` from data/records/*.yml. The yml files
 * are the human-edited source; this file is a typed re-export that
 * pages can import without worrying about the on-disk shape.
 *
 * When adding a new record: write a yml in data/records/, run
 * `pnpm run generate`, and it will appear here.
 *
 * The shape is the V1 discriminated union from `@grove-dev/core`:
 * records have a `kind` field that selects `ProjectRecord`,
 * `ResourceRecord`, or `EntityRecord`. Pages cast to the kind they
 * expect based on the blueprint in `grove.config.ts`.
 */
import generatedJson from "../../data/generated/records.json";
import type {
  ProjectRecord,
  ResourceRecord,
  EntityRecord,
  Resource,
} from "@grove-dev/core";

const generated = generatedJson as { records: unknown[] };

/**
 * All records on disk, untyped. Pages cast to the specific kind they
 * need (e.g. `projects` lists cast to `ProjectRecord`).
 */
export const records = generated.records as Resource[];

/** Records of `kind: project` — for the `project-directory` blueprint. */
export const projects = records.filter(
  (r): r is ProjectRecord => r.kind === "project",
);

/** Records of `kind: resource` — for the `resource-hub` blueprint. */
export const resources = records.filter(
  (r): r is ResourceRecord => r.kind === "resource",
);

/** Records of `kind: entity` — for the `ecosystem-map` blueprint. */
export const entities = records.filter(
  (r): r is EntityRecord => r.kind === "entity",
);

const bySlug = new Map(records.map((r) => [r.slug, r]));

export function recordBySlug(slug: string): Resource | undefined {
  return bySlug.get(slug);
}

export function projectBySlug(slug: string): ProjectRecord | undefined {
  const r = bySlug.get(slug);
  return r && r.kind === "project" ? r : undefined;
}

export function resourceBySlug(slug: string): ResourceRecord | undefined {
  const r = bySlug.get(slug);
  return r && r.kind === "resource" ? r : undefined;
}

export function entityBySlug(slug: string): EntityRecord | undefined {
  const r = bySlug.get(slug);
  return r && r.kind === "entity" ? r : undefined;
}
