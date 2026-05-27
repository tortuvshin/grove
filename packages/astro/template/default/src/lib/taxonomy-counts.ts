import { apps } from "../data/apps";

export function countByCategory(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const app of apps) counts.set(app.category, (counts.get(app.category) ?? 0) + 1);
  return counts;
}

export function countByStack(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const app of apps) counts.set(app.stack, (counts.get(app.stack) ?? 0) + 1);
  return counts;
}
