type TaxonomyRecord = {
  category?: string;
  stack?: string;
  stacks?: string[];
};

/**
 * Return a project's primary and supporting stacks once, in display order.
 *
 * `stack` is the canonical browse dimension while `stacks` can repeat it
 * for compatibility with older records. UI and view-model consumers should
 * use this helper instead of concatenating both fields directly.
 */
export function projectStackIds(
  project?: Pick<TaxonomyRecord, "stack" | "stacks"> | null,
): string[] {
  if (!project) return [];
  return [
    ...new Set(
      [project.stack, ...(project.stacks ?? [])].filter(
        (stack): stack is string => Boolean(stack),
      ),
    ),
  ];
}

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
    const stacks = new Set(projectStackIds(a));
    if (stacks.size === 0) stacks.add("Other");
    for (const stack of stacks) m.set(stack, (m.get(stack) ?? 0) + 1);
  }
  return m;
}
