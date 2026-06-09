import { resolve } from "node:path";
import { createJiti } from "jiti";
import { groveConfigSchema, type GroveConfig } from "./schema.js";

export type { GroveConfig };

/**
 * Load the Grove project config. The config file is the single source
 * of truth for blueprint, site metadata, paths, integrations, theme,
 * and component overrides.
 *
 * Default name: `grove.config.ts`. Override with the second arg.
 */
export async function loadConfig(
  cwd = process.cwd(),
  configPath = "grove.config.ts",
): Promise<GroveConfig> {
  const resolved = resolve(cwd, configPath);
  const jiti = createJiti(import.meta.url);
  const mod = (await jiti.import(resolved, { default: true })) as Record<string, unknown>;
  const raw = mod.default ?? mod.config ?? mod;
  return groveConfigSchema.parse(raw);
}

/**
 * Define and validate a Grove config. Used at the bottom of a
 * `grove.config.ts` file so editors get good type hints.
 */
export function defineConfig(config: GroveConfig): GroveConfig {
  return groveConfigSchema.parse(config);
}
