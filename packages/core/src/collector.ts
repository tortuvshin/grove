import type { Collection, CollectionEntry, CollectionQuery } from './collections.js';
import { filterEntries, rankEntries } from './collections.js';

export interface CollectionResult {
  collection: Collection;
  entries: CollectionEntry[];
  totalCount: number;
  isEmpty: boolean;
  isStale: boolean;
}

function hasCriteria(query: CollectionQuery): boolean {
  return Object.values(query).some((value) =>
    Array.isArray(value) ? value.length > 0 : value !== undefined && value !== '',
  );
}

/**
 * Resolve a collection against the entry stream.
 *
 * Membership is the union of the hand-picked `entries` and the `query`
 * matches. An empty query matches every record, so it only takes part
 * when it actually states a criterion — or when there are no picks at
 * all, which keeps a query-less collection meaning "everything", as it
 * always has.
 *
 * A pick is the curator's call: it skips the query, `excludeStatuses`
 * included. It cannot resurrect a hidden or removed record, because
 * those never reach the entry stream. A pick whose slug is not in the
 * stream is skipped here; `grove check` reports it.
 *
 * Order: pinned picks first, in file order; everything else ranked by
 * `ranking`. Under the `curated` preset "ranked" means picks in file
 * order, then query matches in stream order.
 */
export function runCollection(
  collection: Collection,
  entries: CollectionEntry[],
): CollectionResult {
  const picks = collection.entries ?? [];
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry] as const));

  const picked: CollectionEntry[] = [];
  const seen = new Set<string>();
  for (const pick of picks) {
    const entry = bySlug.get(pick.slug);
    if (!entry || seen.has(pick.slug)) continue;
    seen.add(pick.slug);
    picked.push({
      ...entry,
      ...(pick.note ? { note: pick.note } : {}),
      ...(pick.pinned ? { pinned: true } : {}),
    });
  }

  const matched =
    picks.length === 0 || hasCriteria(collection.query)
      ? filterEntries(entries, collection.query).filter((entry) => !seen.has(entry.slug))
      : [];

  const pinned = picked.filter((entry) => entry.pinned);
  const rest = rankEntries(
    [...picked.filter((entry) => !entry.pinned), ...matched],
    collection.ranking,
  );
  const ranked = [...pinned, ...rest];

  const isEmpty = ranked.length === 0;
  const isStale = !isEmpty && ranked.every((e) => e.status === 'archived');
  return { collection, entries: ranked, totalCount: ranked.length, isEmpty, isStale };
}
