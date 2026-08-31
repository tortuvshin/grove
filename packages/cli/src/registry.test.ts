import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256 } from './hash.js';
import {
  buildLockfile,
  itemLockEntries,
  loadItem,
  resolveBundledItemPath,
  SCAFFOLD_ID,
  targetToProjectPath,
  writeItemFiles,
} from './registry.js';

describe('registry item access', () => {
  it('resolves the bundled default item shipped inside the CLI', () => {
    const path = resolveBundledItemPath();
    expect(path.endsWith(join('dist', 'r', 'default.json'))).toBe(true);
    expect(existsSync(path)).toBe(true);
    expect(() => resolveBundledItemPath('no-such-item')).toThrow(/no-such-item/);
  });

  it("loads the built item with every file's content inlined", async () => {
    const item = await loadItem(resolveBundledItemPath());
    expect(item.name).toBe('default');
    expect(item.files).toHaveLength(70);
    for (const file of item.files) {
      expect(typeof file.content).toBe('string');
      expect(file.target.startsWith('~/src/'), file.path).toBe(true);
    }
  });

  it('derives lock entries with the shared hash format and ~/-stripped targets', async () => {
    const item = await loadItem(resolveBundledItemPath());
    const entries = itemLockEntries(item);
    expect(entries).toHaveLength(item.files.length);
    const targets = entries.map((entry) => entry.target);
    expect(targets).toEqual([...targets].sort((a, b) => a.localeCompare(b)));
    for (const entry of entries) {
      const file = item.files.find((f) => f.path === entry.source);
      if (!file) throw new Error(`${entry.source} is not in the item`);
      expect(entry.target).toBe(targetToProjectPath(file.target));
      expect(entry.target.startsWith('src/')).toBe(true);
      expect(entry.hash).toBe(sha256(file.content));
      expect(entry.bytes).toBe(Buffer.byteLength(file.content, 'utf8'));
    }
    const lock = buildLockfile(item);
    expect(lock.scaffold).toBe(SCAFFOLD_ID);
    expect(lock.scaffoldVersion).toBe(item.meta?.version);
    expect(lock.fileCount).toBe(70);
    expect(lock.installedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('writes only the requested files', async () => {
    const item = await loadItem(resolveBundledItemPath());
    const cwd = await mkdtemp(join(tmpdir(), 'grove-registry-'));
    const only = new Set(['src/styles/system.css', 'src/components/ui/badge.astro']);
    const written = await writeItemFiles(item, cwd, { only });
    expect(new Set(written)).toEqual(only);
    expect(await readdir(join(cwd, 'src'))).toEqual(['components', 'styles']);
    expect(await readdir(join(cwd, 'src/components'))).toEqual(['ui']);
    expect(await readdir(join(cwd, 'src/components/ui'))).toEqual(['badge.astro']);
    const badge = item.files.find((f) => f.target === '~/src/components/ui/badge.astro');
    if (!badge) throw new Error('badge.astro is not in the item');
    expect(await readFile(join(cwd, 'src/components/ui/badge.astro'), 'utf8')).toBe(badge.content);
  });
});
