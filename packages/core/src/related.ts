import type { Collection, CollectionQuery } from './collections.js';

export function findRelated(target: Collection, all: Collection[], limit: number): Collection[] {
  const targetKeys = collectionKeys(target);
  return all
    .filter((c) => c.slug !== target.slug)
    .map((c) => ({ c, overlap: collectionKeys(c).filter((k) => targetKeys.includes(k)).length }))
    .filter((r) => r.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit)
    .map((r) => r.c);
}

/**
 * The facets two collections can share. Subjects count too — from the
 * collection's own `subject` and from `query.relatedTo` — so the hub for
 * one product links to a collection that also covers it.
 */
function collectionKeys(collection: Collection): string[] {
  const q: CollectionQuery = collection.query;
  const subjects = new Set([
    ...(collection.subject ? [collection.subject] : []),
    ...(q.relatedTo?.subjects ?? []),
  ]);
  return [
    ...(q.stacks ?? []).map((v) => `stack:${v}`),
    ...(q.platforms ?? []).map((v) => `platform:${v}`),
    ...(q.categories ?? []).map((v) => `category:${v}`),
    ...[...subjects].map((v) => `subject:${v}`),
  ];
}
