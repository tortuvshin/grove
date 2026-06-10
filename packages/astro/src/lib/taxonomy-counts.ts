/**
 * Build-time helpers that compute taxonomy counts from an array of
 * records. Generic over any object that carries the index-payload
 * fields the UI cares about (`category`, `stack` / `stacks`,
 * `curation.labels`). No filesystem / data import — consumers pass
 * the records explicitly so this stays testable.
 *
 * All functions are synchronous and cheap — they're called from
 * Astro page frontmatter at build time, never on the client.
 */

export interface Taxonomable {
  category?: string;
  stack?: string;
  stacks?: string[];
  curation?: { labels?: string[] };
}

/** Number of records per category name. */
export function countByCategory<T extends Taxonomable>(
  records: T[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of records) {
    const k = r.category || "Other";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** Number of records per primary stack (combines `stack` and `stacks`). */
export function countByStack<T extends Taxonomable>(
  records: T[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of records) {
    const keys = new Set(
      [r.stack, ...(r.stacks ?? [])].filter(
        (s): s is string => Boolean(s),
      ),
    );
    for (const k of keys) {
      m.set(k, (m.get(k) ?? 0) + 1);
    }
  }
  return m;
}

/** Number of records per curated label (curation.labels). */
export function countByLabel<T extends Taxonomable>(
  records: T[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of records) {
    for (const l of r.curation?.labels ?? []) {
      m.set(l, (m.get(l) ?? 0) + 1);
    }
  }
  return m;
}
