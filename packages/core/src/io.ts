import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parse, stringify } from 'yaml';

// `parse(text, { schema: 'core' })` opts out of the YAML package's
// default schema — which permits custom tag interpretation
// (anchors, !!omap, !!binary, etc.). A malicious awesome-list README
// or a hand-edited record could otherwise exploit that surface.
// `core` is the YAML 1.2 core schema with explicit merge keys;
// sufficient for plain `key: value` record files and the safest
// default for any user-supplied YAML. (Implementation-checklist.md #27.)
const PARSE_OPTIONS = { schema: 'core' as const };

export async function readYamlFile<T>(path: string): Promise<T> {
  const text = await readFile(path, 'utf8');
  return parse(text, PARSE_OPTIONS) as T;
}

export async function writeYamlFile(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const text = stringify(value, {
    lineWidth: 100,
    singleQuote: false,
    defaultStringType: 'PLAIN',
  });
  await writeFile(path, text, 'utf8');
}

export async function writeTextFile(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, 'utf8');
}
