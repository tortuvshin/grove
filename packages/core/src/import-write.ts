import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import type { ImportResult } from './import-types.js';
import { type Blueprint, blueprintKind, type ProjectRecord } from './schema.js';

/**
 * Write imported records out as `data/records/<slug>.yml`, one per
 * record. Each file is shaped for the `project-directory` blueprint
 * (kind: project). Other blueprints should use a separate importer.
 */
export async function writeImportedRecords(
  result: ImportResult,
  cwd = process.cwd(),
  blueprint: Blueprint = 'project-directory',
): Promise<{ written: number; dir: string }> {
  const expectedKind = blueprintKind[blueprint];
  const dir = resolve(cwd, 'data', 'records');
  await mkdir(dir, { recursive: true });
  let written = 0;
  for (const record of result.records) {
    let yamlObj: Record<string, unknown>;
    if (expectedKind === 'project') {
      const project: Partial<ProjectRecord> = {
        kind: 'project',
        slug: record.slug,
        name: record.name,
        description: record.description,
        category: record.category,
        tags: [],
        links: record.links,
        source: { type: 'import' },
      };
      yamlObj = project as Record<string, unknown>;
    } else {
      yamlObj = { ...record, kind: expectedKind };
    }
    const path = join(dir, `${record.slug}.yml`);
    await writeFile(path, stringifyYaml(yamlObj, { lineWidth: 100 }), 'utf8');
    written++;
  }
  return { written, dir };
}
