/**
 * Shared UI constants. Order matters — render the LENSES list in
 * the order defined here.
 */
export const SORT_OPTIONS = [
  { value: "recently-updated", label: "Recently updated" },
  { value: "most-starred", label: "Most starred" },
  { value: "most-mature", label: "Most mature" },
  { value: "best-learning", label: "Best learning" },
  { value: "contribution-ready", label: "Contribution ready" },
  { value: "alphabetical", label: "Alphabetical" },
] as const;

export const LENSES = [
  { id: "all", label: "All", description: "Every visible project", params: {} },
  { id: "new", label: "New", description: "Recently added or emerging projects", params: { label: "new" } },
  { id: "hot", label: "Hot", description: "Projects with strong recent attention", params: { label: "hot" } },
  { id: "mature", label: "Mature", description: "Established and useful projects", params: { health: "mature" } },
  { id: "good-to-learn", label: "Good to learn", description: "Readable references with learning value", params: { lens: "good-to-learn" } },
  { id: "contribution-ready", label: "Contribution ready", description: "Projects with contribution signals", params: { lens: "contribution-ready" } },
] as const;

export const PAGE_SIZE = 12;
