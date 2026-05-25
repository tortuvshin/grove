import { apps } from "./apps";
import { categories } from "./categories";
import { contributors } from "./contributors";

const platforms = new Set<string>();
for (const app of apps) {
  for (const platform of app.platforms ?? []) platforms.add(platform);
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
  stars: apps.reduce((sum, app) => sum + (app.stars ?? 0), 0),
  forks: apps.reduce((sum, app) => sum + (app.github?.repository?.forks_count ?? 0), 0),
  categories: categories.length,
  stacks: new Set(apps.map((app) => app.stack).filter(Boolean)).size,
  platforms: platforms.size,
  originalRepo: "https://github.com/tortuvshin/open-curated",
};
