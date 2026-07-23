import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type { Collection } from "@grove-dev/core";

/**
 * Load all `Collection` YAML files from `<cwd>/data/collections/*.yml`.
 *
 * Returns an empty array if the directory does not exist or no YAML files
 * are present, so callers can safely render an empty/loading state without
 * having to guard each invocation site.
 */
export async function loadCollections(cwd: string): Promise<Collection[]> {
  const dir = resolve(cwd, "data/collections");
  try {
    const files = await readdir(dir);
    const out: Collection[] = [];
    for (const f of files.filter((f) => f.endsWith(".yml"))) {
      const raw = parseYaml(await readFile(join(dir, f), "utf8")) as Collection;
      out.push(raw);
    }
    return out;
  } catch {
    return [];
  }
}
