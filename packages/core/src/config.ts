import { resolve } from "node:path";
import { createJiti } from "jiti";
import { curatedConfigSchema, type CuratedConfig } from "./schema.js";

export async function loadConfig(cwd = process.cwd(), configPath = "curated.config.ts"): Promise<CuratedConfig> {
  const resolved = resolve(cwd, configPath);
  const jiti = createJiti(import.meta.url);
  const mod = await jiti.import(resolved, { default: true }) as Record<string, unknown>;
  const raw = mod.default ?? mod.config ?? mod;
  return curatedConfigSchema.parse(raw);
}

export function defineConfig(config: CuratedConfig): CuratedConfig {
  return curatedConfigSchema.parse(config);
}
