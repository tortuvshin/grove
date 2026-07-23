import type { Collection, CollectionQuery } from "./collections.js";

export function findRelated(target: Collection, all: Collection[], limit: number): Collection[] {
  const targetKeys = queryKeys(target.query);
  return all
    .filter((c) => c.slug !== target.slug)
    .map((c) => ({ c, overlap: queryKeys(c.query).filter((k) => targetKeys.includes(k)).length }))
    .filter((r) => r.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit)
    .map((r) => r.c);
}

function queryKeys(q: CollectionQuery): string[] {
  return [
    ...(q.stacks ?? []).map((v) => `stack:${v}`),
    ...(q.platforms ?? []).map((v) => `platform:${v}`),
    ...(q.categories ?? []).map((v) => `category:${v}`),
  ];
}
