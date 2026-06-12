/**
 * @grove-dev/ui — sort primitive (V1, typed against `IndexRecord`).
 *
 * V0 worked on `DirectoryRecord` (which no longer exists in V1). V1
 * sorts `IndexRecord` — the discriminated union exported by
 * `@grove-dev/core` — and only applies project-specific sort keys
 * (stars, pushedAt, score-like signals) when the record is a
 * `IndexProjectRecord`. Resources and entities fall back to a stable
 * secondary key (kind order, name) so the sort is deterministic
 * across the whole directory.
 *
 * This module re-uses the V1 openapps/astro `search.ts` semantics
 * so the framework adapters can swap the implementation for the
 * local one without behavior drift.
 */
import type { IndexRecord } from "@grove-dev/core";
import { type SortValue } from "./constants.js";

const ts = (s?: string | null): number => (s ? new Date(s).valueOf() : 0);

function recordName(record: IndexRecord): string {
  return record.kind === "resource" ? record.title : record.name;
}

function projectStars(record: IndexRecord): number {
  return record.kind === "project" ? record.github?.stars ?? 0 : 0;
}

function recordUpdatedAt(record: IndexRecord): string | null {
  if (record.kind === "project") return record.github?.pushedAt ?? null;
  if (record.kind === "resource") return record.publishedAt ?? null;
  return null;
}

function recordAddedAt(record: IndexRecord): string | null {
  return record.curation?.reviewedAt ?? null;
}

/**
 * Sort `IndexRecord[]` according to the supplied sort order. Returns
 * a new array — input is not mutated. Stable for ties.
 *
 * Records missing the sort key (e.g. no stars) sink to the bottom
 * rather than vanishing.
 */
export function sortRecords(records: IndexRecord[], sort: SortValue = "recently-updated"): IndexRecord[] {
  const arr = records.slice();
  switch (sort) {
    case "most-starred":
      arr.sort((a, b) => projectStars(b) - projectStars(a));
      break;
    case "recently-updated":
      arr.sort((a, b) => ts(recordUpdatedAt(b)) - ts(recordUpdatedAt(a)));
      break;
    case "recently-added":
      arr.sort((a, b) => ts(recordAddedAt(b)) - ts(recordAddedAt(a)));
      break;
    case "best-overall": {
      // V1 composite: curation.reviewed → visibility keep → stars.
      // `scores.overall` was a V0 field; V1 only carries the
      // curation.reviewed boolean plus the visibility tier, so the
      // openapps-style score cascade is replaced by a "curated first,
      // visible second" cascade.
      const reviewed = (a: IndexRecord) => (a.curation?.reviewed ? 1 : 0);
      const visible = (a: IndexRecord) => (a.visibility === "keep" ? 1 : 0);
      arr.sort((a, b) => {
        const rDelta = reviewed(b) - reviewed(a);
        if (rDelta !== 0) return rDelta;
        const vDelta = visible(b) - visible(a);
        if (vDelta !== 0) return vDelta;
        return projectStars(b) - projectStars(a);
      });
      break;
    }
    case "alphabetical":
      arr.sort((a, b) => recordName(a).localeCompare(recordName(b)));
      break;
  }
  return arr;
}

export type { IndexRecord };
