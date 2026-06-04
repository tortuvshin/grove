/** Build a DirectoryRecord (item + health + decision) for each item. */
export function buildDirectoryRecords(
  items: import("@grove-dev/core").CuratedItem[],
  health: import("@grove-dev/core").HealthEntry[] = [],
  decisions: import("@grove-dev/core").Decision[] = [],
): import("./types.js").DirectoryRecord[] {
  return items.map((item) => ({
    item,
    health: health.find((entry) => entry.id === item.id),
    decision: decisions.find((decision) => decision.id === item.id),
  }));
}

/** Drop records whose decision visibility is "hide" or "remove". */
export function visibleRecords(records: import("./types.js").DirectoryRecord[]): import("./types.js").DirectoryRecord[] {
  return records.filter((record) => {
    const visibility = record.decision?.decision.visibility;
    return visibility !== "hide" && visibility !== "remove";
  });
}
