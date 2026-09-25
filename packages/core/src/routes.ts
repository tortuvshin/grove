import type { GroveConfig } from './config.js';

const BLUEPRINT_INDEX: Record<string, string> = {
  'project-directory': 'projects',
  'resource-hub': 'resources',
  'ecosystem-map': 'entities',
};

/**
 * Route segment of the directory index and record pages: `routes.directory`
 * when set, otherwise the blueprint's default (`project-directory` →
 * `projects`). Sitemap, llms.txt and README links all resolve it here so
 * they cannot disagree.
 */
export function directoryRoute(config: Pick<GroveConfig, 'routes' | 'blueprint'>): string {
  return config.routes.directory ?? BLUEPRINT_INDEX[config.blueprint] ?? 'items';
}
