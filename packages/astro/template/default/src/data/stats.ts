// Site stats, derived from generated JSON files at build time.
//
// This file imports the same JSON the rest of the app uses, so the numbers
// here always match what's actually rendered. No hand-tuned magic numbers.
//
// Numbers in the rendered UI (hero, header, OriginalCollection) come from
// this module. If a number looks wrong, refresh the source data:
//   - pnpm run sync:repo-stats    → data/generated/repo-stats.json (open-apps repo)
//   - pnpm run sync:contributors  → src/data/contributors.ts
//   - pnpm run refresh:activity   → data/apps/*.yml (per-app activity, then build:data)
import generatedJson from "../../data/generated/apps.json";
import repoStats from "../../data/generated/repo-stats.json";
import { categories } from "./categories";
import { contributors } from "./contributors";

type GeneratedApp = {
  stack?: string;
  platforms?: string[];
};

type RepoStats = {
  stars: number;
  forks: number;
  watchers?: number;
  openIssues?: number;
  defaultBranch?: string;
  pushedAt?: string;
  syncedAt?: string;
};

const raw = generatedJson as { apps?: GeneratedApp[] };
const apps: GeneratedApp[] = raw.apps ?? [];
const repo = repoStats as RepoStats;

const platforms = new Set<string>();
for (const a of apps) {
  for (const p of a.platforms ?? []) platforms.add(p);
}

export type SiteStats = {
  apps: number;
  contributors: number;
  stars: number;
  forks: number;
  categories: number;
  stacks: number;
  platforms: number;
  originalRepo: string;
};

export const stats: SiteStats = {
  apps: apps.length,
  contributors: contributors.length,
  // Stars/forks are the open-apps repo's own — sourced from
  // data/generated/repo-stats.json, refreshed weekly by the
  // sync-repo-stats workflow. Previously these were summed across
  // every app in the directory, which produced 6-figure numbers
  // for a 4k-star repo.
  stars: repo.stars,
  forks: repo.forks,
  categories: categories.length,
  stacks: new Set(apps.map((a) => a.stack).filter(Boolean)).size,
  platforms: platforms.size,
  originalRepo: "https://github.com/tortuvshin/open-apps",
};
