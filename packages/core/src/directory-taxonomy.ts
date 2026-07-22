type TaxonomyRecord = {
  category?: string;
  stack?: string;
  stacks?: string[];
};

/** Number of items in the directory, per category name. */
export function countByCategory(items: TaxonomyRecord[] = []): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of items) {
    const k = a.category || "Other";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** Number of items in the directory, per primary stack. */
export function countByStack(items: TaxonomyRecord[] = []): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of items) {
    const stacks = new Set([a.stack, ...(a.stacks ?? [])].filter(Boolean) as string[]);
    if (stacks.size === 0) stacks.add("Other");
    for (const stack of stacks) m.set(stack, (m.get(stack) ?? 0) + 1);
  }
  return m;
}
