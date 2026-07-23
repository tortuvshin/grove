import { filterEntries, rankEntries } from "./collections.js";
import type { Collection, CollectionEntry } from "./collections.js";

export interface CollectionResult {
  collection: Collection;
  entries: CollectionEntry[];
  totalCount: number;
  isEmpty: boolean;
  isStale: boolean;
}

export function runCollection(collection: Collection, entries: CollectionEntry[]): CollectionResult {
  const filtered = filterEntries(entries, collection.query);
  const ranked = rankEntries(filtered, collection.ranking);
  const isEmpty = ranked.length === 0;
  const isStale = !isEmpty && ranked.every((e) => e.status === "archived");
  return { collection, entries: ranked, totalCount: ranked.length, isEmpty, isStale };
}
