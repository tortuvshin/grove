/**
 * Collection IO — loads `Collection` YAML files from disk. Kept apart
 * from `collections.ts` so the query/ranking engine stays pure and
 * importable in non-Node contexts.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { Collection } from './collections.js';

/**
 * Load all `Collection` YAML files from `<cwd>/data/collections/*.yml`.
 *
 * Returns an empty array if the directory does not exist, so callers can
 * safely render an empty/loading state without having to guard each
 * invocation site. Parse errors and other unexpected failures are NOT
 * swallowed — they surface so real problems (malformed YAML, permission
 * errors, etc.) are visible instead of silently producing empty output.
 */
export async function loadCollections(cwd: string): Promise<Collection[]> {
  const dir = resolve(cwd, 'data/collections');
  let files: string[];
  try {
    files = await readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const out: Collection[] = [];
  for (const f of files.filter((f) => f.endsWith('.yml'))) {
    const raw = parseYaml(await readFile(join(dir, f), 'utf8'));
    if (!raw || typeof raw !== 'object') {
      throw new Error(`Invalid collection YAML: ${f}`);
    }
    out.push(raw as Collection);
  }
  return out;
}
