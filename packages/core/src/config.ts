import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { curatedConfigSchema, type CuratedConfig } from "./schema.js";

export async function loadConfig(cwd = process.cwd(), configPath = "curated.config.ts"): Promise<CuratedConfig> {
  const resolved = resolve(cwd, configPath);
  const mod = await import(`${pathToFileURL(resolved).href}?t=${Date.now()}`);
  const raw = mod.default ?? mod.config ?? mod;
  return curatedConfigSchema.parse(raw);
}

export function defineConfig(config: CuratedConfig): CuratedConfig {
  return curatedConfigSchema.parse(config);
}
