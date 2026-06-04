/** Slugify a category name for URLs. Lowercase, dashes, no leading/trailing. */
export function slugForCategory(category: string): string {
  return category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
