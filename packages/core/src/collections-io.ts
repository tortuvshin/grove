/**
 * Collection IO — loads `Collection` YAML files from disk. Kept apart
 * from `collections.ts` so the query/ranking engine stays pure and
 * importable in non-Node contexts.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { type Collection, collectionDefinitionSchema } from './collections.js';

/**
 * Load all `Collection` YAML files from `<cwd>/data/collections/*.yml`.
 *
 * Returns an empty array if the directory does not exist, so callers can
 * safely render an empty/loading state without having to guard each
 * invocation site. Parse errors and other unexpected failures are NOT
 * swallowed — they surface so real problems (malformed YAML, permission
 * errors, etc.) are visible instead of silently producing empty output.
 *
 * Every file is parsed with `collectionDefinitionSchema`, so defaults are
 * applied (`kind`, `query`, `ranking`, `seo.index`) and a malformed file
 * throws a `CollectionFileError` naming the file and the failing fields.
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
    out.push(parseCollectionFile(f, await readFile(join(dir, f), 'utf8')));
  }
  return out;
}

/** A collection file that is not valid YAML or does not match the schema. */
export class CollectionFileError extends Error {
  constructor(
    readonly file: string,
    readonly problems: string[],
  ) {
    super(`Invalid collection ${file}: ${problems.join('; ')}`);
    this.name = 'CollectionFileError';
  }
}

/**
 * Parse one collection file's text. Shared by `loadCollections` and
 * `validateProject` so the build and `grove check` agree on what a valid
 * collection is.
 */
export function parseCollectionFile(file: string, text: string): Collection {
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (err) {
    throw new CollectionFileError(file, [(err as Error).message]);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new CollectionFileError(file, ['expected a YAML mapping']);
  }
  const parsed = collectionDefinitionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CollectionFileError(
      file,
      parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }
  return parsed.data;
}
