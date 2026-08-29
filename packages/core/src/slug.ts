/**
 * Single source of truth for slugification. Two helpers:
 *   - `slugify(value)`:  lower-case + lowercase a-z0-9 + hyphens, drop
 *     smart quotes, trim to 80 chars. Matches GitHub-Pages URL rules
 *     (lowercase ASCII + hyphens only, no underscores, no accents).
 *   - `uniqueSlug(base, seen)`: collision counter. The first occurrence
 *     of a slug wins; subsequent occurrences get `slug-2`, `slug-3`, ….
 *     This is the canonical collision behavior — every other slugifier
 *     in the package delegates here.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function uniqueSlug(base: string, seen: Map<string, number>): string {
  const slug = slugify(base) || 'item';
  const count = seen.get(slug) ?? 0;
  seen.set(slug, count + 1);
  return count === 0 ? slug : `${slug}-${count + 1}`;
}
