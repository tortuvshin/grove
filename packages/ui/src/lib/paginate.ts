/**
 * @grove-dev/ui — pagination primitive (V1, generic over `T`).
 *
 * Mirrors the V0 `paginateRecords` and the openapps/astro `paginate`
 * behavior: 1-based page index, `PAGE_SIZE`-based slice, and a
 * `totalPages` helper that always returns at least 1.
 *
 * Kept generic so the framework adapters (Astro, Svelte, Next.js)
 * can pass any record list — `IndexRecord[]` for directory pages,
 * `Resource[]` for the importer listing, etc.
 */
import { PAGE_SIZE } from "./constants.js";

/** Slice an array for a given page (1-based). Returns a new array. */
export function paginateRecords<T>(items: T[], page: number, pageSize: number = PAGE_SIZE): T[] {
  const safePage = Math.max(1, Math.floor(page));
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/** Total number of pages given an item count. Always >= 1. */
export function totalPages(itemCount: number, pageSize: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(itemCount / pageSize));
}
